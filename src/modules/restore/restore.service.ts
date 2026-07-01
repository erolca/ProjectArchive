import { copyFile, mkdir, readdir, stat, utimes } from "node:fs/promises";
import path from "node:path";
import { ActivityAction, type FileCategory } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getStorageConfig } from "../../lib/storage";
import { logActivity } from "../activity/activity.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { requirePermission } from "../auth/permissions";
import type {
  RestoreAnalyzeInput,
  RestoreFilePreview,
  RestoreOptions,
  RestorePreview,
  RestoreProgress,
  RestoreReport,
} from "./restore.types";
import { restoreAnalyzeSchema } from "./restore.validators";

const PROJECTS_FOLDER = "projects";
const CATEGORY_FOLDER_BY_ENUM: Record<FileCategory, string[]> = {
  PLC: ["PLC"],
  HMI: ["HMI"],
  ROBOT: ["ROBOT"],
  ELECTRICAL: ["ELECTRICAL"],
  MECHANICAL: ["MECHANICAL"],
  PNEUMATIC: ["PNEUMATIC"],
  VISION: ["VISION"],
  CAMERA: ["CAMERA"],
  PHOTO: ["PHOTOS"],
  VIDEO: ["VIDEOS"],
  FAT: ["FAT"],
  SAT: ["SAT"],
  SPARE_PARTS: ["SPARE_PARTS"],
  DOCUMENT: ["DOCUMENTS"],
  PHOTO_VIDEO: ["PHOTO_VIDEO"],
  BACKUP: ["BACKUPS"],
  COMMISSIONING: ["COMMISSIONING"],
  SERVICE: ["SERVICE"],
};

export async function analyzeRestore(user: AuthenticatedUser, input: RestoreAnalyzeInput): Promise<RestorePreview> {
  requirePermission(user, "backups:manage");

  const data = restoreAnalyzeSchema.parse(input);
  const backupRun = await getBackupRun(data.backupRunId);
  const sourceProjectsRoot = resolveBackupProjectsRoot(backupRun.destination);
  const destinationProjectsRoot = resolveRestoreDestination(data.options);
  const sourceFiles = await listBackupFiles(sourceProjectsRoot);
  const selectedFiles = filterRestoreFiles(sourceFiles, data);
  const previews: RestoreFilePreview[] = [];

  for (const file of selectedFiles) {
    const destinationPath = safeJoin(destinationProjectsRoot, file.relativePath);
    const exists = await fileExists(destinationPath);
    const willOverwrite = exists && data.options.replaceExistingFiles;
    const willSkip = exists && data.options.skipExistingFiles;
    const willRestore = !exists || willOverwrite;

    previews.push({
      relativePath: file.relativePath,
      projectCode: getProjectCodeFromRelativePath(file.relativePath),
      category: getCategoryFromRelativePath(file.relativePath),
      size: file.size,
      exists,
      willRestore,
      willOverwrite,
      willSkip,
      reason: buildPreviewReason(exists, willOverwrite, willSkip),
    });
  }

  const filesToRestore = previews.filter((file) => file.willRestore).length;
  const totalSize = previews.reduce((sum, file) => (file.willRestore ? sum + file.size : sum), BigInt(0));

  return {
    backupRunId: backupRun.id,
    mode: data.mode,
    source: sourceProjectsRoot,
    destination: destinationProjectsRoot,
    filesToRestore,
    existingFiles: previews.filter((file) => file.exists).length,
    newFiles: previews.filter((file) => !file.exists).length,
    filesToOverwrite: previews.filter((file) => file.willOverwrite).length,
    skippedFiles: previews.filter((file) => file.willSkip).length,
    totalFiles: previews.length,
    totalSize,
    estimatedDurationSeconds: estimateDurationSeconds(totalSize, filesToRestore),
    conflicts: previews.filter((file) => file.exists),
    files: previews.slice(0, 500),
  };
}

export async function executeRestore(user: AuthenticatedUser, input: RestoreAnalyzeInput): Promise<RestoreReport> {
  requirePermission(user, "backups:manage");

  const data = restoreAnalyzeSchema.parse(input);
  const startedAt = new Date();
  const preview = await analyzeRestore(user, data);
  const progress: RestoreProgress = {
    currentFile: null,
    totalFiles: preview.filesToRestore,
    progressPercentage: 0,
    restoredFiles: 0,
    skippedFiles: preview.skippedFiles,
    failedFiles: 0,
    elapsedMs: 0,
    remainingMs: 0,
  };
  const errors: string[] = [];

  await logActivity({
    userId: user.id,
    action: ActivityAction.RESTORE_STARTED,
    entityType: "BackupRun",
    entityId: preview.backupRunId,
    details: `Restore started. Mode: ${data.mode}. Dry run: ${data.options.dryRun}. Destination: ${preview.destination}.`,
  });

  try {
    if (!data.options.dryRun) {
      await executeFileCopies(preview, progress, errors, startedAt);
    } else {
      progress.progressPercentage = 100;
    }

    const finishedAt = new Date();
    progress.elapsedMs = finishedAt.getTime() - startedAt.getTime();
    progress.remainingMs = 0;
    const status = data.options.dryRun ? "DRY_RUN" : errors.length > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    const report: RestoreReport = {
      status,
      restored: progress.restoredFiles,
      skipped: progress.skippedFiles,
      failed: progress.failedFiles,
      totalSize: preview.totalSize,
      durationMs: progress.elapsedMs,
      destination: preview.destination,
      progress,
      errors,
      preview,
    };

    await logActivity({
      userId: user.id,
      action: ActivityAction.RESTORE_COMPLETED,
      entityType: "BackupRun",
      entityId: preview.backupRunId,
      details: `Restore ${status}. Restored: ${report.restored}. Skipped: ${report.skipped}. Failed: ${report.failed}. Destination: ${preview.destination}.`,
    });

    return report;
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "Restore failed.";
    progress.elapsedMs = finishedAt.getTime() - startedAt.getTime();
    progress.failedFiles += 1;
    errors.push(message);

    await logActivity({
      userId: user.id,
      action: ActivityAction.RESTORE_FAILED,
      entityType: "BackupRun",
      entityId: preview.backupRunId,
      details: `Restore failed after ${progress.elapsedMs} ms. Destination: ${preview.destination}. Error: ${message}`,
    });

    return {
      status: "FAILED",
      restored: progress.restoredFiles,
      skipped: progress.skippedFiles,
      failed: progress.failedFiles,
      totalSize: preview.totalSize,
      durationMs: progress.elapsedMs,
      destination: preview.destination,
      progress,
      errors,
      preview,
    };
  }
}

async function executeFileCopies(
  preview: RestorePreview,
  progress: RestoreProgress,
  errors: string[],
  startedAt: Date,
): Promise<void> {
  const restoreFiles = preview.files.filter((file) => file.willRestore);

  for (const file of restoreFiles) {
    progress.currentFile = file.relativePath;

    try {
      const sourcePath = safeJoin(preview.source, file.relativePath);
      const destinationPath = safeJoin(preview.destination, file.relativePath);
      const sourceStat = await stat(sourcePath);

      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
      await utimes(destinationPath, sourceStat.atime, sourceStat.mtime);
      progress.restoredFiles += 1;
    } catch (error) {
      progress.failedFiles += 1;
      errors.push(`${file.relativePath}: ${error instanceof Error ? error.message : "Restore failed."}`);
    } finally {
      const processed = progress.restoredFiles + progress.failedFiles;
      progress.elapsedMs = Date.now() - startedAt.getTime();
      progress.progressPercentage = progress.totalFiles > 0 ? Math.round((processed / progress.totalFiles) * 100) : 100;
      progress.remainingMs = estimateRemainingMs(progress.elapsedMs, processed, progress.totalFiles);
    }
  }
}

async function getBackupRun(backupRunId: number) {
  const backupRun = await prisma.backupRun.findUnique({
    where: {
      id: backupRunId,
    },
  });

  if (!backupRun) {
    throw new Error("Backup history entry not found.");
  }

  if (!backupRun.destination) {
    throw new Error("Backup history entry has no destination.");
  }

  return backupRun;
}

function resolveBackupProjectsRoot(destination: string): string {
  const backupRoot = sanitizeAbsolutePath(destination, "Backup destination");
  const projectsRoot = safeJoin(backupRoot, PROJECTS_FOLDER);

  return projectsRoot;
}

function resolveRestoreDestination(options: RestoreOptions): string {
  const storageRoot = sanitizeAbsolutePath(getStorageConfig().root, "Storage root");

  if (options.restoreToAlternativeLocation?.trim()) {
    return sanitizeAbsolutePath(options.restoreToAlternativeLocation, "Alternative restore location");
  }

  return safeJoin(storageRoot, PROJECTS_FOLDER);
}

async function listBackupFiles(sourceProjectsRoot: string): Promise<Array<{ relativePath: string; size: bigint }>> {
  const sourceStat = await stat(sourceProjectsRoot);

  if (!sourceStat.isDirectory()) {
    throw new Error("Backup projects folder not found.");
  }

  const files: Array<{ relativePath: string; size: bigint }> = [];
  await walkBackupFiles(sourceProjectsRoot, sourceProjectsRoot, files);

  return files;
}

async function walkBackupFiles(root: string, current: string, files: Array<{ relativePath: string; size: bigint }>): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      await walkBackupFiles(root, absolutePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    files.push({
      relativePath: normalizeRelative(path.relative(root, absolutePath)),
      size: BigInt(fileStat.size),
    });
  }
}

function filterRestoreFiles(
  files: Array<{ relativePath: string; size: bigint }>,
  input: RestoreAnalyzeInput,
): Array<{ relativePath: string; size: bigint }> {
  if (input.mode === "ENTIRE_ARCHIVE") {
    return files;
  }

  if (input.mode === "SINGLE_PROJECT") {
    const projectCode = input.projectCode?.trim();
    return files.filter((file) => getProjectCodeFromRelativePath(file.relativePath) === projectCode);
  }

  if (input.mode === "SELECTED_CATEGORIES") {
    const categoryPrefixes = new Set((input.categories || []).map((category) => CATEGORY_FOLDER_BY_ENUM[category]?.[0]).filter(Boolean));

    return files.filter((file) => categoryPrefixes.has(getCategoryFromRelativePath(file.relativePath) || ""));
  }

  const selected = new Set((input.files || []).map(normalizeRelative));

  return files.filter((file) => selected.has(file.relativePath));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(filePath);

    return fileStat.isFile();
  } catch {
    return false;
  }
}

function buildPreviewReason(exists: boolean, willOverwrite: boolean, willSkip: boolean): string {
  if (!exists) {
    return "New file.";
  }

  if (willOverwrite) {
    return "Existing file will be overwritten.";
  }

  if (willSkip) {
    return "Existing file will be skipped.";
  }

  return "Existing file conflict. Choose replace or skip.";
}

function getProjectCodeFromRelativePath(relativePath: string): string {
  return normalizeRelative(relativePath).split("/")[0] || "";
}

function getCategoryFromRelativePath(relativePath: string): string | null {
  return normalizeRelative(relativePath).split("/")[1] || null;
}

function estimateDurationSeconds(totalSize: bigint, files: number): number {
  const sizeBasedSeconds = Number(totalSize / BigInt(50 * 1024 * 1024));

  return Math.max(1, sizeBasedSeconds + Math.ceil(files / 500));
}

function estimateRemainingMs(elapsedMs: number, processed: number, total: number): number {
  if (processed <= 0 || total <= processed) {
    return 0;
  }

  return Math.max(0, Math.round((elapsedMs / processed) * (total - processed)));
}

function sanitizeAbsolutePath(value: string, label: string): string {
  const trimmed = value.trim();

  if (!trimmed || trimmed.includes("\0")) {
    throw new Error(`${label} is invalid.`);
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw new Error(`${label} must be a filesystem path.`);
  }

  if (!path.isAbsolute(trimmed)) {
    throw new Error(`${label} must be an absolute path.`);
  }

  const segments = trimmed.split(/[\\/]+/).filter(Boolean);

  if (segments.includes("..")) {
    throw new Error(`${label} cannot contain path traversal segments.`);
  }

  return path.resolve(trimmed);
}

function safeJoin(root: string, relativePath: string): string {
  const normalizedRoot = path.resolve(root);
  const segments = normalizeRelative(relativePath).split("/").filter(Boolean);

  if (segments.some((segment) => segment === ".." || segment.includes("\0"))) {
    throw new Error("Restore path contains unsafe segments.");
  }

  const target = path.resolve(normalizedRoot, ...segments);
  const relative = path.relative(normalizedRoot, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Restore path escapes the destination root.");
  }

  return target;
}

function normalizeRelative(value: string): string {
  return value.replaceAll("\\", "/");
}
