import { prisma } from "../../lib/prisma";
import { getStorageConfig } from "../../lib/storage";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { SystemSettingsDto, UpdateSettingsInput } from "./settings.types";
import { updateSettingsSchema } from "./settings.validators";

const SETTINGS_ID = 1;
const DEFAULT_DEPARTMENTS = ["Automation", "Electrical", "Mechanical", "Service"];

export async function getSystemSettings(_user: AuthenticatedUser): Promise<SystemSettingsDto> {
  const settings = await prisma.systemSettings.upsert({
    where: {
      id: SETTINGS_ID,
    },
    update: {},
    create: {
      id: SETTINGS_ID,
      storageRoot: getStorageConfig().root,
      departments: DEFAULT_DEPARTMENTS,
    },
  });

  return toSettingsDto(settings);
}

export async function updateSystemSettings(
  user: AuthenticatedUser,
  input: UpdateSettingsInput,
): Promise<SystemSettingsDto> {
  if (user.role !== "ADMIN") {
    throw new Error("Permission denied.");
  }

  const data = updateSettingsSchema.parse(input);
  const settings = await prisma.systemSettings.upsert({
    where: {
      id: SETTINGS_ID,
    },
    update: data,
    create: {
      id: SETTINGS_ID,
      ...data,
    },
  });

  return toSettingsDto(settings);
}

function toSettingsDto(settings: {
  id: number;
  companyName: string;
  companyLogoUrl: string | null;
  storageRoot: string;
  fileBackupLocation: string | null;
  databaseBackupSchedule: string | null;
  fileBackupSchedule: string | null;
  maximumUploadSizeMb: number;
  departments: unknown;
  lastFileBackupStartedAt?: Date | null;
  lastFileBackupFinishedAt?: Date | null;
  lastFileBackupDurationMs?: number | null;
  lastFileBackupStatus?: string | null;
  lastFileBackupSize?: bigint | null;
  lastFileBackupResult?: unknown;
  lastFileBackupDestination?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SystemSettingsDto {
  return {
    ...settings,
    departments: parseDepartments(settings.departments),
  };
}

function parseDepartments(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_DEPARTMENTS;
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
