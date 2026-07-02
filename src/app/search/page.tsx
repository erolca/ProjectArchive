"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getApi } from "../../lib/api-client";
import type { EnterpriseSearchResult, SearchResultItem } from "../../modules/search/search.types";

const FILE_CATEGORIES = [
  "PLC",
  "HMI",
  "ROBOT",
  "ELECTRICAL",
  "MECHANICAL",
  "PNEUMATIC",
  "VISION",
  "CAMERA",
  "PHOTO",
  "VIDEO",
  "FAT",
  "SAT",
  "SPARE_PARTS",
  "DOCUMENT",
  "PHOTO_VIDEO",
  "BACKUP",
  "COMMISSIONING",
  "SERVICE",
];

const PROJECT_STATUSES = ["DESIGN", "SOFTWARE", "COMMISSIONING", "COMPLETED", "SERVICE", "ARCHIVED"];

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchShellSkeleton />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [filters, setFilters] = useState({
    q: initialQuery,
    category: searchParams.get("category") || "",
    manufacturer: searchParams.get("manufacturer") || "",
    platform: searchParams.get("platform") || "",
    customer: searchParams.get("customer") || "",
    projectStatus: searchParams.get("projectStatus") || "",
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    uploadedBy: searchParams.get("uploadedBy") || "",
  });
  const [result, setResult] = useState<EnterpriseSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPath = useMemo(() => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) {
        params.set(key, value.trim());
      }
    }

    params.set("limit", "10");

    return `/api/search?${params.toString()}`;
  }, [filters]);

  useEffect(() => {
    const nextQuery = searchParams.get("q") || "";
    setFilters((current) => (current.q === nextQuery ? current : { ...current, q: nextQuery }));
  }, [searchParams]);

  useEffect(() => {
    let isActive = true;

    async function loadSearch() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getApi<EnterpriseSearchResult>(requestPath);

        if (isActive) {
          setResult(data);
        }
      } catch (searchError) {
        if (isActive) {
          setError(searchError instanceof Error ? searchError.message : "Search failed.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadSearch();

    return () => {
      isActive = false;
    };
  }, [requestPath]);

  function updateFilter(name: keyof typeof filters, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  const totalResults = result
    ? result.totals.projects + result.totals.files + result.totals.activities + result.totals.users
    : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#263545] bg-[#111820] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#9fb0bf]">Enterprise Search</div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Global archive search</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#9fb0bf]">
              Search project metadata, customers, machine identifiers, file metadata, version notes, and authorized
              activity records.
            </p>
          </div>
          <div className="rounded-md border border-[#263545] bg-[#0f151d] px-4 py-3 text-sm text-[#d9e5ef]">
            <span className="font-semibold text-white">{isLoading ? "Searching" : totalResults}</span>{" "}
            {isLoading ? "metadata records" : "matching records"}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-4">
          <TextFilter
            label="Search"
            value={filters.q}
            placeholder="Project code, file name, customer..."
            onChange={(value) => updateFilter("q", value)}
          />
          <SelectFilter
            label="Category"
            value={filters.category}
            options={FILE_CATEGORIES}
            onChange={(value) => updateFilter("category", value)}
          />
          <TextFilter
            label="Manufacturer"
            value={filters.manufacturer}
            placeholder="Siemens, Beckhoff..."
            onChange={(value) => updateFilter("manufacturer", value)}
          />
          <TextFilter
            label="Platform / Software"
            value={filters.platform}
            placeholder="TIA Portal, TwinCAT..."
            onChange={(value) => updateFilter("platform", value)}
          />
          <TextFilter
            label="Customer"
            value={filters.customer}
            placeholder="Customer name"
            onChange={(value) => updateFilter("customer", value)}
          />
          <SelectFilter
            label="Project Status"
            value={filters.projectStatus}
            options={PROJECT_STATUSES}
            onChange={(value) => updateFilter("projectStatus", value)}
          />
          <TextFilter
            label="Uploaded By"
            value={filters.uploadedBy}
            placeholder="User name or email"
            onChange={(value) => updateFilter("uploadedBy", value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextFilter
              label="From"
              type="date"
              value={filters.dateFrom}
              onChange={(value) => updateFilter("dateFrom", value)}
            />
            <TextFilter
              label="To"
              type="date"
              value={filters.dateTo}
              onChange={(value) => updateFilter("dateTo", value)}
            />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-md border border-[#7f1d1d] bg-[#2a1010] px-4 py-3 text-sm text-[#fecaca]">{error}</div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <ResultGroup title="Projects" total={result?.totals.projects || 0} items={result?.groups.projects || []} />
        <ResultGroup title="Files" total={result?.totals.files || 0} items={result?.groups.files || []} />
        <ResultGroup
          title="Activities"
          total={result?.totals.activities || 0}
          items={result?.groups.activities || []}
          adminOnly
        />
        <ResultGroup title="Users" total={result?.totals.users || 0} items={result?.groups.users || []} adminOnly />
      </div>
    </div>
  );
}

function SearchShellSkeleton() {
  return (
    <div className="rounded-md border border-[#263545] bg-[#111820] p-5 text-sm text-[#9fb0bf]">
      Loading enterprise search...
    </div>
  );
}

function TextFilter({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0bf]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-[#263545] bg-[#0f151d] px-3 text-sm text-white outline-none placeholder:text-[#6f8294] focus:border-[#2f80ed]"
      />
    </label>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0bf]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-[#263545] bg-[#0f151d] px-3 text-sm text-white outline-none focus:border-[#2f80ed]"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResultGroup({
  title,
  total,
  items,
  adminOnly = false,
}: {
  title: string;
  total: number;
  items: SearchResultItem[];
  adminOnly?: boolean;
}) {
  return (
    <section className="rounded-md border border-[#263545] bg-[#111820]">
      <div className="flex items-center justify-between border-b border-[#263545] px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {adminOnly ? <p className="text-xs text-[#9fb0bf]">Visible when permitted</p> : null}
        </div>
        <span className="rounded border border-[#263545] bg-[#0f151d] px-2 py-1 text-xs font-semibold text-[#d9e5ef]">
          {total}
        </span>
      </div>
      <div className="divide-y divide-[#263545]">
        {items.length ? (
          items.map((item) => <ResultCard key={`${title}-${item.id}`} item={item} />)
        ) : (
          <div className="px-4 py-8 text-sm text-[#9fb0bf]">No matching {title.toLowerCase()} found.</div>
        )}
      </div>
    </section>
  );
}

function ResultCard({ item }: { item: SearchResultItem }) {
  return (
    <Link href={item.href} className="block px-4 py-4 hover:bg-[#16202a]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{item.title}</div>
          {item.subtitle ? <div className="mt-1 truncate text-sm text-[#9fb0bf]">{item.subtitle}</div> : null}
        </div>
        {item.date ? <div className="shrink-0 text-xs text-[#6f8294]">{formatDate(item.date)}</div> : null}
      </div>
      {item.metadata.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.metadata.slice(0, 8).map((metadata) => (
            <span
              key={`${item.id}-${metadata.label}`}
              className="max-w-full rounded border border-[#263545] bg-[#0f151d] px-2 py-1 text-xs text-[#d9e5ef]"
            >
              <span className="text-[#9fb0bf]">{metadata.label}:</span>{" "}
              <span className="break-words">{metadata.value}</span>
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
