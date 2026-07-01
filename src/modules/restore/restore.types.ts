import type { FileCategory } from "@prisma/client";

export type RestoreMode = "ENTIRE_ARCHIVE" | "SINGLE_PROJECT" | "SELECTED_CATEGORIES" | "SELECTED_FILES";

export interface RestoreOptions {
  dryRun: boolean;
  replaceExistingFiles: boolean;
  skipExistingFiles: boolean;
  restoreToAlternativeLocation?: string | null;
}

export interface RestoreAnalyzeInput {
  backupRunId: number;
  mode: RestoreMode;
  projectCode?: string;
  categories?: FileCategory[];
  files?: string[];
  options: RestoreOptions;
}

export interface RestoreFilePreview {
  relativePath: string;
  projectCode: string;
  category?: string | null;
  size: bigint;
  exists: boolean;
  willRestore: boolean;
  willOverwrite: boolean;
  willSkip: boolean;
  reason: string;
}

export interface RestorePreview {
  backupRunId: number;
  mode: RestoreMode;
  source: string;
  destination: string;
  filesToRestore: number;
  existingFiles: number;
  newFiles: number;
  filesToOverwrite: number;
  skippedFiles: number;
  totalFiles: number;
  totalSize: bigint;
  estimatedDurationSeconds: number;
  conflicts: RestoreFilePreview[];
  files: RestoreFilePreview[];
}

export interface RestoreProgress {
  currentFile?: string | null;
  totalFiles: number;
  progressPercentage: number;
  restoredFiles: number;
  skippedFiles: number;
  failedFiles: number;
  elapsedMs: number;
  remainingMs: number;
}

export interface RestoreReport {
  status: "DRY_RUN" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";
  restored: number;
  skipped: number;
  failed: number;
  totalSize: bigint;
  durationMs: number;
  destination: string;
  progress: RestoreProgress;
  errors: string[];
  preview: RestorePreview;
}
