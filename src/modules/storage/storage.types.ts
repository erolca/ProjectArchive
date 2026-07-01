export type StorageProvider = "LOCAL" | "NAS";

export type FileCategory =
  | "PLC"
  | "HMI"
  | "ROBOT"
  | "ELECTRICAL"
  | "MECHANICAL"
  | "PNEUMATIC"
  | "VISION"
  | "CAMERA"
  | "PHOTO"
  | "VIDEO"
  | "FAT"
  | "SAT"
  | "SPARE_PARTS"
  | "DOCUMENT"
  | "PHOTO_VIDEO"
  | "BACKUP"
  | "COMMISSIONING"
  | "SERVICE";

export type PlatformCode =
  | "BECKHOFF_TWINCAT2"
  | "BECKHOFF_TWINCAT3"
  | "SIEMENS_TIA"
  | "OMRON_SYSMAC"
  | "WEINTEK"
  | "SIEMENS"
  | "PROFACE"
  | "KUKA"
  | "YASKAWA"
  | "ABB"
  | "GENERAL";

export interface StorageConfig {
  root: string;
  provider: StorageProvider;
}

export interface ResolvedStoragePath {
  absolutePath: string;
  relativePath: string;
}

export interface ProjectFolderPaths {
  projectRoot: ResolvedStoragePath;
  categoryFolders: Record<string, ResolvedStoragePath>;
}

export interface StoredFileNameInput {
  projectCode: string;
  category: FileCategory;
  platform?: PlatformCode | string | null;
  version: string;
  date?: Date;
  originalFileName: string;
}

export interface CategoryPlatformResolution {
  category: FileCategory;
  platform: PlatformCode | "GENERAL";
  folderSegments: string[];
  warnings: string[];
}

export interface FileClassificationInput {
  category: FileCategory;
  originalFileName: string;
  platform?: PlatformCode | string | null;
}
