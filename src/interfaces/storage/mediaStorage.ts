// What the rest of the app needs from file storage, and nothing more. Implementations live next to
// this file (LocalFolderStorage today). Keys are relative paths such as `name-123-abc/preview.jpg`;
// the caller builds them on the server, never from client input.

export interface StoredObject {
  key: string;
  lastModified: Date;
  size: number;
}

export interface RemoveResult {
  // A key that was already absent counts as removed: the goal is "not there", and retries stay safe.
  removed: string[];
  // Keys that could not be removed, with a short reason for the log. Never includes OS paths.
  failed: Array<{ key: string; reason: string }>;
}

export interface MediaStorage {
  // Creates the root folder if needed and proves it is writable. Throws StorageUnavailableError otherwise.
  ensureReady(): Promise<void>;
  // Writes the bytes under the key atomically: a reader sees the whole file or no file, never a part.
  // When `signal` aborts first, the write stops, nothing is left under the key and the call throws
  // StorageTimeoutError. A caller that wants a time limit passes AbortSignal.timeout(ms).
  put(key: string, data: Buffer, options?: { signal?: AbortSignal }): Promise<void>;
  remove(keys: string[]): Promise<RemoveResult>;
  // Yields stored objects one at a time, so memory does not grow with the number of files. Temporary
  // files of unfinished writes are not objects and are not yielded.
  listObjects(): AsyncIterable<StoredObject>;
  // The subset of `keys` that exist as objects. The caller passes batches, not the whole folder.
  existingKeys(keys: string[]): Promise<Set<string>>;
  // Deletes temporary files older than the given age (left behind by a crash mid-write). Returns how many.
  removeStaleTemp(olderThanMs: number): Promise<number>;
}
