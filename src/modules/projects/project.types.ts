import type { ProjectStatus } from "@prisma/client";

export interface CustomerInput {
  customerId?: number;
  customerCode?: string;
  customerName?: string;
  city?: string;
  country?: string;
  notes?: string;
}

export interface CreateProjectInput {
  projectCode: string;
  serialNumber: string;
  machineName: string;
  machineType?: string;
  customer: CustomerInput;
  status?: ProjectStatus;
  description?: string;
  customerFactory?: string;
  lineName?: string;
  plcBrand?: string;
  plcModel?: string;
  plcSoftwareVersion?: string;
  hmiBrand?: string;
  hmiModel?: string;
  hmiSoftwareVersion?: string;
  robotBrand?: string;
  robotModel?: string;
  robotController?: string;
  robotSoftwareVersion?: string;
  electricalDrawingNo?: string;
}

export type UpdateProjectInput = Partial<
  Omit<CreateProjectInput, "projectCode" | "customer">
> & {
  customer?: CustomerInput;
};

export interface ProjectListQuery {
  q?: string;
  projectCode?: string;
  serialNumber?: string;
  customerName?: string;
  machineName?: string;
  plcBrand?: string;
  hmiBrand?: string;
  robotBrand?: string;
  status?: ProjectStatus;
  sortBy?: "updatedAt" | "createdAt" | "projectCode" | "customerName" | "machineName" | "status";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface ProjectListResult<TProject> {
  data: TProject[];
  page: number;
  pageSize: number;
  total: number;
}
