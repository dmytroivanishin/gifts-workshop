export interface ProcessedImageResult {
  originalUrl: string;
  thumbnailUrl: string;
  displayName: string;
  width: number;
  height: number;
  orientation: "Portrait" | "Landscape";
}
