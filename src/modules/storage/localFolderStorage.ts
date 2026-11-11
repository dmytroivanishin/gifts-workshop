import { mkdir, open, opendir, realpath, rename, rmdir, statfs, stat, lstat, unlink, access, constants } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { BaseError } from "@/common/errors/base";
import { logger } from "@/modules/logger";
import { InvalidStorageKeyError, StorageError, StorageFullError, StorageTimeoutError, StorageUnavailableError } from "@/common/errors/storage";
import type { MediaStorage, RemoveResult, StoredObject } from "@/interfaces/storage/mediaStorage";

// A key is one or more segments joined by "/". A segment may not start with "." so that a key can
// never be "..", never point at a hidden or temporary file, and never climb out of the root.
const SEGMENT_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;
const TEMP_SUFFIX = ".tmp";
// Uploads stop while less than this is free, leaving room for the disk's own needs and for the logs.
const MIN_FREE_BYTES = 500 * 1024 * 1024;

function assertValidKey(key: string): string[] {
  const segments = key.split("/");
  if (key.length === 0 || segments.some((segment) => !SEGMENT_PATTERN.test(segment))) {
    throw new InvalidStorageKeyError(`Invalid storage key: ${JSON.stringify(key)}`);
  }
  return segments;
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

// Maps an OS error to the app's error types. The OS message is kept for the log by the caller and never
// reaches the response: it contains absolute paths.
export function toStorageError(error: unknown): BaseError {
  // Already one of ours (for example a refused key): keep its status code instead of turning it into a 500.
  if (error instanceof BaseError) return error;
  const code = errorCode(error);
  if (code === "ENOSPC" || code === "EDQUOT") {
    return new StorageFullError("Not enough space to store the file.");
  }
  if (code === "EACCES" || code === "EPERM" || code === "EROFS" || code === "ENOENT") {
    return new StorageUnavailableError("Media storage is not available right now.");
  }
  return new StorageError("Failed to store the file.");
}

function describeReason(error: unknown): string {
  if (error instanceof BaseError) return error.errorCode;
  return errorCode(error) ?? "UNKNOWN";
}

// Stores objects as plain files under one root folder. Writes go to a temporary file in the same folder
// first and are renamed into place, so a reader (or the reconcile job) never sees a half-written file.
export class LocalFolderStorage implements MediaStorage {
  private readonly root: string;
  private readonly minFreeBytes: number;

  constructor(root: string, options: { minFreeBytes?: number } = {}) {
    if (!path.isAbsolute(root)) {
      throw new Error("LocalFolderStorage needs an absolute root path");
    }
    this.root = path.resolve(root);
    this.minFreeBytes = options.minFreeBytes ?? MIN_FREE_BYTES;
  }

  // Refuses a write while the disk is nearly full, so the upload fails with a clear "no space" answer
  // instead of a half-written file. Checked before every write: free space changes between uploads.
  private async assertEnoughSpace(): Promise<void> {
    try {
      const usage = await statfs(this.root);
      if (usage.bavail * usage.bsize < this.minFreeBytes) {
        throw new StorageFullError("Not enough space to store the file.");
      }
    } catch (error) {
      throw toStorageError(error);
    }
  }

  // Resolves a key to a path inside the root. Validation happens here, once, for every operation.
  private resolvePath(key: string): string {
    const segments = assertValidKey(key);
    const resolved = path.join(this.root, ...segments);
    if (!resolved.startsWith(this.root + path.sep)) {
      throw new InvalidStorageKeyError(`Invalid storage key: ${JSON.stringify(key)}`);
    }
    return resolved;
  }

  async ensureReady(): Promise<void> {
    try {
      await mkdir(this.root, { recursive: true });
      await access(this.root, constants.W_OK);
    } catch (error) {
      throw toStorageError(error);
    }
  }

  async put(key: string, data: Buffer, options?: { signal?: AbortSignal }): Promise<void> {
    const signal = options?.signal;
    const target = this.resolvePath(key);
    const directory = path.dirname(target);
    const temporary = path.join(directory, `.${path.basename(target)}.${randomBytes(6).toString("hex")}${TEMP_SUFFIX}`);
    // Outside the try: a refused path must not lead to any cleanup of a file named in that path.
    await this.assertInsideRoot(directory);
    await this.assertEnoughSpace();

    try {
      await mkdir(directory, { recursive: true });
      const handle = await open(temporary, "wx");
      try {
        // The signal stops writeFile itself; sync cannot be interrupted, so the check before rename covers that step.
        await handle.writeFile(data, { signal });
        // Flush to disk before the rename: otherwise a crash can leave a visible file with missing bytes.
        await handle.sync();
      } finally {
        await handle.close();
      }
      // Last check: once the rename happens the object is visible, so an abort must stop it here.
      if (signal?.aborted) throw new StorageTimeoutError("Storing the file took too long.");
      await rename(temporary, target);
    } catch (error) {
      // Best effort: the temporary file must not outlive a failed write. removeStaleTemp catches any leftover.
      await unlink(temporary).catch(() => undefined);
      const failure =
        signal?.aborted && !(error instanceof StorageTimeoutError)
          ? new StorageTimeoutError("Storing the file took too long.")
          : toStorageError(error);
      // The client gets only the short message. The OS error (with its real path) goes to the log.
      logger.error("Failed to store media file", { code: "STORAGE_WRITE_FAILED", key, reason: failure.errorCode, error });
      throw failure;
    }

    await this.syncDirectory(directory);
  }

  async remove(keys: string[]): Promise<RemoveResult> {
    const result: RemoveResult = { removed: [], failed: [] };

    for (const key of keys) {
      let target: string;
      try {
        target = this.resolvePath(key);
      } catch (error) {
        result.failed.push({ key, reason: describeReason(error) });
        continue;
      }

      try {
        await unlink(target);
        result.removed.push(key);
      } catch (error) {
        if (errorCode(error) === "ENOENT") {
          // Already gone: the goal is "not there", so a retry or a double delete is harmless.
          result.removed.push(key);
        } else {
          result.failed.push({ key, reason: describeReason(error) });
          continue;
        }
      }

      await this.pruneEmptyDirectories(path.dirname(target));
    }

    return result;
  }

  async *listObjects(): AsyncGenerator<StoredObject> {
    for await (const file of this.walkFiles(this.root, "")) {
      // Hidden files are temporary writes or dot-files, never stored objects.
      if (file.name.startsWith(".")) continue;
      // A file deleted while the walk runs is simply not there any more.
      const details = await stat(file.fullPath).catch((error: unknown) => {
        if (errorCode(error) === "ENOENT") return undefined;
        throw toStorageError(error);
      });
      if (!details) continue;
      yield { key: file.relativeKey, lastModified: details.mtime, size: details.size };
    }
  }

  async existingKeys(keys: string[]): Promise<Set<string>> {
    const present = new Set<string>();
    for (const key of keys) {
      let target: string;
      try {
        target = this.resolvePath(key);
      } catch {
        // A key that cannot be valid cannot exist either.
        continue;
      }
      const isFile = await stat(target).then(
        (details) => details.isFile(),
        (error: unknown) => {
          if (errorCode(error) === "ENOENT") return false;
          throw toStorageError(error);
        }
      );
      if (isFile) present.add(key);
    }
    return present;
  }

  async removeStaleTemp(olderThanMs: number): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    let removed = 0;

    for await (const file of this.walkFiles(this.root, "")) {
      if (!file.name.startsWith(".") || !file.name.endsWith(TEMP_SUFFIX)) continue;
      const details = await stat(file.fullPath).catch(() => undefined);
      if (!details || details.mtimeMs > cutoff) continue;
      // A folder that held only a temporary file is empty now, so it goes too, like after a normal delete.
      const unlinked = await unlink(file.fullPath).then(() => true).catch(() => false);
      if (unlinked) {
        removed++;
        await this.pruneEmptyDirectories(path.dirname(file.fullPath));
      }
    }

    return removed;
  }

  // Writes follow symbolic links, so a link inside the folder could send a write anywhere on the disk.
  // Checked before any directory is created: the nearest existing ancestor must resolve inside the root.
  private async assertInsideRoot(directory: string): Promise<void> {
    try {
      await mkdir(this.root, { recursive: true });
      const realRoot = await realpath(this.root);
      let existing = directory;
      while (!(await lstat(existing).then(() => true, () => false))) {
        existing = path.dirname(existing);
      }
      const real = await realpath(existing).catch(() => {
        throw new InvalidStorageKeyError("Storage path cannot be resolved.");
      });
      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
        throw new InvalidStorageKeyError("Storage path leads outside the media folder.");
      }
    } catch (error) {
      throw toStorageError(error);
    }
  }

  // Yields every regular file below `directory`, one at a time. opendir reads a folder entry by entry, so a
  // folder with thousands of uploads is never loaded whole. Symbolic links are skipped on purpose: the root
  // must not be able to read or delete anything outside itself through a link.
  private async *walkFiles(
    directory: string,
    prefix: string
  ): AsyncGenerator<{ name: string; relativeKey: string; fullPath: string }> {
    let handle;
    try {
      handle = await opendir(directory);
    } catch (error) {
      if (errorCode(error) === "ENOENT") return;
      throw toStorageError(error);
    }

    for await (const entry of handle) {
      const relativeKey = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        yield* this.walkFiles(fullPath, relativeKey);
      } else if (entry.isFile()) {
        yield { name: entry.name, relativeKey, fullPath };
      }
    }
  }

  // Removes folders left empty by a delete, up to but never including the root.
  private async pruneEmptyDirectories(directory: string): Promise<void> {
    let current = directory;
    while (current !== this.root && current.startsWith(this.root + path.sep)) {
      try {
        await rmdir(current);
      } catch {
        // Not empty (another object lives there) or already gone: either way, stop here.
        return;
      }
      current = path.dirname(current);
    }
  }

  // Makes a rename durable on POSIX systems. Not supported everywhere, so a failure here is ignored.
  private async syncDirectory(directory: string): Promise<void> {
    try {
      const handle = await open(directory, "r");
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch {
      // Ignored on purpose: the file is already in place, only its durability guarantee is weaker.
    }
  }
}
