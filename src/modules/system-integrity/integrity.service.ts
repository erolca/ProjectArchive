import { access, readdir, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { prisma } from "../../lib/prisma";
import { assertInsideStorageRoot, getStorageConfig, toStorageRelativePath } from "../../lib/storage";
import { buildPathFromRelativeStoragePath } from "../storage/storage.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { requirePermission } from "../auth/permissions";
import type { IntegrityCheckSummary, IntegrityIssue, StorageIntegrityScanResult } from "./integrity.types";

const PROJECTS_FOLDER = "projects";
const SETTINGS_ID = 1;

type StorageEntryKind = "file" | "directory" | "other" | "missing";

interface CheckAccumulator {
  key: string;
  label: string;
  warnings: IntegrityIssue[];
  errors: IntegrityIssue[];
}

export async function runStorageIntegrityScan(user: AuthenticatedUser): Promise<StorageIntegrityScanResult> {
  requirePermission(user, "backups:manage");

  const startedAt = Date.now();
  const scannedAt = new Date();
  const storageRoot = getStorageConfig().root;
  const projectsRoot = path.resolve(storageRoot, PROJECTS_FOLDER);
  assertInsideStorageRoot(storageRoot, projectsRoot);

  const [projects, projectFiles, fileVersions, settings, latestBackupRun] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        projectCode: true,
      },
    }),
    prisma.projectFile.findMany({
      where: {
        deletedAt: null,
        project: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        storagePath: true,
        project: {
          select: {
            id: true,
            projectCode: true,
          },
        },
      },
    }),
    prisma.fileVersion.findMany({
      where: {
        file: {
          deletedAt: null,
          project: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        storagePath: true,
        fileId: true,
        file: {
          select: {
            project: {
              select: {
                id: true,
                projectCode: true,
              },
            },
          },
        },
      },
    }),
    prisma.systemSettings.findUnique({
      where: {
        id: SETTINGS_ID,
      },
      select: {
        fileBackupLocation: true,
        lastFileBackupDestination: true,
      },
    }),
    prisma.backupRun.findFirst({
      orderBy: {
        startedAt: "desc",
      },
      select: {
        id: true,
        destination: true,
      },
    }),
  ]);

  const projectFolderCheck = createCheck("project-folders", "Project storage folders");
  const projectFileCheck = createCheck("project-files", "ProjectFile disk references");
  const fileVersionCheck = createCheck("file-versions", "FileVersion disk references");
  const orphanFileCheck = createCheck("orphan-files", "Orphan storage files");
  const backupRootCheck = createCheck("backup-root", "Configured backup root");
  const latestBackupCheck = createCheck("latest-backup-destination", "Latest backup destination");
  const trackedStoragePaths = new Set<string>();

  for (const project of projects) {
    const projectPath = path.resolve(projectsRoot, project.projectCode);
    assertInsideStorageRoot(storageRoot, projectPath);
    const kind = await getStorageEntryKind(projectPath);

    if (kind !== "directory") {
      projectFolderCheck.errors.push({
        severity: "ERROR",
        code: "PROJECT_FOLDER_MISSING",
        message: `Project storage folder is missing for ${project.projectCode}.`,
        path: `${PROJECTS_FOLDER}/${project.projectCode}`,
        entityType: "Project",
        entityId: project.id,
      });
    }
  }

  for (const file of projectFiles) {
    const resolved = resolveTrackedPath(storageRoot, file.storagePath);

    if (!resolved.ok) {
      projectFileCheck.errors.push({
        severity: "ERROR",
        code: "PROJECT_FILE_UNSAFE_PATH",
        message: `Project file has an unsafe storage reference for ${file.project.projectCode}.`,
        path: file.storagePath,
        entityType: "ProjectFile",
        entityId: file.id,
      });
      continue;
    }

    trackedStoragePaths.add(resolved.relativePath);
    const kind = await getStorageEntryKind(resolved.absolutePath);

    if (kind !== "file") {
      projectFileCheck.errors.push({
        severity: "ERROR",
        code: "PROJECT_FILE_MISSING",
        message: `Project file metadata points to a missing file for ${file.project.projectCode}.`,
        path: resolved.relativePath,
        entityType: "ProjectFile",
        entityId: file.id,
      });
    }
  }

  for (const version of fileVersions) {
    const resolved = resolveTrackedPath(storageRoot, version.storagePath);

    if (!resolved.ok) {
      fileVersionCheck.errors.push({
        severity: "ERROR",
        code: "FILE_VERSION_UNSAFE_PATH",
        message: `File version has an unsafe storage reference for ${version.file.project.projectCode}.`,
        path: version.storagePath,
        entityType: "FileVersion",
        entityId: version.id,
      });
      continue;
    }

    trackedStoragePaths.add(resolved.relativePath);
    const kind = await getStorageEntryKind(resolved.absolutePath);

    if (kind !== "file") {
      fileVersionCheck.errors.push({
        severity: "ERROR",
        code: "FILE_VERSION_MISSING",
        message: `File version metadata points to a missing file for ${version.file.project.projectCode}.`,
        path: resolved.relativePath,
        entityType: "FileVersion",
        entityId: version.id,
      });
    }
  }

  const orphanFiles = await collectProjectStorageFiles(storageRoot, projectsRoot);

  for (const orphanPath of orphanFiles.filter((filePath) => !trackedStoragePaths.has(filePath))) {
    orphanFileCheck.warnings.push({
      severity: "WARNING",
      code: "ORPHAN_STORAGE_FILE",
      message: "A file exists in project storage but is not tracked by the database.",
      path: orphanPath,
    });
  }

  await validateExternalFolder(
    settings?.fileBackupLocation,
    backupRootCheck,
    "BACKUP_ROOT_NOT_CONFIGURED",
    "File Backup Location is not configured.",
  );

  await validateExternalFolder(
    settings?.lastFileBackupDestination || latestBackupRun?.destination,
    latestBackupCheck,
    "LATEST_BACKUP_NOT_AVAILABLE",
    "No latest backup destination is available yet.",
  );

  const checks = [
    summarizeCheck(projectFolderCheck),
    summarizeCheck(projectFileCheck),
    summarizeCheck(fileVersionCheck),
    summarizeCheck(orphanFileCheck),
    summarizeCheck(backupRootCheck),
    summarizeCheck(latestBackupCheck),
  ];
  const warnings = checksToIssues(
    projectFolderCheck,
    projectFileCheck,
    fileVersionCheck,
    orphanFileCheck,
    backupRootCheck,
    latestBackupCheck,
  ).filter((issue) => issue.severity === "WARNING");
  const errors = checksToIssues(
    projectFolderCheck,
    projectFileCheck,
    fileVersionCheck,
    orphanFileCheck,
    backupRootCheck,
    latestBackupCheck,
  ).filter((issue) => issue.severity === "ERROR");
  const warningCount = warnings.length;
  const errorCount = errors.length;
  const healthScore = calculateHealthScore(errorCount, warningCount);

  return {
    healthScore,
    status: errorCount > 0 ? "ERROR" : warningCount > 0 ? "WARNING" : "PASSED",
    passedChecks: checks.filter((check) => check.passed).length,
    warningCount,
    errorCount,
    totalChecks: checks.length,
    scanDurationMs: Date.now() - startedAt,
    scannedAt,
    storageRoot,
    projectsRoot,
    checks,
    warnings,
    errors,
  };
}

function createCheck(key: string, label: string): CheckAccumulator {
  return {
    key,
    label,
    warnings: [],
    errors: [],
  };
}

function summarizeCheck(check: CheckAccumulator): IntegrityCheckSummary {
  return {
    key: check.key,
    label: check.label,
    passed: check.warnings.length === 0 && check.errors.length === 0,
    warnings: check.warnings.length,
    errors: check.errors.length,
  };
}

function checksToIssues(...checks: CheckAccumulator[]): IntegrityIssue[] {
  return checks.flatMap((check) => [...check.errors, ...check.warnings]);
}

function calculateHealthScore(errorCount: number, warningCount: number): number {
  return Math.max(0, Math.min(100, 100 - errorCount * 10 - warningCount * 3));
}

function resolveTrackedPath(
  storageRoot: string,
  storagePath: string,
): { ok: true; absolutePath: string; relativePath: string } | { ok: false } {
  try {
    const resolved = buildPathFromRelativeStoragePath(storageRoot, storagePath);

    return {
      ok: true,
      absolutePath: resolved.absolutePath,
      relativePath: resolved.relativePath,
    };
  } catch {
    return {
      ok: false,
    };
  }
}

async function getStorageEntryKind(targetPath: string): Promise<StorageEntryKind> {
  try {
    const targetStat = await stat(targetPath);

    if (targetStat.isFile()) {
      return "file";
    }

    if (targetStat.isDirectory()) {
      return "directory";
    }

    return "other";
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return "missing";
    }

    return "other";
  }
}

async function collectProjectStorageFiles(storageRoot: string, projectsRoot: string): Promise<string[]> {
  const projectsRootKind = await getStorageEntryKind(projectsRoot);

  if (projectsRootKind === "missing") {
    return [];
  }

  if (projectsRootKind !== "directory") {
    return [];
  }

  const files: string[] = [];
  const pendingDirectories = [projectsRoot];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop();

    if (!currentDirectory) {
      continue;
    }

    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.resolve(currentDirectory, entry.name);
      assertInsideStorageRoot(storageRoot, entryPath);

      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
      } else if (entry.isFile()) {
        files.push(toStorageRelativePath(storageRoot, entryPath));
      }
    }
  }

  return files;
}

async function validateExternalFolder(
  configuredPath: string | null | undefined,
  check: CheckAccumulator,
  missingCode: string,
  missingMessage: string,
): Promise<void> {
  if (!configuredPath?.trim()) {
    check.warnings.push({
      severity: "WARNING",
      code: missingCode,
      message: missingMessage,
    });
    return;
  }

  const resolvedPath = path.resolve(configuredPath);
  const kind = await getStorageEntryKind(resolvedPath);

  if (kind !== "directory") {
    check.errors.push({
      severity: "ERROR",
      code: "BACKUP_DESTINATION_UNAVAILABLE",
      message: "Configured backup destination is not available as a readable folder.",
      path: resolvedPath,
    });
    return;
  }

  try {
    await access(resolvedPath, constants.R_OK);
  } catch {
    check.errors.push({
      severity: "ERROR",
      code: "BACKUP_DESTINATION_NOT_READABLE",
      message: "Configured backup destination exists but cannot be read by the application.",
      path: resolvedPath,
    });
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
