import { ProjectStatus } from "@prisma/client";
import { z } from "zod";

const projectCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^PRJ-\d{4}-\d{3}$/, "Project code must use PRJ-YYYY-NNN format.");

const serialNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Serial number is required.")
  .max(80, "Serial number must be 80 characters or fewer.")
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Serial number must be URL-safe.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const customerInputSchema = z
  .object({
    customerId: z.number().int().positive().optional(),
    customerCode: optionalText(50).transform((value) => value?.toUpperCase()),
    customerName: optionalText(255),
    city: optionalText(120),
    country: optionalText(120),
    notes: optionalText(5000),
  })
  .superRefine((value, ctx) => {
    if (!value.customerId && !value.customerName) {
      ctx.addIssue({
        code: "custom",
        path: ["customerName"],
        message: "Customer name is required when customerId is not provided.",
      });
    }
  });

export const createProjectSchema = z.object({
  projectCode: projectCodeSchema,
  serialNumber: serialNumberSchema,
  machineName: z.string().trim().min(1).max(255),
  machineType: optionalText(120),
  customer: customerInputSchema,
  status: z.enum(ProjectStatus).default(ProjectStatus.DESIGN),
  description: optionalText(5000),
  customerFactory: optionalText(255),
  lineName: optionalText(255),
  plcBrand: optionalText(120),
  plcModel: optionalText(120),
  plcSoftwareVersion: optionalText(120),
  hmiBrand: optionalText(120),
  hmiModel: optionalText(120),
  hmiSoftwareVersion: optionalText(120),
  robotBrand: optionalText(120),
  robotModel: optionalText(120),
  robotController: optionalText(120),
  robotSoftwareVersion: optionalText(120),
  electricalDrawingNo: optionalText(120),
});

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one project field must be provided.",
  });

export const projectListQuerySchema = z.object({
  q: optionalText(255),
  projectCode: optionalText(30).transform((value) => value?.toUpperCase()),
  serialNumber: optionalText(80).transform((value) => value?.toUpperCase()),
  customerName: optionalText(255),
  machineName: optionalText(255),
  plcBrand: optionalText(120),
  hmiBrand: optionalText(120),
  robotBrand: optionalText(120),
  status: z.enum(ProjectStatus).optional(),
  sortBy: z
    .enum(["updatedAt", "createdAt", "projectCode", "customerName", "machineName", "status"])
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const projectIdSchema = z.number().int().positive();
export const projectCodeParamSchema = projectCodeSchema;
