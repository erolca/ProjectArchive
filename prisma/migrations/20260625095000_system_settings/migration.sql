-- CreateTable
CREATE TABLE `SystemSettings` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `companyName` VARCHAR(255) NOT NULL DEFAULT 'Engineering Archive',
  `companyLogoUrl` VARCHAR(1024) NULL,
  `storageRoot` VARCHAR(1024) NOT NULL,
  `fileBackupLocation` VARCHAR(1024) NULL,
  `databaseBackupSchedule` VARCHAR(120) NULL,
  `fileBackupSchedule` VARCHAR(120) NULL,
  `maximumUploadSizeMb` INTEGER NOT NULL DEFAULT 2048,
  `departments` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
