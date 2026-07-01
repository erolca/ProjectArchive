import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildStoragePath,
  buildStoragePathFromRoot,
  getStorageConfig,
  toStorageRelativePath,
} from "../../lib/storage";
import {
  buildStoredFileName,
  calculateSha256,
  resolveCategoryPlatform,
  resolveFolderSegments,
  validateProjectCode,
} from "../../lib/file-utils";
import type {
  FileCategory,
  FileClassificationInput,
  PlatformCode,
  ProjectFolderPaths,
  ResolvedStoragePath,
  StorageConfig,
  StoredFileNameInput,
} from "./storage.types";

const STANDARD_PROJECT_FOLDERS: string[][] = [
  ["PLC"],
  ["PLC", "BECKHOFF_TWINCAT2"],
  ["PLC", "BECKHOFF_TWINCAT3"],
  ["PLC", "SIEMENS_TIA"],
  ["PLC", "OMRON_SYSMAC"],
  ["HMI"],
  ["HMI", "WEINTEK"],
  ["HMI", "SIEMENS"],
  ["HMI", "PROFACE"],
  ["ROBOT"],
  ["ROBOT", "KUKA"],
  ["ROBOT", "YASKAWA"],
  ["ROBOT", "ABB"],
  ["ELECTRICAL"],
  ["MECHANICAL"],
  ["PNEUMATIC"],
  ["VISION"],
  ["CAMERA"],
  ["PHOTOS"],
  ["VIDEOS"],
  ["FAT"],
  ["SAT"],
  ["SPARE_PARTS"],
  ["DOCUMENTS"],
  ["PHOTO_VIDEO"],
  ["BACKUPS"],
  ["COMMISSIONING"],
  ["SERVICE"],
];

export function getActiveStorageConfig(): StorageConfig {
  return getStorageConfig();
}

export function getProjectRootPath(projectCode: string): ResolvedStoragePath {
  const safeProjectCode = validateProjectCode(projectCode);

  return buildStoragePath("projects", safeProjectCode);
}

export function getProjectFolderPath(
  projectCode: string,
  folderSegments: string[],
): ResolvedStoragePath {
  const safeProjectCode = validateProjectCode(projectCode);

  return buildStoragePath("projects", safeProjectCode, ...folderSegments);
}

export function getCategoryFolderPath(
  projectCode: string,
  category: FileCategory,
  platform?: PlatformCode | "GENERAL",
): ResolvedStoragePath {
  return getProjectFolderPath(projectCode, resolveFolderSegments(category, platform));
}

export function buildProjectFileStoragePath(input: StoredFileNameInput): ResolvedStoragePath {
  const resolution = resolveCategoryPlatform({
    category: input.category,
    originalFileName: input.originalFileName,
    platform: input.platform,
  });
  const storedFileName = buildStoredFileName(input);

  return getProjectFolderPath(input.projectCode, [...resolution.folderSegments, storedFileName]);
}

export async function createProjectFolders(projectCode: string): Promise<ProjectFolderPaths> {
  const safeProjectCode = validateProjectCode(projectCode);
  const projectRoot = buildStoragePath("projects", safeProjectCode);
  const categoryFolders: Record<string, ResolvedStoragePath> = {};

  await mkdir(projectRoot.absolutePath, { recursive: true });

  for (const folderSegments of STANDARD_PROJECT_FOLDERS) {
    const folderPath = buildStoragePath("projects", safeProjectCode, ...folderSegments);
    await mkdir(folderPath.absolutePath, { recursive: true });
    categoryFolders[folderSegments.join("/")] = folderPath;
  }

  return {
    projectRoot,
    categoryFolders,
  };
}

export async function calculateStoredFileSha256(relativeStoragePath: string): Promise<string> {
  const { root } = getStorageConfig();
  const resolved = buildPathFromRelativeStoragePath(root, relativeStoragePath);

  await assertFileExists(resolved.absolutePath);

  return calculateSha256(resolved.absolutePath);
}

export function classifyStorageTarget(input: FileClassificationInput) {
  return resolveCategoryPlatform(input);
}

export function buildPathFromRelativeStoragePath(
  storageRoot: string,
  relativeStoragePath: string,
): ResolvedStoragePath {
  const segments = relativeStoragePath.split(/[\\/]+/).filter(Boolean);
  const resolved = buildStoragePathFromRoot(storageRoot, ...segments);

  return {
    absolutePath: resolved.absolutePath,
    relativePath: toStorageRelativePath(storageRoot, resolved.absolutePath),
  };
}

export async function moveStoredFile(
  sourceRelativePath: string,
  destination: ResolvedStoragePath,
): Promise<void> {
  const { root } = getStorageConfig();
  const source = buildPathFromRelativeStoragePath(root, sourceRelativePath);

  await assertFileExists(source.absolutePath);
  await mkdir(path.dirname(destination.absolutePath), { recursive: true });
  await rename(source.absolutePath, destination.absolutePath);
}

export async function stageTempUpload(fileName: string, bytes: Uint8Array): Promise<ResolvedStoragePath> {
  const stagedPath = buildStoragePath("temp", "uploads", `${Date.now()}_${fileName}`);

  await mkdir(path.dirname(stagedPath.absolutePath), { recursive: true });
  await writeFile(stagedPath.absolutePath, bytes);

  return stagedPath;
}

async function assertFileExists(filePath: string): Promise<void> {
  const fileStat = await stat(filePath);

  if (!fileStat.isFile()) {
    throw new Error("Storage path is not a file.");
  }
}
