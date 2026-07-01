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
  | "SIEMENS_STEP7"
  | "SIEMENS_TIA"
  | "SIEMENS_TIA_PORTAL"
  | "ROCKWELL_STUDIO5000"
  | "OMRON_SYSMAC"
  | "OMRON_SYSMAC_STUDIO"
  | "MITSUBISHI_GX_WORKS"
  | "SCHNEIDER_ECOSTRUXURE"
  | "CODESYS_CODESYS"
  | "BR_AUTOMATION_STUDIO"
  | "WEINTEK"
  | "WEINTEK_EASYBUILDER_PRO"
  | "SIEMENS"
  | "SIEMENS_WINCC"
  | "SIEMENS_WINCC_UNIFIED"
  | "PROFACE"
  | "PROFACE_GP_PRO_EX"
  | "BEIJER_IX_DEVELOPER"
  | "IGNITION_PERSPECTIVE"
  | "CODESYS_VISUALIZATION"
  | "KUKA"
  | "KUKA_KRC4"
  | "KUKA_KRC5"
  | "YASKAWA"
  | "YASKAWA_YRC1000"
  | "YASKAWA_DX200"
  | "ABB"
  | "ABB_IRC5"
  | "ABB_OMNICORE"
  | "FANUC_R30IB"
  | "UNIVERSAL_ROBOTS_POLYSCOPE"
  | "COGNEX_IN_SIGHT"
  | "COGNEX_VISIONPRO"
  | "KEYENCE_CV_X"
  | "KEYENCE_XG_X"
  | "OMRON_FH"
  | "SICK_INSPECTOR"
  | "EPLAN_P8"
  | "AUTOCAD_ELECTRICAL"
  | "SEE_ELECTRICAL"
  | "SOLIDWORKS_ELECTRICAL"
  | "SOLIDWORKS_SOLIDWORKS"
  | "AUTODESK_INVENTOR"
  | "AUTODESK_AUTOCAD"
  | "SIEMENS_SOLID_EDGE"
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
