ALTER TABLE `ProjectFile`
  ADD COLUMN `manufacturer` VARCHAR(120) NULL,
  ADD COLUMN `softwareName` VARCHAR(160) NULL,
  ADD COLUMN `softwareVersion` VARCHAR(120) NULL;

ALTER TABLE `FileVersion`
  ADD COLUMN `manufacturer` VARCHAR(120) NULL,
  ADD COLUMN `softwareName` VARCHAR(160) NULL,
  ADD COLUMN `softwareVersion` VARCHAR(120) NULL;

CREATE INDEX `ProjectFile_manufacturer_idx` ON `ProjectFile`(`manufacturer`);
CREATE INDEX `ProjectFile_softwareName_idx` ON `ProjectFile`(`softwareName`);
