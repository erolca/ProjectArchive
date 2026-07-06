import { access, copyFile, mkdir, readdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { ActivityAction } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { calculateSha256 } from "../../lib/file-utils";
import { getStorageConfig } from "../../lib/storage";
import { logActivity } from "../activity/activity.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { hasPermission, requirePermission } from "../auth/permissions";
import type {
  BackupHistoryItem,
  BackupProgressDto,
  BackupRunSummary,
  BackupStatus,
  BackupStatusDto,
  BackupValidationResult,
  BackupVerificationResult,
} from "./backup.types";

const SETTINGS_ID = 1;
const PROJECTS_FOLDER = "projects";
let backupRunning = false;
let currentBackupProgress: BackupProgressDto | null = null;

export async function getBackupStatus(
  user: AuthenticatedUser,
  options: { validate?: boolean } = {},
): Promise<BackupStatusDto> {
  const settings = await getOrCreateSettings();
  const storageRoot = getStorageConfig().root;
  const sourcePath = path.resolve(storageRoot, PROJECTS_FOLDER);
  const validation = options.validate ? await validateBackupLocation(user) : undefined;

  return {
    storageRoot,
    sourcePath,
    destination: settings.fileBackupLocation,
    status: backupRunning ? "RUNNING" : normalizeStatus(settings.lastFileBackupStatus),
    lastBackup: {
      startedAt: settings.lastFileBackupStartedAt,
      finishedAt: settings.lastFileBackupFinishedAt,
      durationMs: settings.lastFileBackupDurationMs,
      status: settings.lastFileBackupStatus,
      size: settings.lastFileBackupSize,
      result: settings.lastFileBackupResult,
      destination: settings.lastFileBackupDestination,
    },
    validation,
  };
}

export async function validateBackupLocation(user: AuthenticatedUser): Promise<BackupValidationResult> {
  requirePermission(user, "backups:manage");

  const settings = await getOrCreateSettings();

  try {
    const destination = await resolveAndValidateDestination(settings.fileBackupLocation);

    return {
      valid: true,
      destination,
      message: "Backup location is valid and writable.",
    };
  } catch (error) {
    return {
      valid: false,
      destination: settings.fileBackupLocation,
      message: error instanceof Error ? error.message : "Backup location is invalid.",
    };
  }
}

export function getBackupProgress(user: AuthenticatedUser): BackupProgressDto {
  requirePermission(user, "backups:manage");

  if (currentBackupProgress) {
    const elapsedMs = calculateProgressElapsed(currentBackupProgress);
    const progress = {
      ...currentBackupProgress,
      elapsedMs,
    };

    return {
      ...progress,
      estimatedRemainingMs: calculateEstimatedRemaining(progress),
      transferSpeedBytesPerSecond: calculateTransferSpeed(progress),
      updatedAt: new Date(),
    };
  }

  return {
    status: "IDLE",
    overallProgress: 0,
    currentProject: null,
    currentCategory: null,
    currentFile: null,
    filesProcessed: 0,
    totalFiles: 0,
    projectsProcessed: 0,
    totalProjects: 0,
    bytesProcessed: BigInt(0),
    totalBytes: BigInt(0),
    elapsedMs: 0,
    estimatedRemainingMs: null,
    transferSpeedBytesPerSecond: null,
    startedAt: null,
    updatedAt: new Date(),
  };
}

export async function listBackupHistory(user: AuthenticatedUser): Promise<BackupHistoryItem[]> {
  if (!hasPermission(user.role, "backups:manage") && !hasPermission(user.role, "activity:read")) {
    throw new Error("Permission denied.");
  }

  return prisma.backupRun.findMany({
    orderBy: {
      startedAt: "desc",
    },
    take: 50,
    include: {
      executedBy: {
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
        },
      },
    },
  });
}

export async function runProjectStorageBackup(user: AuthenticatedUser): Promise<BackupRunSummary> {
  requirePermission(user, "backups:manage");

  if (backupRunning) {
    throw new Error("Backup is already running.");
  }

  backupRunning = true;
  const startedAt = new Date();
  const storageRoot = getStorageConfig().root;
  const sourceRoot = path.resolve(storageRoot, PROJECTS_FOLDER);
  const settings = await getOrCreateSettings();
  const destinationRoot = await resolveAndValidateDestination(settings.fileBackupLocation);
  const destinationProjectsRoot = path.resolve(destinationRoot, PROJECTS_FOLDER);
  const backupRun = await prisma.backupRun.create({
    data: {
      startedAt,
      status: "RUNNING",
      destination: destinationRoot,
      executedById: user.id,
    },
  });

  await prisma.systemSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      lastFileBackupStartedAt: startedAt,
      lastFileBackupFinishedAt: null,
      lastFileBackupDurationMs: null,
      lastFileBackupStatus: "RUNNING",
      lastFileBackupDestination: destinationRoot,
    },
  });

  await logActivity({
    userId: user.id,
    action: ActivityAction.BACKUP_STARTED,
    entityType: "SystemSettings",
    entityId: SETTINGS_ID,
    details: `Project storage backup started. Destination: ${destinationRoot}.`,
  });

  currentBackupProgress = createInitialBackupProgress(startedAt);

  try {
    await assertSourceProjectsFolder(sourceRoot);
    await mkdir(destinationProjectsRoot, { recursive: true });

    const sourceInventory = await scanBackupSource(sourceRoot);
    updateBackupProgress({
      totalFiles: sourceInventory.totalFiles,
      totalProjects: sourceInventory.totalProjects,
      totalBytes: sourceInventory.totalBytes,
    });

    const checksumByRelativePath = await getChecksumByRelativePath();
    const summary = await copyProjectsIncrementally({
      sourceRoot,
      destinationRoot: destinationProjectsRoot,
      storageRoot,
      checksumByRelativePath,
      startedAt,
      destination: destinationRoot,
      processedProjects: new Set<string>(),
    });

    await prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        lastFileBackupFinishedAt: summary.finishTime,
        lastFileBackupDurationMs: summary.elapsedMs,
        lastFileBackupStatus: summary.filesFailed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        lastFileBackupSize: summary.totalSize,
        lastFileBackupResult: toPersistedSummary(summary),
        lastFileBackupDestination: destinationRoot,
      },
    });

    await prisma.backupRun.update({
      where: {
        id: backupRun.id,
      },
      data: {
        finishedAt: summary.finishTime,
        durationMs: summary.elapsedMs,
        status: summary.filesFailed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
        filesCopied: summary.filesCopied,
        filesSkipped: summary.filesSkipped,
        filesFailed: summary.filesFailed,
        totalFiles: summary.totalFiles,
        totalSize: summary.totalSize,
        result: toPersistedSummary(summary),
      },
    });

    await logActivity({
      userId: user.id,
      action: ActivityAction.BACKUP_COMPLETED,
      entityType: "SystemSettings",
      entityId: SETTINGS_ID,
      details: buildActivityDetails(summary),
    });

    updateBackupProgress({
      status: summary.filesFailed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED",
      overallProgress: 100,
      filesProcessed: summary.totalFiles,
      projectsProcessed: currentBackupProgress?.totalProjects || 0,
      bytesProcessed: summary.totalSize,
      currentProject: null,
      currentCategory: null,
      currentFile: null,
    });

    return summary;
  } catch (error) {
    const finishTime = new Date();
    const elapsedMs = finishTime.getTime() - startedAt.getTime();
    const message = error instanceof Error ? error.message : "Backup failed.";
    const failedSummary: BackupRunSummary = {
      filesCopied: 0,
      filesSkipped: 0,
      filesFailed: 1,
      totalFiles: 0,
      totalSize: BigInt(0),
      elapsedMs,
      startTime: startedAt,
      finishTime,
      destination: destinationRoot,
      errors: [message],
    };

    await prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        lastFileBackupFinishedAt: finishTime,
        lastFileBackupDurationMs: elapsedMs,
        lastFileBackupStatus: "FAILED",
        lastFileBackupSize: BigInt(0),
        lastFileBackupResult: toPersistedSummary(failedSummary),
        lastFileBackupDestination: destinationRoot,
      },
    });

    await prisma.backupRun.update({
      where: {
        id: backupRun.id,
      },
      data: {
        finishedAt: finishTime,
        durationMs: elapsedMs,
        status: "FAILED",
        filesFailed: 1,
        totalSize: BigInt(0),
        result: toPersistedSummary(failedSummary),
      },
    });

    await logActivity({
      userId: user.id,
      action: ActivityAction.BACKUP_FAILED,
      entityType: "SystemSettings",
      entityId: SETTINGS_ID,
      details: `Project storage backup failed after ${elapsedMs} ms. Destination: ${destinationRoot}. Error: ${message}`,
    });

    updateBackupProgress({
      status: "FAILED",
      currentProject: null,
      currentCategory: null,
      currentFile: null,
    });

    throw error;
  } finally {
    backupRunning = false;
  }
}

export async function verifyProjectStorageBackup(user: AuthenticatedUser): Promise<BackupVerificationResult> {
  requirePermission(user, "backups:manage");

  const startedAt = new Date();
  const storageRoot = getStorageConfig().root;
  const sourceRoot = path.resolve(storageRoot, PROJECTS_FOLDER);
  const settings = await getOrCreateSettings();
  const destinationRoot = await resolveAndValidateDestination(settings.fileBackupLocation);
  const destinationProjectsRoot = path.resolve(destinationRoot, PROJECTS_FOLDER);

  await logActivity({
    userId: user.id,
    action: ActivityAction.BACKUP_VERIFICATION_STARTED,
    entityType: "SystemSettings",
    entityId: SETTINGS_ID,
    details: `Project storage backup verification started. Destination: ${destinationRoot}.`,
  });

  try {
    await assertSourceProjectsFolder(sourceRoot);
    await assertSourceProjectsFolder(destinationProjectsRoot);

    const checksumByRelativePath = await getChecksumByRelativePath();
    const result = await verifyProjectsMirror({
      sourceRoot,
      destinationRoot: destinationProjectsRoot,
      storageRoot,
      checksumByRelativePath,
      startedAt,
      destination: destinationRoot,
    });

    await logActivity({
      userId: user.id,
      action: ActivityAction.BACKUP_VERIFICATION_COMPLETED,
      entityType: "SystemSettings",
      entityId: SETTINGS_ID,
      details: [
        `Backup verification ${result.status}.`,
        `Destination: ${destinationRoot}.`,
        `Verified: ${result.verified}.`,
        `Verified with timestamp warning: ${result.verifiedWithTimestampWarning}.`,
        `Missing: ${result.missing}.`,
        `Checksum mismatch: ${result.checksumMismatch}.`,
        `Size mismatch: ${result.sizeMismatch}.`,
        `Corrupted: ${result.corrupted}.`,
      ].join(" "),
    });

    return result;
  } catch (error) {
    const finishTime = new Date();
    const message = error instanceof Error ? error.message : "Backup verification failed.";

    await logActivity({
      userId: user.id,
      action: ActivityAction.BACKUP_VERIFICATION_FAILED,
      entityType: "SystemSettings",
      entityId: SETTINGS_ID,
      details: `Project storage backup verification failed after ${finishTime.getTime() - startedAt.getTime()} ms. Destination: ${destinationRoot}. Error: ${message}`,
    });

    throw error;
  }
}

async function copyProjectsIncrementally(input: {
  sourceRoot: string;
  destinationRoot: string;
  storageRoot: string;
  checksumByRelativePath: Map<string, string>;
  startedAt: Date;
  destination: string;
  processedProjects: Set<string>;
}): Promise<BackupRunSummary> {
  const summary = {
    filesCopied: 0,
    filesSkipped: 0,
    filesFailed: 0,
    totalFiles: 0,
    totalSize: BigInt(0),
    errors: [] as string[],
  };

  await walkAndCopy(
    input.sourceRoot,
    input.sourceRoot,
    input.destinationRoot,
    input.storageRoot,
    input.checksumByRelativePath,
    summary,
    input.processedProjects,
  );

  const finishTime = new Date();

  return {
    ...summary,
    elapsedMs: finishTime.getTime() - input.startedAt.getTime(),
    startTime: input.startedAt,
    finishTime,
    destination: input.destination,
  };
}

async function verifyProjectsMirror(input: {
  sourceRoot: string;
  destinationRoot: string;
  storageRoot: string;
  checksumByRelativePath: Map<string, string>;
  startedAt: Date;
  destination: string;
}): Promise<BackupVerificationResult> {
  const summary = {
    verified: 0,
    verifiedWithTimestampWarning: 0,
    missing: 0,
    checksumMismatch: 0,
    sizeMismatch: 0,
    corrupted: 0,
    totalFiles: 0,
    totalSize: BigInt(0),
    warnings: [] as string[],
  };

  await walkAndVerify(input.sourceRoot, input.sourceRoot, input.destinationRoot, input.storageRoot, input.checksumByRelativePath, summary);

  const finishTime = new Date();
  const failed = summary.missing + summary.checksumMismatch + summary.sizeMismatch + summary.corrupted;

  return {
    ...summary,
    failed,
    status: failed ? "FAILED" : "PASSED",
    elapsedMs: finishTime.getTime() - input.startedAt.getTime(),
    startTime: input.startedAt,
    finishTime,
    destination: input.destination,
  };
}

async function walkAndVerify(
  root: string,
  current: string,
  destinationRoot: string,
  storageRoot: string,
  checksumByRelativePath: Map<string, string>,
  summary: {
    verified: number;
    verifiedWithTimestampWarning: number;
    missing: number;
    checksumMismatch: number;
    sizeMismatch: number;
    corrupted: number;
    totalFiles: number;
    totalSize: bigint;
    warnings: string[];
  },
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(current, entry.name);
    const relativeFromProjects = path.relative(root, sourcePath);
    const destinationPath = path.join(destinationRoot, relativeFromProjects);

    if (entry.isDirectory()) {
      await walkAndVerify(root, sourcePath, destinationRoot, storageRoot, checksumByRelativePath, summary);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    summary.totalFiles += 1;

    const sourceStat = await stat(sourcePath);
    summary.totalSize += BigInt(sourceStat.size);

    try {
      const destinationStat = await stat(destinationPath);

      if (!destinationStat.isFile()) {
        summary.missing += 1;
        addVerificationIssue(summary.warnings, `${relativeFromProjects}: destination is not a file.`);
        continue;
      }

      const storageRelativePath = normalizeRelative(path.relative(storageRoot, sourcePath));
      const checksum = checksumByRelativePath.get(storageRelativePath);

      if (checksum) {
        try {
          if ((await calculateSha256(destinationPath)) === checksum) {
            summary.verified += 1;
          } else {
            summary.checksumMismatch += 1;
            addVerificationIssue(summary.warnings, `${relativeFromProjects}: checksum mismatch.`);
          }
        } catch {
          summary.corrupted += 1;
          addVerificationIssue(summary.warnings, `${relativeFromProjects}: backup file is unreadable or corrupted.`);
        }
        continue;
      }

      if (destinationStat.size !== sourceStat.size) {
        summary.sizeMismatch += 1;
        addVerificationIssue(summary.warnings, `${relativeFromProjects}: size mismatch.`);
        continue;
      }

      if (Math.abs(destinationStat.mtime.getTime() - sourceStat.mtime.getTime()) >= 1000) {
        summary.verifiedWithTimestampWarning += 1;
        addVerificationIssue(summary.warnings, `${relativeFromProjects}: modified date differs but file size matches.`);
        continue;
      }

      summary.verified += 1;
    } catch (error) {
      if (isFileNotFoundError(error)) {
        summary.missing += 1;
        addVerificationIssue(summary.warnings, `${relativeFromProjects}: missing from backup.`);
      } else {
        summary.corrupted += 1;
        addVerificationIssue(summary.warnings, `${relativeFromProjects}: backup file is unreadable or corrupted.`);
      }
    }
  }
}

async function walkAndCopy(
  root: string,
  current: string,
  destinationRoot: string,
  storageRoot: string,
  checksumByRelativePath: Map<string, string>,
  summary: {
    filesCopied: number;
    filesSkipped: number;
    filesFailed: number;
    totalFiles: number;
    totalSize: bigint;
    errors: string[];
  },
  processedProjects: Set<string>,
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(current, entry.name);
    const relativeFromProjects = path.relative(root, sourcePath);
    const destinationPath = path.join(destinationRoot, relativeFromProjects);

    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      await walkAndCopy(root, sourcePath, destinationRoot, storageRoot, checksumByRelativePath, summary, processedProjects);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    summary.totalFiles += 1;
    const currentLocation = parseBackupRelativePath(relativeFromProjects);

    updateBackupProgress({
      currentProject: currentLocation.project,
      currentCategory: currentLocation.category,
      currentFile: currentLocation.file,
    });

    try {
      const sourceStat = await stat(sourcePath);
      summary.totalSize += BigInt(sourceStat.size);

      if (await shouldSkipFile(sourcePath, destinationPath, storageRoot, checksumByRelativePath, sourceStat.size, sourceStat.mtime)) {
        summary.filesSkipped += 1;
        markBackupFileProcessed(sourceStat.size, currentLocation.project, processedProjects);
        continue;
      }

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
      await utimes(destinationPath, sourceStat.atime, sourceStat.mtime);
      summary.filesCopied += 1;
      markBackupFileProcessed(sourceStat.size, currentLocation.project, processedProjects);
    } catch (error) {
      summary.filesFailed += 1;
      summary.errors.push(`${relativeFromProjects}: ${error instanceof Error ? error.message : "Copy failed."}`);
      markBackupFileProcessed(0, currentLocation.project, processedProjects);
    }
  }
}

async function scanBackupSource(sourceRoot: string): Promise<{ totalFiles: number; totalProjects: number; totalBytes: bigint }> {
  const summary = {
    totalFiles: 0,
    totalBytes: BigInt(0),
    projects: new Set<string>(),
  };

  await walkBackupSourceInventory(sourceRoot, sourceRoot, summary);

  return {
    totalFiles: summary.totalFiles,
    totalProjects: summary.projects.size,
    totalBytes: summary.totalBytes,
  };
}

async function walkBackupSourceInventory(
  root: string,
  current: string,
  summary: { totalFiles: number; totalBytes: bigint; projects: Set<string> },
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      await walkBackupSourceInventory(root, sourcePath, summary);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const relativeFromProjects = path.relative(root, sourcePath);
    const location = parseBackupRelativePath(relativeFromProjects);
    const sourceStat = await stat(sourcePath);

    summary.totalFiles += 1;
    summary.totalBytes += BigInt(sourceStat.size);

    if (location.project) {
      summary.projects.add(location.project);
    }
  }
}

function createInitialBackupProgress(startedAt: Date): BackupProgressDto {
  return {
    status: "RUNNING",
    overallProgress: 0,
    currentProject: null,
    currentCategory: null,
    currentFile: null,
    filesProcessed: 0,
    totalFiles: 0,
    projectsProcessed: 0,
    totalProjects: 0,
    bytesProcessed: BigInt(0),
    totalBytes: BigInt(0),
    elapsedMs: 0,
    estimatedRemainingMs: null,
    transferSpeedBytesPerSecond: null,
    startedAt,
    updatedAt: startedAt,
  };
}

function updateBackupProgress(update: Partial<BackupProgressDto>): void {
  if (!currentBackupProgress) {
    return;
  }

  const elapsedMs = calculateProgressElapsed(currentBackupProgress);
  const nextProgress = {
    ...currentBackupProgress,
    ...update,
    elapsedMs,
    updatedAt: new Date(),
  };

  currentBackupProgress = {
    ...nextProgress,
    overallProgress: calculateOverallProgress(nextProgress.filesProcessed, nextProgress.totalFiles),
    estimatedRemainingMs: calculateEstimatedRemaining(nextProgress),
    transferSpeedBytesPerSecond: calculateTransferSpeed(nextProgress),
  };
}

function markBackupFileProcessed(sourceSize: number, currentProject: string | null, processedProjects: Set<string>): void {
  if (!currentBackupProgress) {
    return;
  }

  if (currentProject) {
    processedProjects.add(currentProject);
  }

  updateBackupProgress({
    filesProcessed: currentBackupProgress.filesProcessed + 1,
    projectsProcessed: Math.min(processedProjects.size, currentBackupProgress.totalProjects),
    bytesProcessed: currentBackupProgress.bytesProcessed + BigInt(sourceSize),
  });
}

function parseBackupRelativePath(relativePath: string): { project: string | null; category: string | null; file: string } {
  const segments = normalizeRelative(relativePath).split("/").filter(Boolean);

  return {
    project: segments[0] || null,
    category: segments.length > 2 ? segments[1] : null,
    file: segments.at(-1) || relativePath,
  };
}

function calculateOverallProgress(filesProcessed: number, totalFiles: number): number {
  if (totalFiles <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((filesProcessed / totalFiles) * 100));
}

function calculateProgressElapsed(progress: Pick<BackupProgressDto, "startedAt">): number {
  if (!progress.startedAt) {
    return 0;
  }

  return Date.now() - new Date(progress.startedAt).getTime();
}

function calculateEstimatedRemaining(progress: Pick<BackupProgressDto, "filesProcessed" | "totalFiles" | "elapsedMs">): number | null {
  if (progress.filesProcessed <= 0 || progress.totalFiles <= 0) {
    return null;
  }

  const remainingFiles = Math.max(0, progress.totalFiles - progress.filesProcessed);
  const averageMsPerFile = progress.elapsedMs / progress.filesProcessed;

  return Math.round(remainingFiles * averageMsPerFile);
}

function calculateTransferSpeed(progress: Pick<BackupProgressDto, "bytesProcessed" | "elapsedMs">): number | null {
  if (progress.elapsedMs <= 0) {
    return null;
  }

  return Math.round(Number(progress.bytesProcessed) / (progress.elapsedMs / 1000));
}

async function shouldSkipFile(
  sourcePath: string,
  destinationPath: string,
  storageRoot: string,
  checksumByRelativePath: Map<string, string>,
  sourceSize: number,
  sourceMtime: Date,
): Promise<boolean> {
  try {
    const destinationStat = await stat(destinationPath);

    if (!destinationStat.isFile()) {
      return false;
    }

    const storageRelativePath = normalizeRelative(path.relative(storageRoot, sourcePath));
    const checksum = checksumByRelativePath.get(storageRelativePath);

    if (checksum) {
      return (await calculateSha256(destinationPath)) === checksum;
    }

    return destinationStat.size === sourceSize && Math.abs(destinationStat.mtime.getTime() - sourceMtime.getTime()) < 1000;
  } catch {
    return false;
  }
}

async function getChecksumByRelativePath(): Promise<Map<string, string>> {
  const [files, versions] = await prisma.$transaction([
    prisma.projectFile.findMany({
      where: { deletedAt: null },
      select: { storagePath: true, checksum: true },
    }),
    prisma.fileVersion.findMany({
      select: { storagePath: true, checksum: true },
    }),
  ]);
  const checksums = new Map<string, string>();

  for (const file of [...files, ...versions]) {
    checksums.set(normalizeRelative(file.storagePath), file.checksum);
  }

  return checksums;
}

async function resolveAndValidateDestination(rawLocation?: string | null): Promise<string> {
  const destination = sanitizeBackupLocation(rawLocation);
  const storageRoot = path.resolve(getStorageConfig().root);
  const appRoot = path.resolve(process.cwd());
  const sourceProjectsRoot = path.resolve(storageRoot, PROJECTS_FOLDER);

  if (isSamePath(destination, storageRoot) || isPathInside(destination, storageRoot)) {
    throw new Error("Backup destination cannot be inside the storage root.");
  }

  if (isSamePath(destination, appRoot) || isPathInside(destination, appRoot)) {
    throw new Error("Backup destination cannot be inside the application folder.");
  }

  if (isSamePath(destination, sourceProjectsRoot) || isPathInside(destination, sourceProjectsRoot)) {
    throw new Error("Backup destination cannot be inside the source projects folder.");
  }

  await mkdir(destination, { recursive: true });
  await assertWritable(destination);

  return destination;
}

function sanitizeBackupLocation(rawLocation?: string | null): string {
  const value = rawLocation?.trim();

  if (!value) {
    throw new Error("File Backup Location is required.");
  }

  if (value.includes("\0")) {
    throw new Error("Backup location contains an invalid character.");
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    throw new Error("Backup location must be a filesystem path, not a URL.");
  }

  if (!path.isAbsolute(value)) {
    throw new Error("Backup location must be an absolute local, USB, external drive, NAS, or network share path.");
  }

  const segments = value.split(/[\\/]+/).filter(Boolean);

  if (segments.includes("..")) {
    throw new Error("Backup location cannot contain path traversal segments.");
  }

  return path.resolve(value);
}

async function assertWritable(destination: string): Promise<void> {
  await access(destination, constants.W_OK);

  const testPath = path.join(destination, `.backup-write-test-${process.pid}-${Date.now()}`);
  await writeFile(testPath, "ok");
  await unlink(testPath);
}

async function assertSourceProjectsFolder(sourceRoot: string): Promise<void> {
  const sourceStat = await stat(sourceRoot);

  if (!sourceStat.isDirectory()) {
    throw new Error("Source projects folder does not exist.");
  }
}

async function getOrCreateSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      storageRoot: getStorageConfig().root,
      departments: ["Automation", "Electrical", "Mechanical", "Service"],
    },
  });
}

function normalizeStatus(status?: string | null): BackupStatus {
  if (status === "RUNNING" || status === "COMPLETED" || status === "COMPLETED_WITH_ERRORS" || status === "FAILED") {
    return status;
  }

  return "IDLE";
}

function normalizeRelative(value: string): string {
  return value.replaceAll("\\", "/");
}

function isSamePath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));

  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function toPersistedSummary(summary: BackupRunSummary) {
  return {
    filesCopied: summary.filesCopied,
    filesSkipped: summary.filesSkipped,
    filesFailed: summary.filesFailed,
    totalFiles: summary.totalFiles,
    totalSize: summary.totalSize.toString(),
    elapsedMs: summary.elapsedMs,
    startTime: summary.startTime.toISOString(),
    finishTime: summary.finishTime.toISOString(),
    destination: summary.destination,
    errors: summary.errors.slice(0, 50),
  };
}

function addVerificationIssue(issues: string[], issue: string): void {
  if (issues.length < 100) {
    issues.push(issue);
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT";
}

function buildActivityDetails(summary: BackupRunSummary): string {
  return [
    `Project storage backup completed in ${summary.elapsedMs} ms.`,
    `Destination: ${summary.destination}.`,
    `Total files: ${summary.totalFiles}.`,
    `Copied: ${summary.filesCopied}.`,
    `Skipped: ${summary.filesSkipped}.`,
    `Failed: ${summary.filesFailed}.`,
    `Total size: ${summary.totalSize.toString()} bytes.`,
  ].join(" ");
}
