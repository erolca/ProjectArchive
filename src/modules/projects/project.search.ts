import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { projectListQuerySchema } from "./project.validators";
import type { ProjectListQuery, ProjectListResult } from "./project.types";

const PROJECT_INCLUDE = {
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
} satisfies Prisma.ProjectInclude;

export async function listProjects(input: ProjectListQuery): Promise<ProjectListResult<Prisma.ProjectGetPayload<{
  include: typeof PROJECT_INCLUDE;
}>>> {
  const query = projectListQuerySchema.parse(input);
  const where = buildProjectWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [data, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      include: PROJECT_INCLUDE,
      orderBy: buildProjectOrderBy(query),
      skip,
      take: query.pageSize,
    }),
    prisma.project.count({
      where,
    }),
  ]);

  return {
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export function buildProjectWhere(query: ReturnType<typeof projectListQuerySchema.parse>): Prisma.ProjectWhereInput {
  const and: Prisma.ProjectWhereInput[] = [
    {
      deletedAt: null,
    },
  ];

  if (query.status) {
    and.push({ status: query.status });
  }

  if (query.projectCode) {
    and.push({ projectCode: { contains: query.projectCode } });
  }

  if (query.serialNumber) {
    and.push({ serialNumber: { contains: query.serialNumber } });
  }

  if (query.customerName) {
    and.push({ customer: { customerName: { contains: query.customerName } } });
  }

  if (query.machineName) {
    and.push({ machineName: { contains: query.machineName } });
  }

  if (query.plcBrand) {
    and.push({ plcBrand: { contains: query.plcBrand } });
  }

  if (query.hmiBrand) {
    and.push({ hmiBrand: { contains: query.hmiBrand } });
  }

  if (query.robotBrand) {
    and.push({ robotBrand: { contains: query.robotBrand } });
  }

  if (query.q) {
    and.push({
      OR: [
        { projectCode: { contains: query.q } },
        { serialNumber: { contains: query.q } },
        { machineName: { contains: query.q } },
        { plcBrand: { contains: query.q } },
        { hmiBrand: { contains: query.q } },
        { robotBrand: { contains: query.q } },
        { customer: { customerName: { contains: query.q } } },
        { customer: { customerCode: { contains: query.q.toUpperCase() } } },
      ],
    });
  }

  return {
    AND: and,
  };
}

function buildProjectOrderBy(
  query: ReturnType<typeof projectListQuerySchema.parse>,
): Prisma.ProjectOrderByWithRelationInput {
  if (query.sortBy === "customerName") {
    return {
      customer: {
        customerName: query.sortOrder,
      },
    };
  }

  return {
    [query.sortBy]: query.sortOrder,
  };
}

export { PROJECT_INCLUDE };
