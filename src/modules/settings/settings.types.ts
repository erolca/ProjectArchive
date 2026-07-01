export interface SystemSettingsDto {
  id: number;
  companyName: string;
  companyLogoUrl?: string | null;
  storageRoot: string;
  fileBackupLocation?: string | null;
  databaseBackupSchedule?: string | null;
  fileBackupSchedule?: string | null;
  maximumUploadSizeMb: number;
  departments: string[];
  lastFileBackupStartedAt?: Date | null;
  lastFileBackupFinishedAt?: Date | null;
  lastFileBackupDurationMs?: number | null;
  lastFileBackupStatus?: string | null;
  lastFileBackupSize?: bigint | null;
  lastFileBackupResult?: unknown;
  lastFileBackupDestination?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateSettingsInput {
  companyName: string;
  companyLogoUrl?: string;
  storageRoot: string;
  fileBackupLocation?: string;
  databaseBackupSchedule?: string;
  fileBackupSchedule?: string;
  maximumUploadSizeMb: number;
  departments: string[];
}
