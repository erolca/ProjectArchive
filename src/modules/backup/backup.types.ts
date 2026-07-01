export type BackupStatus = "IDLE" | "RUNNING" | "COMPLETED" | "COMPLETED_WITH_ERRORS" | "FAILED";

export interface BackupValidationResult {
  valid: boolean;
  destination?: string | null;
  message: string;
}

export interface BackupRunSummary {
  filesCopied: number;
  filesSkipped: number;
  filesFailed: number;
  totalFiles: number;
  totalSize: bigint;
  elapsedMs: number;
  startTime: Date;
  finishTime: Date;
  destination: string;
  errors: string[];
}

export interface BackupHistoryItem {
  id: number;
  startedAt: Date;
  finishedAt?: Date | null;
  durationMs?: number | null;
  status: string;
  destination: string;
  filesCopied: number;
  filesSkipped: number;
  filesFailed: number;
  totalFiles: number;
  totalSize: bigint;
  executedBy?: {
    id: number;
    username: string;
    fullName?: string | null;
    email: string;
  } | null;
}

export interface BackupVerificationResult {
  verifiedFiles: number;
  missingFiles: number;
  mismatchedFiles: number;
  corruptedFiles: number;
  totalFiles: number;
  totalSize: bigint;
  status: "PASSED" | "FAILED";
  elapsedMs: number;
  startTime: Date;
  finishTime: Date;
  destination: string;
  issues: string[];
}

export interface BackupStatusDto {
  storageRoot: string;
  sourcePath: string;
  destination?: string | null;
  status: BackupStatus;
  lastBackup?: {
    startedAt?: Date | null;
    finishedAt?: Date | null;
    durationMs?: number | null;
    status?: string | null;
    size?: bigint | null;
    result?: unknown;
    destination?: string | null;
  };
  validation?: BackupValidationResult;
}
