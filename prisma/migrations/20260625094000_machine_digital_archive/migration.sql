-- AlterTable
ALTER TABLE `ProjectFile` MODIFY `category` ENUM(
  'PLC',
  'HMI',
  'ROBOT',
  'ELECTRICAL',
  'MECHANICAL',
  'PNEUMATIC',
  'VISION',
  'CAMERA',
  'PHOTO',
  'VIDEO',
  'FAT',
  'SAT',
  'SPARE_PARTS',
  'DOCUMENT',
  'PHOTO_VIDEO',
  'BACKUP',
  'COMMISSIONING',
  'SERVICE'
) NOT NULL;
