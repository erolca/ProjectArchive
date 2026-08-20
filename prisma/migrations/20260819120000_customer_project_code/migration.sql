ALTER TABLE `Project`
  MODIFY `projectCode` VARCHAR(40) NOT NULL,
  ADD COLUMN `customerProjectCode` VARCHAR(80) NULL;

CREATE INDEX `Project_customerProjectCode_idx` ON `Project`(`customerProjectCode`);
