import { FileCategory } from "@prisma/client";
import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 2n * 1024n * 1024n * 1024n;
const DANGEROUS_EXTENSIONS = new Set([".exe", ".bat", ".cmd", ".ps1", ".msi", ".vbs"]);
const ALLOWED_ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z"]);
const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"]);
const CATEGORY_EXTENSION_ALLOWLIST: Partial<Record<FileCategory, Set<string>>> = {
  [FileCategory.ELECTRICAL]: new Set([".pdf", ".dwg", ".dxf", ".zip", ".rar", ".7z", ".xlsx", ".csv"]),
  [FileCategory.DOCUMENT]: new Set([".pdf", ".docx", ".xlsx", ".pptx", ".zip", ".rar", ".7z"]),
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const versionNoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^V\d+\.\d+$/, "Version must use VMAJOR.MINOR format, for example V1.0.");

export const checksumSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-f0-9]{64}$/, "Checksum must be a SHA256 hex digest.");

export const originalFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((value) => !value.includes("/") && !value.includes("\\"), "Filename must not contain path separators.")
  .refine((value) => value !== "." && value !== "..", "Invalid filename.")
  .refine((value) => !DANGEROUS_EXTENSIONS.has(getLowerExtension(value)), "Executable or script files are not allowed.");

export const fileSizeSchema = z
  .union([z.bigint(), z.number().int().nonnegative()])
  .transform((value) => BigInt(value))
  .refine((value) => value > 0n, "File size must be greater than zero.")
  .refine((value) => value <= MAX_FILE_SIZE_BYTES, "File size exceeds the 2 GB limit.");

export const prepareUploadSchema = z.object({
  projectId: z.number().int().positive(),
  category: z.enum(FileCategory),
  platform: optionalText(120),
  manufacturer: optionalText(120),
  softwareName: optionalText(160),
  softwareVersion: optionalText(120),
  originalFileName: originalFileNameSchema,
  fileSize: fileSizeSchema,
  versionNo: versionNoSchema.optional(),
  changeNote: optionalText(5000),
  confirmWarnings: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const extension = getLowerExtension(value.originalFileName);
  const allowedExtensions = CATEGORY_EXTENSION_ALLOWLIST[value.category];

  if (allowedExtensions && !allowedExtensions.has(extension)) {
    ctx.addIssue({
      code: "custom",
      path: ["originalFileName"],
      message: `${formatCategory(value.category)} uploads must use: ${Array.from(allowedExtensions).join(", ")}.`,
    });
  }

  if (ARCHIVE_EXTENSIONS.has(extension) && !ALLOWED_ARCHIVE_EXTENSIONS.has(extension)) {
    ctx.addIssue({
      code: "custom",
      path: ["originalFileName"],
      message: "Archive uploads must use .zip, .rar, or .7z.",
    });
  }
});

export const finalizeUploadSchema = prepareUploadSchema.extend({
  tempRelativePath: z.string().trim().min(1).max(1024),
  checksum: checksumSchema.optional(),
});

export const createFileVersionSchema = z.object({
  fileId: z.number().int().positive(),
  originalFileName: originalFileNameSchema,
  tempRelativePath: z.string().trim().min(1).max(1024),
  fileSize: fileSizeSchema,
  versionNo: versionNoSchema.optional(),
  changeNote: optionalText(5000),
  checksum: checksumSchema.optional(),
  confirmWarnings: z.boolean().default(false),
});

export const fileIdSchema = z.number().int().positive();

function getLowerExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");

  if (index < 0) {
    return "";
  }

  return fileName.slice(index).toLowerCase();
}

function formatCategory(category: FileCategory): string {
  return category
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_match, prefix: string, letter: string) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
}
