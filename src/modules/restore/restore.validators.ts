import { FileCategory } from "@prisma/client";
import { z } from "zod";

const restoreModeSchema = z.enum(["ENTIRE_ARCHIVE", "SINGLE_PROJECT", "SELECTED_CATEGORIES", "SELECTED_FILES"]);

const optionsSchema = z
  .object({
    dryRun: z.boolean().default(true),
    replaceExistingFiles: z.boolean().default(false),
    skipExistingFiles: z.boolean().default(true),
    restoreToAlternativeLocation: z.string().trim().max(1024).optional().nullable(),
  })
  .refine((options) => !(options.replaceExistingFiles && options.skipExistingFiles), {
    message: "Choose either replace existing files or skip existing files.",
  });

export const restoreAnalyzeSchema = z
  .object({
    backupRunId: z.number().int().positive(),
    mode: restoreModeSchema,
    projectCode: z.string().trim().min(1).max(80).optional(),
    categories: z.array(z.nativeEnum(FileCategory)).optional().default([]),
    files: z.array(z.string().trim().min(1).max(2048)).optional().default([]),
    options: optionsSchema,
  })
  .refine((input) => input.mode !== "SINGLE_PROJECT" || Boolean(input.projectCode), {
    message: "Project code is required for single project restore.",
  })
  .refine((input) => input.mode !== "SELECTED_CATEGORIES" || input.categories.length > 0, {
    message: "At least one category is required for selected category restore.",
  })
  .refine((input) => input.mode !== "SELECTED_FILES" || input.files.length > 0, {
    message: "At least one file is required for selected file restore.",
  });
