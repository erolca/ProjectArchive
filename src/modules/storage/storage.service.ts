import { spawn } from "node:child_process";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertInsideStorageRoot,
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

export async function renameProjectFolder(
  oldProjectCode: string,
  newProjectCode: string,
): Promise<{ source: ResolvedStoragePath; target: ResolvedStoragePath }> {
  const safeOldProjectCode = validateProjectCode(oldProjectCode);
  const safeNewProjectCode = validateProjectCode(newProjectCode);
  const source = buildStoragePath("projects", safeOldProjectCode);
  const target = buildStoragePath("projects", safeNewProjectCode);

  await assertDirectoryExists(source.absolutePath, "Source project storage folder was not found.");
  await assertDirectoryDoesNotExist(target.absolutePath, "Target project storage folder already exists.");
  await mkdir(path.dirname(target.absolutePath), { recursive: true });
  await rename(source.absolutePath, target.absolutePath);
  await createProjectFolders(safeNewProjectCode);

  return {
    source,
    target,
  };
}

export async function openProjectFolderInExplorer(projectCode: string): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("Opening local folders is only available when ProjectArchive is running locally on Windows.");
  }

  const projectsRoot = buildStoragePath("projects");
  const projectRoot = getProjectRootPath(projectCode);

  try {
    assertInsideStorageRoot(projectsRoot.absolutePath, projectRoot.absolutePath);
  } catch {
    throw new Error("Project folder could not be opened safely.");
  }

  try {
    await assertDirectoryExists(projectRoot.absolutePath, "Project folder could not be found.");
  } catch (error) {
    if (error instanceof Error && error.message === "Project folder could not be found.") {
      throw error;
    }

    throw new Error("Project folder could not be opened.");
  }

  await launchWindowsExplorer(projectRoot.absolutePath);
}

export async function listProjectStorageFiles(projectCode: string): Promise<{ folderExists: boolean; files: string[] }> {
  const projectsRoot = buildStoragePath("projects");
  const projectRoot = getProjectRootPath(projectCode);

  assertProjectPathInsideProjectsRoot(projectsRoot.absolutePath, projectRoot.absolutePath);

  const projectRootKind = await getStorageEntryKind(projectRoot.absolutePath);

  if (projectRootKind === "missing") {
    return {
      folderExists: false,
      files: [],
    };
  }

  if (projectRootKind !== "directory") {
    throw new Error("Project storage folder could not be inspected.");
  }

  return {
    folderExists: true,
    files: await collectStorageFiles(projectsRoot.absolutePath, projectRoot.absolutePath),
  };
}

export async function deleteProjectStorageFolder(projectCode: string): Promise<void> {
  const projectsRoot = buildStoragePath("projects");
  const projectRoot = getProjectRootPath(projectCode);

  assertProjectPathInsideProjectsRoot(projectsRoot.absolutePath, projectRoot.absolutePath);

  const projectRootKind = await getStorageEntryKind(projectRoot.absolutePath);

  if (projectRootKind === "missing") {
    return;
  }

  if (projectRootKind !== "directory") {
    throw new Error("Project storage folder could not be removed safely.");
  }

  await rm(projectRoot.absolutePath, {
    recursive: true,
    force: false,
  });
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

async function assertDirectoryExists(directoryPath: string, message: string): Promise<void> {
  try {
    const directoryStat = await stat(directoryPath);

    if (!directoryStat.isDirectory()) {
      throw new Error(message);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(message);
    }

    throw error;
  }
}

async function assertDirectoryDoesNotExist(directoryPath: string, message: string): Promise<void> {
  try {
    await stat(directoryPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  throw new Error(message);
}

function assertProjectPathInsideProjectsRoot(projectsRootPath: string, projectPath: string): void {
  try {
    assertInsideStorageRoot(projectsRootPath, projectPath);
  } catch {
    throw new Error("Project storage folder could not be resolved safely.");
  }
}

async function getStorageEntryKind(targetPath: string): Promise<"directory" | "file" | "other" | "missing"> {
  try {
    const targetStat = await stat(targetPath);

    if (targetStat.isDirectory()) {
      return "directory";
    }

    if (targetStat.isFile()) {
      return "file";
    }

    return "other";
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "missing";
    }

    return "other";
  }
}

async function collectStorageFiles(projectsRootPath: string, rootDirectoryPath: string): Promise<string[]> {
  const files: string[] = [];
  const pendingDirectories = [rootDirectoryPath];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    if (!currentDirectory) {
      continue;
    }

    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.resolve(currentDirectory, entry.name);
      assertProjectPathInsideProjectsRoot(projectsRootPath, entryPath);

      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (entry.isFile()) {
        files.push(toStorageRelativePath(path.dirname(projectsRootPath), entryPath));
      }
    }
  }

  return files;
}

async function launchWindowsExplorer(directoryPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("explorer.exe", [directoryPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });

    child.once("error", () => {
      reject(new Error("Project folder could not be opened."));
    });

    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}
