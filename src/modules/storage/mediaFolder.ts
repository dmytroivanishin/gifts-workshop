import path from "node:path";
import { env } from "@/modules/core/env";

// Where stored media lives on disk: one folder per bucket name, under .docker/media in the project root.
// Nothing new to configure: the folder is named after S3_BUCKET_NAME, and the public URL keeps its existing
// shape <S3_PUBLIC_URL>/<bucket>/<key>, so every media row already in the database stays valid. The relative
// path is the same in dev (project root) and in the container (WORKDIR /app, folder mounted as a volume).
export function mediaFolderRoot(): string {
  return path.join(process.cwd(), ".docker", "media", env.S3_BUCKET_NAME);
}

// The base that stored URLs start with, the same prefix StorageService already builds.
export function mediaPublicBaseUrl(): string {
  return `${new URL(env.S3_PUBLIC_URL).href.replace(/\/+$/, "")}/${env.S3_BUCKET_NAME}`;
}
