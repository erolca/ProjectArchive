import { FileCategory, ProjectStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((value) => (value ? value : undefined));

const optionalDate = optionalText.refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
  message: "Date filter must be a valid date.",
});

export const enterpriseSearchQuerySchema = z.object({
  q: optionalText,
  category: z.nativeEnum(FileCategory).optional(),
  manufacturer: optionalText,
  platform: optionalText,
  customer: optionalText,
  projectStatus: z.nativeEnum(ProjectStatus).optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate,
  uploadedBy: optionalText,
  limit: z.coerce.number().int().min(1).max(25).default(8),
});
