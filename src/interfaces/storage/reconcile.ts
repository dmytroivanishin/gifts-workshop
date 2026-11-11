export interface MediaUrls {
  originalUrl: string;
  thumbnailUrl: string;
}

export interface OrphanScanOptions {
  publicBaseUrl: string;
  // An upload writes its file before its row exists, so a file younger than this is never reported.
  minAgeMs: number;
  now: Date;
  batchSize?: number;
}
