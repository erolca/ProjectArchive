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
  sessionInactivityTimeoutMinutes: z.number().int().min(5).max(480).optional(),
  sessionWarningMinutes: z.number().int().min(1).max(60).optional(),
  sessionMaxLifetimeHours: z.number().int().min(1).max(24).optional(),
  sessionSlidingEnabled: z.boolean().optional(),
}).refine((settings) => {
  if (
    settings.sessionInactivityTimeoutMinutes !== undefined &&
    settings.sessionWarningMinutes !== undefined
  ) {
    return settings.sessionWarningMinutes < settings.sessionInactivityTimeoutMinutes;
  }

  return true;
}, {
  message: "Warning time must be shorter than inactivity timeout.",
  path: ["sessionWarningMinutes"],
});
