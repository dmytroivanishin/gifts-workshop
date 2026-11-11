import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, utimes, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalFolderStorage, toStorageError } from "@/modules/storage/localFolderStorage";
import { InvalidStorageKeyError, StorageFullError, StorageTimeoutError, StorageUnavailableError, StorageError } from "@/common/errors/storage";

let sandbox: string;
let root: string;
let storage: LocalFolderStorage;

beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "media-storage-"));
  root = path.join(sandbox, "media");
  storage = new LocalFolderStorage(root);
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

// Every file and folder under a directory, relative and sorted, so assertions read the same on any OS.
async function listTree(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    names.push(relative);
    if (entry.isDirectory()) names.push(...(await listTree(path.join(directory, entry.name), relative)));
  }
  return names.sort();
}

// Collects what the storage streams, for assertions only: production code never collects the whole list.
async function listObjects(): Promise<Array<{ key: string; lastModified: Date; size: number }>> {
  const objects = [];
  for await (const object of storage.listObjects()) objects.push(object);
  return objects;
}

describe("LocalFolderStorage constructor", () => {
  it("rejects a relative root, which would depend on the working directory", () => {
    expect(() => new LocalFolderStorage("media")).toThrow();
  });
});

describe("LocalFolderStorage.put", () => {
  it("writes the bytes exactly and creates the nested folder", async () => {
    const data = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x7f]);
    await storage.put("name-1700000000000-abc123/preview.jpg", data);

    const written = await readFile(path.join(root, "name-1700000000000-abc123", "preview.jpg"));
    expect(written.equals(data)).toBe(true);
  });

  it("leaves no temporary file behind after a successful write", async () => {
    await storage.put("folder/file.jpg", Buffer.from("x"));
    expect(await listTree(root)).toEqual(["folder", "folder/file.jpg"]);
  });

  it("replaces an existing object under the same key", async () => {
    await storage.put("folder/file.jpg", Buffer.from("old"));
    await storage.put("folder/file.jpg", Buffer.from("new"));
    expect((await readFile(path.join(root, "folder", "file.jpg"))).toString()).toBe("new");
  });

  it("stops on an aborted signal, leaves neither the object nor a temporary file, and reports a timeout", async () => {
    await mkdir(path.join(root, "folder"), { recursive: true });
    const expired = AbortSignal.abort();

    await expect(storage.put("folder/file.jpg", Buffer.from("x"), { signal: expired })).rejects.toBeInstanceOf(StorageTimeoutError);
    expect(await listTree(root)).toEqual(["folder"]);
  });

  it("cleans up its temporary file when the write fails", async () => {
    // A file where the folder should be makes mkdir fail after the key has passed validation.
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "blocked"), "not a folder");

    await expect(storage.put("blocked/file.jpg", Buffer.from("x"))).rejects.toBeInstanceOf(StorageError);
    expect(await listTree(root)).toEqual(["blocked"]);
  });
});

describe("LocalFolderStorage key validation", () => {
  const badKeys = ["", "/absolute.jpg", "../escape.jpg", "a/../../escape.jpg", "a//b.jpg", "a/./b.jpg", ".hidden/x.jpg", ".env", "folder/.tmp.jpg", "a\\b.jpg", "a/b c.jpg"];

  it.each(badKeys)("refuses %j and writes nothing outside the root", async (key) => {
    await expect(storage.put(key, Buffer.from("x"))).rejects.toBeInstanceOf(InvalidStorageKeyError);
    // Validation runs before anything touches the disk, so not even the root folder is created.
    expect(await listTree(sandbox)).toEqual([]);
  });

  it("reports a bad key from remove as failed without throwing for the whole batch", async () => {
    await storage.put("ok/file.jpg", Buffer.from("x"));
    const result = await storage.remove(["../etc/passwd", "ok/file.jpg"]);

    expect(result.failed).toEqual([{ key: "../etc/passwd", reason: "INVALID_STORAGE_KEY" }]);
    expect(result.removed).toEqual(["ok/file.jpg"]);
  });
});

describe("LocalFolderStorage.remove", () => {
  it("removes existing objects and prunes folders left empty", async () => {
    await storage.put("folder/a.jpg", Buffer.from("a"));
    await storage.put("folder/b.jpg", Buffer.from("b"));

    const result = await storage.remove(["folder/a.jpg"]);
    expect(result).toEqual({ removed: ["folder/a.jpg"], failed: [] });
    expect(await listTree(root)).toEqual(["folder", "folder/b.jpg"]);

    await storage.remove(["folder/b.jpg"]);
    expect(await listTree(root)).toEqual([]);
  });

  it("treats a missing object as removed, so a retry is safe", async () => {
    const result = await storage.remove(["never/existed.jpg"]);
    expect(result).toEqual({ removed: ["never/existed.jpg"], failed: [] });
  });

  it("never prunes the root folder itself", async () => {
    await storage.put("only/file.jpg", Buffer.from("x"));
    await storage.remove(["only/file.jpg"]);
    expect((await stat(root)).isDirectory()).toBe(true);
  });
});

describe("LocalFolderStorage.list", () => {
  it("returns every object with its key, size and time, using forward slashes", async () => {
    await storage.put("one/preview.jpg", Buffer.from("123"));
    await storage.put("one/thumb.jpg", Buffer.from("45"));

    const objects = await listObjects();
    expect(objects.map((object) => object.key).sort()).toEqual(["one/preview.jpg", "one/thumb.jpg"]);
    expect(objects.find((object) => object.key === "one/preview.jpg")?.size).toBe(3);
    expect(objects[0].lastModified).toBeInstanceOf(Date);
  });

  it("skips temporary and hidden files", async () => {
    await storage.put("one/preview.jpg", Buffer.from("x"));
    await writeFile(path.join(root, "one", ".preview.jpg.abcdef.tmp"), "half written");

    const keys = (await listObjects()).map((object) => object.key);
    expect(keys).toEqual(["one/preview.jpg"]);
  });

  it("returns an empty list when the root does not exist yet", async () => {
    expect(await listObjects()).toEqual([]);
  });
});

describe("LocalFolderStorage.removeStaleTemp", () => {
  it("removes only temporary files older than the cutoff", async () => {
    await mkdir(path.join(root, "folder"), { recursive: true });
    const oldTemp = path.join(root, "folder", ".old.jpg.aaaaaa.tmp");
    const freshTemp = path.join(root, "folder", ".fresh.jpg.bbbbbb.tmp");
    await writeFile(oldTemp, "old");
    await writeFile(freshTemp, "fresh");
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(oldTemp, twoHoursAgo, twoHoursAgo);

    const removed = await storage.removeStaleTemp(60 * 60 * 1000);

    expect(removed).toBe(1);
    expect(await listTree(root)).toEqual(["folder", "folder/.fresh.jpg.bbbbbb.tmp"]);
  });
});

describe("LocalFolderStorage.removeStaleTemp folder cleanup", () => {
  it("removes a folder that held only the stale temporary file", async () => {
    await mkdir(path.join(root, "lonely"), { recursive: true });
    const oldTemp = path.join(root, "lonely", ".x.jpg.aaaaaa.tmp");
    await writeFile(oldTemp, "old");
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await utimes(oldTemp, twoHoursAgo, twoHoursAgo);

    await storage.removeStaleTemp(60 * 60 * 1000);

    expect(await listTree(root)).toEqual([]);
  });
});

describe("LocalFolderStorage symbolic links", () => {
  it("refuses to write through a link that points outside the folder, and writes nothing there", async () => {
    const outside = path.join(sandbox, "outside");
    await mkdir(outside, { recursive: true });
    await mkdir(root, { recursive: true });
    await symlink(outside, path.join(root, "escape"));

    await expect(storage.put("escape/file.jpg", Buffer.from("x"))).rejects.toBeInstanceOf(InvalidStorageKeyError);
    expect(await listTree(outside)).toEqual([]);
  });
});

describe("LocalFolderStorage free space", () => {
  it("refuses a write when less than the minimum is free, writes nothing, and says the disk is full", async () => {
    // A threshold no disk can meet stands in for a nearly full disk, so the test does not depend on the machine.
    const strict = new LocalFolderStorage(root, { minFreeBytes: Number.MAX_SAFE_INTEGER });

    await expect(strict.put("folder/file.jpg", Buffer.from("x"))).rejects.toBeInstanceOf(StorageFullError);
    expect(await listObjects()).toEqual([]);
  });
});

describe("LocalFolderStorage.existingKeys", () => {
  it("returns only the keys that exist as files", async () => {
    await storage.put("one/preview.jpg", Buffer.from("x"));

    const present = await storage.existingKeys(["one/preview.jpg", "one/missing.jpg", "two/nothing.jpg"]);
    expect([...present]).toEqual(["one/preview.jpg"]);
  });

  it("does not count a folder as a stored object", async () => {
    await storage.put("one/preview.jpg", Buffer.from("x"));
    expect((await storage.existingKeys(["one"])).size).toBe(0);
  });

  it("treats an invalid key as absent instead of throwing for the whole batch", async () => {
    await storage.put("ok/file.jpg", Buffer.from("x"));
    const present = await storage.existingKeys(["../escape.jpg", "ok/file.jpg"]);
    expect([...present]).toEqual(["ok/file.jpg"]);
  });
});

describe("LocalFolderStorage.ensureReady", () => {
  it("creates the root folder when it is missing", async () => {
    await storage.ensureReady();
    expect((await stat(root)).isDirectory()).toBe(true);
  });

  it("fails with StorageUnavailableError when the root cannot be written", async () => {
    // Skipped under root, where permissions do not block writes.
    if (process.getuid?.() === 0) return;
    await mkdir(root, { recursive: true });
    await chmod(root, 0o500);
    try {
      await expect(storage.ensureReady()).rejects.toBeInstanceOf(StorageUnavailableError);
    } finally {
      await chmod(root, 0o700);
    }
  });
});

describe("toStorageError", () => {
  function osError(code: string): Error {
    return Object.assign(new Error(`${code}: /srv/secret/path`), { code });
  }

  it("maps a full disk to StorageFullError (507)", () => {
    const error = toStorageError(osError("ENOSPC"));
    expect(error).toBeInstanceOf(StorageFullError);
    expect(error.statusCode).toBe(507);
  });

  it("maps permission and read-only errors to StorageUnavailableError (503)", () => {
    for (const code of ["EACCES", "EPERM", "EROFS"]) {
      const error = toStorageError(osError(code));
      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect(error.statusCode).toBe(503);
    }
  });

  it("never puts the OS path into the client message", () => {
    const error = toStorageError(osError("ENOSPC"));
    expect(error.message).not.toContain("/srv/secret/path");
    expect(JSON.stringify(error.serialize())).not.toContain("/srv/secret/path");
  });

  it("maps anything unknown to a generic StorageError (500)", () => {
    expect(toStorageError(new Error("boom"))).toBeInstanceOf(StorageError);
  });

  it("keeps an error that is already ours, so a refused key stays a 400", () => {
    const refused = new InvalidStorageKeyError("bad key");
    expect(toStorageError(refused)).toBe(refused);
  });
});
