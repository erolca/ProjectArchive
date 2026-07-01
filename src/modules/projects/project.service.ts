import { ActivityAction, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/auth.types";
import { createProjectFolders } from "../storage/storage.service";
import { logActivity } from "../activity/activity.service";
import { listProjects } from "./project.search";
import { createProjectSchema, projectCodeParamSchema, projectIdSchema, updateProjectSchema } from "./project.validators";
import type { CreateProjectInput, CustomerInput, ProjectListQuery, UpdateProjectInput } from "./project.types";

const PROJECT_DETAIL_INCLUDE = {
  customer: true,
  createdBy: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      username: true,
      email: true,
    },
  },
  revisions: {
    orderBy: {
      revisionDate: "desc",
    },
  },
  tags: {
    include: {
      tag: true,
    },
  },
} satisfies Prisma.ProjectInclude;

export async function createProject(user: AuthenticatedUser, input: CreateProjectInput) {
  requirePermission(user, "projects:create");

  const data = createProjectSchema.parse(input);

  await assertProjectCodeAvailable(data.projectCode);
  await assertSerialNumberAvailable(data.serialNumber);

  const customer = await resolveCustomer(data.customer);
  const project = await prisma.project.create({
    data: {
      projectCode: data.projectCode,
      serialNumber: data.serialNumber,
      machineName: data.machineName,
      machineType: data.machineType,
      customerId: customer.id,
      status: data.status,
      description: data.description,
      customerFactory: data.customerFactory,
      lineName: data.lineName,
      plcBrand: data.plcBrand,
      plcModel: data.plcModel,
      plcSoftwareVersion: data.plcSoftwareVersion,
      hmiBrand: data.hmiBrand,
      hmiModel: data.hmiModel,
      hmiSoftwareVersion: data.hmiSoftwareVersion,
      robotBrand: data.robotBrand,
      robotModel: data.robotModel,
      robotController: data.robotController,
      robotSoftwareVersion: data.robotSoftwareVersion,
      electricalDrawingNo: data.electricalDrawingNo,
      createdById: user.id,
      updatedById: user.id,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });

  try {
    await createProjectFolders(project.projectCode);
  } catch (error) {
    await prisma.project.update({
      where: {
        id: project.id,
      },
      data: {
        deletedAt: new Date(),
        updatedById: user.id,
      },
    });

    throw error;
  }

  await logActivity({
    userId: user.id,
    projectId: project.id,
    action: ActivityAction.PROJECT_CREATED,
    entityType: "Project",
    entityId: project.id,
    details: `Project ${project.projectCode} created.`,
  });

  return project;
}

export async function updateProject(user: AuthenticatedUser, projectId: number, input: UpdateProjectInput) {
  requirePermission(user, "projects:update");

  const id = projectIdSchema.parse(projectId);
  const data = updateProjectSchema.parse(input);

  const existingProject = await prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!existingProject) {
    throw new Error("Project not found.");
  }

  if (data.serialNumber && data.serialNumber !== existingProject.serialNumber) {
    await assertSerialNumberAvailable(data.serialNumber, id);
  }

  const customerId = data.customer ? (await resolveCustomer(data.customer)).id : existingProject.customerId;
  const project = await prisma.project.update({
    where: {
      id,
    },
    data: {
      serialNumber: data.serialNumber,
      machineName: data.machineName,
      machineType: data.machineType,
      customerId,
      status: data.status,
      description: data.description,
      customerFactory: data.customerFactory,
      lineName: data.lineName,
      plcBrand: data.plcBrand,
      plcModel: data.plcModel,
      plcSoftwareVersion: data.plcSoftwareVersion,
      hmiBrand: data.hmiBrand,
      hmiModel: data.hmiModel,
      hmiSoftwareVersion: data.hmiSoftwareVersion,
      robotBrand: data.robotBrand,
      robotModel: data.robotModel,
      robotController: data.robotController,
      robotSoftwareVersion: data.robotSoftwareVersion,
      electricalDrawingNo: data.electricalDrawingNo,
      updatedById: user.id,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });

  await logActivity({
    userId: user.id,
    projectId: project.id,
    action: ActivityAction.PROJECT_UPDATED,
    entityType: "Project",
    entityId: project.id,
    details: `Project ${project.projectCode} updated.`,
  });

  return project;
}

export async function getProjectById(user: AuthenticatedUser, projectId: number) {
  requirePermission(user, "projects:read");

  const id = projectIdSchema.parse(projectId);

  return prisma.project.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });
}

export async function resolveProjectShortLink(user: AuthenticatedUser, projectCode: string) {
  requirePermission(user, "projects:read");

  const safeProjectCode = projectCodeParamSchema.parse(projectCode);

  return prisma.project.findFirst({
    where: {
      projectCode: safeProjectCode,
      deletedAt: null,
    },
    include: PROJECT_DETAIL_INCLUDE,
  });
}

export async function searchProjects(user: AuthenticatedUser, query: ProjectListQuery) {
  requirePermission(user, "projects:read");

  return listProjects(query);
}

async function resolveCustomer(input: CustomerInput) {
  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: {
        id: input.customerId,
        deletedAt: null,
      },
    });

    if (!customer) {
      throw new Error("Customer not found.");
    }

    return customer;
  }

  const customerCode = input.customerCode || buildCustomerCode(input.customerName || "");

  return prisma.customer.upsert({
    where: {
      customerCode,
    },
    update: {
      customerName: input.customerName,
      city: input.city,
      country: input.country,
      notes: input.notes,
      deletedAt: null,
    },
    create: {
      customerCode,
      customerName: input.customerName || customerCode,
      city: input.city,
      country: input.country,
      notes: input.notes,
    },
  });
}

async function assertProjectCodeAvailable(projectCode: string): Promise<void> {
  const existing = await prisma.project.findUnique({
    where: {
      projectCode,
    },
  });

  if (existing) {
    throw new Error("Project code already exists.");
  }
}

async function assertSerialNumberAvailable(serialNumber: string, excludeProjectId?: number): Promise<void> {
  const existing = await prisma.project.findUnique({
    where: {
      serialNumber,
    },
  });

  if (existing && existing.id !== excludeProjectId) {
    throw new Error("Serial number already exists.");
  }
}

function buildCustomerCode(customerName: string): string {
  const normalized = customerName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();

  if (!normalized) {
    throw new Error("Customer code or customer name is required.");
  }

  return normalized.slice(0, 50);
}
