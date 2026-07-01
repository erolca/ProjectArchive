import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

const departmentsSchema = z
  .array(z.string().trim().min(1).max(120))
  .max(100)
  .transform((departments) => Array.from(new Set(departments)));

export const updateSettingsSchema = z.object({
  companyName: z.string().trim().min(1).max(255),
  companyLogoUrl: optionalText(1024),
  storageRoot: z.string().trim().min(1).max(1024),
  fileBackupLocation: optionalText(1024),
  databaseBackupSchedule: optionalText(120),
  fileBackupSchedule: optionalText(120),
  maximumUploadSizeMb: z.number().int().positive().max(204800),
  departments: departmentsSchema,
});
