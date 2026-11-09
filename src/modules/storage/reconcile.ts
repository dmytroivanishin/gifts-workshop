export interface BucketObject {
  key: string;
  lastModified: Date;
}

export interface MediaUrls {
  originalUrl: string;
  thumbnailUrl: string;
}

export interface ReconcileReport {
  // In the bucket, referenced by no media row (and old enough that no upload can still be in flight).
  orphanKeys: string[];
  // Referenced by a media row, absent from the bucket: the image is broken on the site.
  missingKeys: string[];
}

// An upload writes its objects before the row exists, so a fresh object without a row is normal, not an orphan.
export function reconcileMedia(
  objects: BucketObject[],
  rows: MediaUrls[],
  publicBaseUrl: string,
  minAgeMs: number,
  now: Date = new Date()
): ReconcileReport {
  const prefix = `${publicBaseUrl}/`;
  const referenced = new Set<string>();
  for (const { originalUrl, thumbnailUrl } of rows) {
    for (const url of [originalUrl, thumbnailUrl]) {
      // Rows can hold externally hosted URLs, which are not ours to check.
      if (url && url.startsWith(prefix)) referenced.add(url.slice(prefix.length));
    }
  }

  const present = new Set(objects.map((object) => object.key));
  const orphanKeys = objects
    .filter((object) => !referenced.has(object.key) && now.getTime() - object.lastModified.getTime() >= minAgeMs)
    .map((object) => object.key);
  const missingKeys = [...referenced].filter((key) => !present.has(key));

  return { orphanKeys, missingKeys };
}
