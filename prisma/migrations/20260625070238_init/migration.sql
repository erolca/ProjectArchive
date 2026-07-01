-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('ADMIN', 'ENGINEER', 'SERVICE', 'GUEST') NOT NULL,
    `description` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(80) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `roleId` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_roleId_idx`(`roleId`),
    INDEX `User_isActive_idx`(`isActive`),
    INDEX `User_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerCode` VARCHAR(50) NOT NULL,
    `customerName` VARCHAR(255) NOT NULL,
    `city` VARCHAR(120) NULL,
    `country` VARCHAR(120) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Customer_customerCode_key`(`customerCode`),
    INDEX `Customer_customerName_idx`(`customerName`),
    INDEX `Customer_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectCode` VARCHAR(30) NOT NULL,
    `serialNumber` VARCHAR(80) NOT NULL,
    `machineName` VARCHAR(255) NOT NULL,
    `machineType` VARCHAR(120) NULL,
    `customerId` INTEGER NOT NULL,
    `status` ENUM('DESIGN', 'SOFTWARE', 'COMMISSIONING', 'COMPLETED', 'SERVICE', 'ARCHIVED') NOT NULL DEFAULT 'DESIGN',
    `description` TEXT NULL,
    `customerFactory` VARCHAR(255) NULL,
    `lineName` VARCHAR(255) NULL,
    `plcBrand` VARCHAR(120) NULL,
    `plcModel` VARCHAR(120) NULL,
    `plcSoftwareVersion` VARCHAR(120) NULL,
    `hmiBrand` VARCHAR(120) NULL,
    `hmiModel` VARCHAR(120) NULL,
    `hmiSoftwareVersion` VARCHAR(120) NULL,
    `robotBrand` VARCHAR(120) NULL,
    `robotModel` VARCHAR(120) NULL,
    `robotController` VARCHAR(120) NULL,
    `robotSoftwareVersion` VARCHAR(120) NULL,
    `electricalDrawingNo` VARCHAR(120) NULL,
    `createdById` INTEGER NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Project_projectCode_key`(`projectCode`),
    UNIQUE INDEX `Project_serialNumber_key`(`serialNumber`),
    INDEX `Project_projectCode_idx`(`projectCode`),
    INDEX `Project_serialNumber_idx`(`serialNumber`),
    INDEX `Project_customerId_idx`(`customerId`),
    INDEX `Project_status_idx`(`status`),
    INDEX `Project_machineName_idx`(`machineName`),
    INDEX `Project_plcBrand_idx`(`plcBrand`),
    INDEX `Project_hmiBrand_idx`(`hmiBrand`),
    INDEX `Project_robotBrand_idx`(`robotBrand`),
    INDEX `Project_createdAt_idx`(`createdAt`),
    INDEX `Project_updatedAt_idx`(`updatedAt`),
    INDEX `Project_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectRevision` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `revisionNo` VARCHAR(30) NOT NULL,
    `revisionDate` DATETIME(3) NOT NULL,
    `responsibleUserId` INTEGER NULL,
    `explanation` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectRevision_projectId_idx`(`projectId`),
    INDEX `ProjectRevision_revisionDate_idx`(`revisionDate`),
    INDEX `ProjectRevision_responsibleUserId_idx`(`responsibleUserId`),
    UNIQUE INDEX `ProjectRevision_projectId_revisionNo_key`(`projectId`, `revisionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `category` ENUM('PLC', 'HMI', 'ROBOT', 'ELECTRICAL', 'MECHANICAL', 'DOCUMENT', 'PHOTO_VIDEO', 'BACKUP', 'COMMISSIONING', 'SERVICE') NOT NULL,
    `platform` VARCHAR(120) NULL,
    `originalFileName` VARCHAR(255) NOT NULL,
    `storedFileName` VARCHAR(255) NOT NULL,
    `storageProvider` ENUM('LOCAL', 'NAS') NOT NULL DEFAULT 'LOCAL',
    `storagePath` VARCHAR(1024) NOT NULL,
    `fileSize` BIGINT NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `currentVersionNo` VARCHAR(30) NOT NULL,
    `uploadedById` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `deletedById` INTEGER NULL,

    INDEX `ProjectFile_projectId_idx`(`projectId`),
    INDEX `ProjectFile_category_idx`(`category`),
    INDEX `ProjectFile_platform_idx`(`platform`),
    INDEX `ProjectFile_uploadedAt_idx`(`uploadedAt`),
    INDEX `ProjectFile_checksum_idx`(`checksum`),
    INDEX `ProjectFile_deletedAt_idx`(`deletedAt`),
    INDEX `ProjectFile_projectId_category_idx`(`projectId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileId` INTEGER NOT NULL,
    `versionNo` VARCHAR(30) NOT NULL,
    `changeNote` TEXT NULL,
    `originalFileName` VARCHAR(255) NOT NULL,
    `storedFileName` VARCHAR(255) NOT NULL,
    `storageProvider` ENUM('LOCAL', 'NAS') NOT NULL DEFAULT 'LOCAL',
    `storagePath` VARCHAR(1024) NOT NULL,
    `fileSize` BIGINT NOT NULL,
    `checksum` CHAR(64) NOT NULL,
    `uploadedById` INTEGER NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FileVersion_fileId_idx`(`fileId`),
    INDEX `FileVersion_uploadedById_idx`(`uploadedById`),
    INDEX `FileVersion_uploadedAt_idx`(`uploadedAt`),
    INDEX `FileVersion_checksum_idx`(`checksum`),
    UNIQUE INDEX `FileVersion_fileId_versionNo_key`(`fileId`, `versionNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommissioningRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `commissioningDate` DATETIME(3) NOT NULL,
    `commissioningEngineerId` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `CommissioningRecord_projectId_idx`(`projectId`),
    INDEX `CommissioningRecord_commissioningDate_idx`(`commissioningDate`),
    INDEX `CommissioningRecord_commissioningEngineerId_idx`(`commissioningEngineerId`),
    INDEX `CommissioningRecord_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `projectId` INTEGER NOT NULL,
    `serviceDate` DATETIME(3) NOT NULL,
    `engineerId` INTEGER NULL,
    `issue` TEXT NOT NULL,
    `actionTaken` TEXT NOT NULL,
    `result` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ServiceRecord_projectId_idx`(`projectId`),
    INDEX `ServiceRecord_serviceDate_idx`(`serviceDate`),
    INDEX `ServiceRecord_engineerId_idx`(`engineerId`),
    INDEX `ServiceRecord_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `projectId` INTEGER NULL,
    `action` ENUM('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_ARCHIVED', 'PROJECT_DELETED', 'FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_DELETED', 'VERSION_CREATED', 'SERVICE_RECORD_ADDED', 'COMMISSIONING_RECORD_ADDED', 'PERMISSION_DENIED', 'USER_CREATED', 'USER_UPDATED') NOT NULL,
    `entityType` VARCHAR(80) NOT NULL,
    `entityId` INTEGER NULL,
    `details` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_userId_idx`(`userId`),
    INDEX `ActivityLog_projectId_idx`(`projectId`),
    INDEX `ActivityLog_action_idx`(`action`),
    INDEX `ActivityLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `ActivityLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectTag` (
    `projectId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProjectTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`projectId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectRevision` ADD CONSTRAINT `ProjectRevision_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectRevision` ADD CONSTRAINT `ProjectRevision_responsibleUserId_fkey` FOREIGN KEY (`responsibleUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectFile` ADD CONSTRAINT `ProjectFile_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectFile` ADD CONSTRAINT `ProjectFile_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileVersion` ADD CONSTRAINT `FileVersion_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `ProjectFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileVersion` ADD CONSTRAINT `FileVersion_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissioningRecord` ADD CONSTRAINT `CommissioningRecord_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissioningRecord` ADD CONSTRAINT `CommissioningRecord_commissioningEngineerId_fkey` FOREIGN KEY (`commissioningEngineerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRecord` ADD CONSTRAINT `ServiceRecord_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRecord` ADD CONSTRAINT `ServiceRecord_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectTag` ADD CONSTRAINT `ProjectTag_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectTag` ADD CONSTRAINT `ProjectTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
