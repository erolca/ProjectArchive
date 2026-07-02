import type { FileCategory, ProjectStatus } from "@prisma/client";

export interface EnterpriseSearchQuery {
  q?: string;
  category?: FileCategory;
  manufacturer?: string;
  platform?: string;
  customer?: string;
  projectStatus?: ProjectStatus;
  dateFrom?: string;
  dateTo?: string;
  uploadedBy?: string;
  limit?: number;
}

export interface SearchMetadata {
  label: string;
  value: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  metadata: SearchMetadata[];
  date?: string;
}

export interface EnterpriseSearchResult {
  query: EnterpriseSearchQuery;
  groups: {
    projects: SearchResultItem[];
    files: SearchResultItem[];
    activities: SearchResultItem[];
    users: SearchResultItem[];
  };
  totals: {
    projects: number;
    files: number;
    activities: number;
    users: number;
  };
}
