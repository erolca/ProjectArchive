import type { FileCategory } from "@prisma/client";
import type { PlatformCode, ResolvedStoragePath } from "../storage/storage.types";

export interface PrepareUploadInput {
  projectId: number;
  category: FileCategory;
  platform?: PlatformCode | string | null;
  manufacturer?: string | null;
  softwareName?: string | null;
  softwareVersion?: string | null;
  originalFileName: string;
  fileSize: bigint | number;
  versionNo?: string;
  changeNote?: string;
  confirmWarnings?: boolean;
}

export interface PreparedUpload {
  projectId: number;
  projectCode: string;
  category: FileCategory;
  platform: PlatformCode | "GENERAL";
  manufacturer?: string | null;
  softwareName?: string | null;
  softwareVersion?: string | null;
  originalFileName: string;
  storedFileName: string;
  storagePath: ResolvedStoragePath;
  versionNo: string;
  warnings: string[];
}

export interface FinalizeUploadInput extends PrepareUploadInput {
  tempRelativePath: string;
  checksum?: string;
}

export interface CreateFileVersionInput {
  fileId: number;
  originalFileName: string;
  tempRelativePath: string;
  fileSize: bigint | number;
  versionNo?: string;
  changeNote?: string;
  checksum?: string;
  confirmWarnings?: boolean;
}

export interface DownloadResolution {
  fileId: number;
  projectId: number;
  projectCode: string;
  originalFileName: string;
  storedFileName: string;
  absolutePath: string;
  relativePath: string;
  fileSize: bigint;
  checksum: string;
}

export interface DuplicateFileMatch {
  fileId: number;
  projectId: number;
  projectCode: string;
  originalFileName: string;
  versionNo: string;
  checksum: string;
}
