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
