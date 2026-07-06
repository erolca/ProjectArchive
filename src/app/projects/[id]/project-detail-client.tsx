"use client";

import { FormEvent, useEffect, useState } from "react";
import { StatusBadge } from "../../../components/ui/status-badge";
import { downloadApiFile, getApi, getApiBlob, postFormApi, putApi } from "../../../lib/api-client";
import { useCurrentUser } from "../../../lib/current-user";
import { ENGINEERING_METADATA_OPTIONS, resolveEngineeringMetadataCode } from "../../../lib/engineering-metadata";
import { formatBytes, formatDate, formatDateTime, shortHash } from "../../../lib/format";
import { getUserErrorMessage, sanitizeUserMessage } from "../../../lib/user-messages";

interface ProjectDetail {
  id: number;
  projectCode: string;
  serialNumber: string;
  machineName: string;
  machineType?: string | null;
  status: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  plcBrand?: string | null;
  plcModel?: string | null;
  plcSoftwareVersion?: string | null;
  hmiBrand?: string | null;
  hmiModel?: string | null;
  hmiSoftwareVersion?: string | null;
  robotBrand?: string | null;
  robotModel?: string | null;
  robotController?: string | null;
  robotSoftwareVersion?: string | null;
  customerFactory?: string | null;
  lineName?: string | null;
  electricalDrawingNo?: string | null;
  customer: {
    customerCode: string;
    customerName: string;
    city?: string | null;
    country?: string | null;
  };
}

interface ProjectGeneralForm {
  projectCode: string;
  serialNumber: string;
  customerName: string;
  machineName: string;
  machineType: string;
  plcBrand: string;
  hmiBrand: string;
  robotBrand: string;
  status: string;
}

const sectionGroups = [
  {
    label: "Overview",
    sections: ["General"],
  },
  {
    label: "Automation",
    sections: ["PLC", "HMI", "Robot", "Vision", "Camera"],
  },
  {
    label: "Engineering",
    sections: ["Electrical", "Mechanical", "Pneumatic"],
  },
  {
    label: "Documentation",
    sections: ["Documents", "Photos", "Videos", "FAT", "SAT"],
  },
  {
    label: "Lifecycle",
    sections: ["Service", "Commissioning", "Spare Parts", "Backups"],
  },
  {
    label: "System",
    sections: ["Versions", "Activity"],
  },
];
const projectStatusOptions = ["DESIGN", "SOFTWARE", "COMMISSIONING", "COMPLETED", "SERVICE", "ARCHIVED"];
const fileTabs = new Set([
  "PLC",
  "HMI",
  "Robot",
  "Electrical",
  "Mechanical",
  "Pneumatic",
  "Vision",
  "Camera",
  "Photos",
  "Videos",
  "FAT",
  "SAT",
  "Spare Parts",
  "Service",
  "Commissioning",
  "Backups",
  "Documents",
]);
const categoryByTab: Record<string, string> = {
  PLC: "PLC",
  HMI: "HMI",
  Robot: "ROBOT",
  Electrical: "ELECTRICAL",
  Mechanical: "MECHANICAL",
  Pneumatic: "PNEUMATIC",
  Vision: "VISION",
  Camera: "CAMERA",
  Photos: "PHOTO",
  Videos: "VIDEO",
  FAT: "FAT",
  SAT: "SAT",
  "Spare Parts": "SPARE_PARTS",
  Service: "SERVICE",
  Commissioning: "COMMISSIONING",
  Backups: "BACKUP",
  Documents: "DOCUMENT",
};

interface PrepareUploadResult {
  ready: boolean;
  warnings?: string[];
  storedFileName?: string;
  versionNo?: string;
  storagePath?: {
    relativePath: string;
  };
}

interface ProjectFileRow {
  id: number;
  category: string;
  platform?: string | null;
  manufacturer?: string | null;
  softwareName?: string | null;
  softwareVersion?: string | null;
  originalFileName: string;
  storedFileName: string;
  fileSize: string;
  currentVersionNo: string;
  uploadedAt: string;
  checksum: string;
  uploadedBy?: {
    username: string;
    email: string;
  } | null;
  versions?: Array<{
    id: number;
    versionNo: string;
    changeNote?: string | null;
    fileSize: string;
    checksum: string;
    uploadedAt: string;
    uploadedBy?: {
      username: string;
      email: string;
    } | null;
  }>;
}

interface BackupStatusSummary {
  destination?: string | null;
  status: string;
  lastBackup?: {
    finishedAt?: string | null;
    status?: string | null;
    size?: string | null;
    result?: unknown;
    destination?: string | null;
  };
}

interface CategoryIntelligenceSummary {
  label: string;
  category: string;
  manufacturer: string;
  softwareName: string;
  softwareVersion: string;
  latestArchiveVersion: string;
  fileCount: number;
  lastUploadDate: string | null;
}

type HealthItemStatus = "pass" | "warning" | "missing";

interface ArchiveHealthItem {
  label: string;
  status: HealthItemStatus;
  suggestion?: string;
}

interface ArchiveHealthAnalysis {
  score: number;
  badge: "Excellent" | "Good" | "Fair" | "Needs Attention";
  items: ArchiveHealthItem[];
  suggestions: string[];
}

interface ArchiveTreeItem {
  name: string;
  path: string;
  type: "folder" | "file";
  size?: number | null;
  children?: ArchiveTreeItem[];
}

interface FileIntelligenceField {
  label: string;
  value: string;
}

interface FileIntelligenceSection {
  title: string;
  fields: FileIntelligenceField[];
}

interface FileIntelligenceResult {
  kind: "pdf" | "image" | "video" | "archive" | "text" | "unsupported";
  status: "EXTRACTED" | "PARTIAL" | "UNSUPPORTED" | "FAILED";
  sections: FileIntelligenceSection[];
  warnings: string[];
}

interface EngineeringDetectionResult {
  detectedType: string | null;
  category: "PLC" | "ROBOT" | "HMI" | "VISION" | "ELECTRICAL" | "UNKNOWN";
  manufacturer: string | null;
  platform: string | null;
  confidence: number;
  evidence: string[];
  warnings: string[];
  scannerResults: EngineeringScannerResult[];
}

interface EngineeringScannerMetric {
  label: string;
  value: string | number | boolean;
}

interface EngineeringScannerResult {
  scannerName: string;
  detectedSystem: string;
  manufacturer: string;
  platform: string;
  confidence: number;
  summary: string;
  metrics: EngineeringScannerMetric[];
  evidence: string[];
  warnings: string[];
}

interface FilePreviewResult {
  kind: "pdf" | "image" | "video" | "text" | "archive" | "unsupported";
  contentType: string;
  contentUrl?: string;
  textContent?: string;
  archiveTree?: ArchiveTreeItem[];
  intelligence?: FileIntelligenceResult;
  engineeringDetection?: EngineeringDetectionResult;
  message?: string;
  metadata: {
    id: number;
    fileName: string;
    category: string;
    manufacturer?: string | null;
    softwareName?: string | null;
    softwareVersion?: string | null;
    platform?: string | null;
    archiveVersion: string;
    uploadedBy?: string | null;
    uploadedAt: string;
    fileSize: string;
    checksum: string;
    version: string;
  };
}

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const currentUser = useCurrentUser();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [status, setStatus] = useState("Loading project");
  const [generalForm, setGeneralForm] = useState<ProjectGeneralForm | null>(null);
  const [generalSaveMessage, setGeneralSaveMessage] = useState<string | null>(null);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [activeTab, setActiveTab] = useState("General");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [prepareResult, setPrepareResult] = useState<PrepareUploadResult | null>(null);
  const [files, setFiles] = useState<ProjectFileRow[]>([]);
  const [filesStatus, setFilesStatus] = useState("Loading files");
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreviewResult | null>(null);
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatusSummary | null>(null);

  function refreshFiles() {
    getApi<ProjectFileRow[]>(`/api/projects/${projectId}/files`)
      .then((result) => {
        setFiles(result);
        setFilesStatus(result.length === 0 ? "No files uploaded." : `${result.length} file records`);
      })
      .catch((error) => {
        setFilesStatus(getUserErrorMessage(error, "Could not load files."));
      });
  }

  useEffect(() => {
    getApi<ProjectDetail>(`/api/projects/${projectId}`)
      .then((result) => {
        setProject(result);
        setGeneralForm(toProjectGeneralForm(result));
        setStatus("Project loaded");
      })
      .catch((error) => {
        setStatus(getUserErrorMessage(error, "Could not load project."));
      });
  }, [projectId]);

  useEffect(() => {
    refreshFiles();
  }, [projectId]);

  useEffect(() => {
    getApi<BackupStatusSummary>("/api/backup/status")
      .then(setBackupStatus)
      .catch(() => {
        setBackupStatus(null);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  async function openPreview(fileId: number) {
    setPreview(null);
    setPreviewStatus("Loading preview...");

    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }

    try {
      const result = await getApi<FilePreviewResult>(`/api/files/${fileId}/preview`);
      setPreview(result);

      if (result.contentUrl) {
        const { blob } = await getApiBlob(result.contentUrl);
        setPreviewBlobUrl(URL.createObjectURL(blob));
      }

      setPreviewStatus(null);
    } catch (error) {
      setPreviewStatus(getUserErrorMessage(error, "Could not load preview."));
    }
  }

  const canEditProject = currentUser?.role === "ADMIN" || currentUser?.role === "ENGINEER";
  const generalChanges = project && generalForm ? buildProjectGeneralChanges(project, generalForm) : {};
  const hasGeneralChanges = Object.keys(generalChanges).length > 0;

  useEffect(() => {
    if (!hasGeneralChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasGeneralChanges]);

  async function saveProjectGeneralChanges() {
    if (!project || !generalForm || !hasGeneralChanges) {
      return;
    }

    setIsSavingGeneral(true);
    setGeneralSaveMessage(null);

    try {
      const updatedProject = await putApi<ProjectDetail>(`/api/projects/${projectId}`, generalChanges);
      setProject(updatedProject);
      setGeneralForm(toProjectGeneralForm(updatedProject));
      setGeneralSaveMessage("Project information saved.");
    } catch (error) {
      setGeneralSaveMessage(getUserErrorMessage(error, "Project information could not be saved."));
    } finally {
      setIsSavingGeneral(false);
    }
  }

  if (!project) {
    return <div className="rounded-md border border-[#263545] bg-[#111820] p-4 text-sm text-[#9fb0bf]">{status}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="text-sm text-[#38bdf8]">{project.projectCode}</div>
          <h2 className="text-2xl font-semibold text-white">{project.machineName}</h2>
          <p className="mt-1 text-sm text-[#9fb0bf]">
            {project.customer.customerName} - {project.serialNumber}
          </p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <SummaryTile label="Status" value={<StatusBadge value={project.status} />} />
          <SummaryTile label="Created" value={formatDate(project.createdAt)} />
          <SummaryTile label="Updated" value={formatDate(project.updatedAt)} />
        </div>
      </div>

      <SectionSelector activeSection={activeTab} files={files} onChange={setActiveTab} />

      <section className="grid gap-4 xl:grid-cols-3">
        <InfoCard title="Project Information">
          <Field label="Project Code" value={project.projectCode} />
          <Field label="Status" value={project.status} />
          <Field label="Created" value={formatDate(project.createdAt)} />
          <Field label="Updated" value={formatDate(project.updatedAt)} />
          <Field label="Description" value={project.description || "-"} />
        </InfoCard>
        <InfoCard title="Customer Information">
          <Field label="Customer Code" value={project.customer.customerCode || "-"} />
          <Field label="Customer Name" value={project.customer.customerName} />
          <Field label="Factory" value={project.customerFactory || "-"} />
          <Field label="City" value={project.customer.city || "-"} />
          <Field label="Country" value={project.customer.country || "-"} />
        </InfoCard>
        <InfoCard title="Machine Information">
          <Field label="Serial Number" value={project.serialNumber} />
          <Field label="Machine Name" value={project.machineName} />
          <Field label="Machine Type" value={project.machineType || "-"} />
          <Field label="Line Name" value={project.lineName || "-"} />
          <Field label="Drawing No" value={project.electricalDrawingNo || "-"} />
        </InfoCard>
      </section>

      <section className="rounded-md border border-[#263545] bg-[#111820] p-4">
        <div className="flex flex-col gap-1 border-b border-[#263545] pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Selected Section</div>
            <h3 className="mt-1 text-lg font-semibold text-white">{activeTab}</h3>
          </div>
          <div className="text-xs text-[#9fb0bf]">{getSectionGroupLabel(activeTab)}</div>
        </div>
        {activeTab === "General" ? (
          generalForm ? (
            <div className="space-y-4">
              <ProjectIntelligenceCard project={project} files={files} backupStatus={backupStatus} />
              <ProjectGeneralEditor
                form={generalForm}
                canEdit={Boolean(canEditProject)}
                isSaving={isSavingGeneral}
                hasChanges={hasGeneralChanges}
                message={generalSaveMessage}
                onChange={(field, value) => {
                  setGeneralForm((current) => (current ? { ...current, [field]: value } : current));
                  setGeneralSaveMessage(null);
                }}
                onSave={saveProjectGeneralChanges}
              />
            </div>
          ) : null
        ) : fileTabs.has(activeTab) ? (
          <FileTabContent
            tab={activeTab}
            files={files.filter((file) => categoryMatchesTab(file.category, activeTab))}
            filesStatus={filesStatus}
            downloadStatus={downloadStatus}
            onDownload={(fileId) => {
              setDownloadStatus("Downloading...");
              downloadApiFile(`/api/files/${fileId}/download`)
                .then(({ blob, fileName }) => {
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = fileName;
                  document.body.appendChild(anchor);
                  anchor.click();
                  anchor.remove();
                  URL.revokeObjectURL(url);
                  setDownloadStatus(`Downloaded ${fileName}.`);
                })
                .catch((error) => {
                  setDownloadStatus(getUserErrorMessage(error, "Could not download file."));
                });
            }}
            onPreview={openPreview}
            onUpload={() => {
              setPrepareResult(null);
              setUploadStatus(null);
              setIsUploadOpen(true);
            }}
          />
        ) : activeTab === "Versions" ? (
          <VersionHistory files={files} filesStatus={filesStatus} />
        ) : (
          <div className="mt-4 grid min-h-48 place-items-center border border-dashed border-[#263545] text-sm text-[#9fb0bf]">
            {activeTab} content will be connected in a later UI phase.
          </div>
        )}
      </section>

      {isUploadOpen ? (
        <UploadDialog
          projectId={projectId}
          activeTab={activeTab}
          uploadStatus={uploadStatus}
          prepareResult={prepareResult}
          onStatus={setUploadStatus}
          onPrepareResult={setPrepareResult}
          onUploaded={() => {
            refreshFiles();
            setIsUploadOpen(false);
          }}
          onClose={() => setIsUploadOpen(false)}
        />
      ) : null}
      {preview || previewStatus ? (
        <PreviewDialog
          preview={preview}
          status={previewStatus}
          blobUrl={previewBlobUrl}
          onClose={() => {
            setPreview(null);
            setPreviewStatus(null);
            if (previewBlobUrl) {
              URL.revokeObjectURL(previewBlobUrl);
              setPreviewBlobUrl(null);
            }
          }}
          onDownload={(fileId) => {
            setDownloadStatus("Downloading...");
            downloadApiFile(`/api/files/${fileId}/download`)
              .then(({ blob, fileName }) => {
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = fileName;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                URL.revokeObjectURL(url);
                setDownloadStatus(`Downloaded ${fileName}.`);
              })
              .catch((error) => {
                setDownloadStatus(getUserErrorMessage(error, "Could not download file."));
              });
          }}
        />
      ) : null}
    </div>
  );
}

function SectionSelector({
  activeSection,
  files,
  onChange,
}: {
  activeSection: string;
  files: ProjectFileRow[];
  onChange: (section: string) => void;
}) {
  const activeCount = countFilesForSection(files, activeSection);

  return (
    <section className="rounded-md border border-[#263545] bg-[#111820] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-end">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9fb0bf]">Project Section</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="max-w-full truncate text-xl font-semibold text-white">{activeSection}</div>
            <span className="rounded border border-[#2f80ed] bg-[#10243b] px-2 py-1 text-xs font-semibold text-[#93c5fd]">
              {getSectionGroupLabel(activeSection)}
            </span>
            {fileTabs.has(activeSection) ? (
              <span className="rounded border border-[#263545] bg-[#0f151d] px-2 py-1 text-xs font-semibold text-[#d9e5ef]">
                {activeCount} {activeCount === 1 ? "file" : "files"}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sectionGroups.map((group) => (
              <span
                key={group.label}
                className={`rounded border px-2 py-1 text-xs ${
                  getSectionGroupLabel(activeSection) === group.label
                    ? "border-[#2f80ed] bg-[#17304a] text-white"
                    : "border-[#263545] bg-[#0f151d] text-[#9fb0bf]"
                }`}
              >
                {group.label}
              </span>
            ))}
          </div>
        </div>
        <label className="block w-full">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0bf]">
            Select Archive Section
          </span>
          <select
            value={activeSection}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-full rounded-md border border-[#263545] bg-[#0f151d] px-3 text-sm font-semibold text-white outline-none focus:border-[#2f80ed]"
          >
            {sectionGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.sections.map((section) => (
                  <option key={section} value={section}>
                    {formatSectionOption(section, files)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function getSectionGroupLabel(section: string): string {
  const group = sectionGroups.find((item) => item.sections.includes(section));

  return group ? group.label : "Project Archive";
}

function ProjectIntelligenceCard({
  project,
  files,
  backupStatus,
}: {
  project: ProjectDetail;
  files: ProjectFileRow[];
  backupStatus: BackupStatusSummary | null;
}) {
  const summaries = buildProjectIntelligenceSummaries(files);
  const summaryByCategory = Object.fromEntries(summaries.map((summary) => [summary.category, summary]));
  const health = analyzeArchiveHealth(project, summaries, backupStatus);

  return (
    <section className="rounded-md border border-[#263545] bg-[#0f151d] p-5">
      <div className="border-b border-[#263545] pb-4">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Project Intelligence</div>
        <div className="mt-3 space-y-1">
          <h4 className="break-words text-xl font-semibold text-white">{project.projectCode}</h4>
          <div className="break-words text-sm font-semibold text-[#d9e5ef]">{project.customer.customerName}</div>
          <div className="break-words text-sm text-[#9fb0bf]">{project.machineName}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-b border-[#263545] pb-4 text-sm md:grid-cols-2">
        <IntelligenceLine label="Status" value={project.status} highlight />
        <IntelligenceLine label="Machine Type" value={project.machineType || "Not specified"} />
        <IntelligenceLine label="PLC" value={formatSystemSummary(summaryByCategory.PLC, project.plcBrand)} />
        <IntelligenceLine label="HMI" value={formatSystemSummary(summaryByCategory.HMI, project.hmiBrand)} />
        <IntelligenceLine label="Robot" value={formatSystemSummary(summaryByCategory.ROBOT, [project.robotBrand, project.robotModel || project.robotController].filter(Boolean).join(" "))} />
        <IntelligenceLine label="Vision" value={formatSystemSummary(summaryByCategory.VISION)} />
        <IntelligenceLine label="Electrical" value={formatSystemSummary(summaryByCategory.ELECTRICAL)} />
        <IntelligenceLine label="Mechanical" value={formatSystemSummary(summaryByCategory.MECHANICAL)} />
      </div>

      <div className="mt-4 border-b border-[#263545] pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Archive Health</div>
            <div className="mt-1 text-xs text-[#9fb0bf]">Completeness analysis based on existing archive records.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded border px-2 py-1 text-xs font-semibold ${getHealthBadgeClass(health.badge)}`}>
              {health.badge}
            </span>
            <div className="text-lg font-semibold text-[#86efac]">{health.score}%</div>
          </div>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#263545]">
          <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${health.score}%` }} />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {health.items.map((item) => (
            <HealthChecklistRow key={item.label} item={item} />
          ))}
        </div>
        {health.suggestions.length > 0 ? (
          <div className="mt-4 rounded-md border border-[#3f3320] bg-[#1a140b] p-3">
            <div className="text-xs font-semibold uppercase text-[#f8d28b]">Suggestions</div>
            <ul className="mt-2 space-y-1 text-xs text-[#f8d28b]">
              {health.suggestions.slice(0, 5).map((suggestion) => (
                <li key={suggestion} className="break-words">
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <IntelligenceLine label="Latest Backup" value={formatLatestBackupStatus(backupStatus)} highlight />
        <IntelligenceLine label="Last Backup Date" value={formatOptionalDateTime(backupStatus?.lastBackup?.finishedAt)} />
        <IntelligenceLine label="Last Update" value={formatRelativeDate(project.updatedAt)} />
        <IntelligenceLine label="Last Uploaded File" value={getLastUploadedFile(files)?.originalFileName || "No files uploaded"} />
      </div>
    </section>
  );
}

function HealthChecklistRow({ item }: { item: ArchiveHealthItem }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-md border border-[#263545] bg-[#111820] px-3 py-2">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getHealthDotClass(item.status)}`} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="break-words text-sm font-semibold text-white">{item.label}</span>
          <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase ${getHealthStatusClass(item.status)}`}>
            {item.status}
          </span>
        </div>
        {item.suggestion ? <div className="mt-1 break-words text-xs text-[#9fb0bf]">{item.suggestion}</div> : null}
      </div>
    </div>
  );
}

function IntelligenceLine({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="grid min-w-0 grid-cols-[120px_minmax(0,1fr)] gap-3 rounded-md border border-[#263545] bg-[#111820] px-3 py-2">
      <div className="text-xs font-semibold uppercase text-[#64748b]">{label}</div>
      <div className={`break-words text-sm font-semibold ${highlight ? "text-[#86efac]" : "text-white"}`}>{value}</div>
    </div>
  );
}

function ProjectGeneralEditor({
  form,
  canEdit,
  isSaving,
  hasChanges,
  message,
  onChange,
  onSave,
}: {
  form: ProjectGeneralForm;
  canEdit: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  message: string | null;
  onChange: (field: keyof ProjectGeneralForm, value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      {!canEdit ? (
        <div className="rounded-md border border-[#263545] bg-[#0f151d] px-3 py-2 text-sm text-[#9fb0bf]">
          You can view project information, but your role cannot edit it.
        </div>
      ) : null}
      <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
        <EditableField label="Project Code" value={form.projectCode} disabled={!canEdit || isSaving} onChange={(value) => onChange("projectCode", value.toUpperCase())} />
        <EditableField label="Serial Number" value={form.serialNumber} disabled={!canEdit || isSaving} onChange={(value) => onChange("serialNumber", value.toUpperCase())} />
        <EditableField label="Customer Name" value={form.customerName} disabled={!canEdit || isSaving} onChange={(value) => onChange("customerName", value)} />
        <EditableField label="Machine Name" value={form.machineName} disabled={!canEdit || isSaving} onChange={(value) => onChange("machineName", value)} />
        <EditableField label="Machine Type" value={form.machineType} disabled={!canEdit || isSaving} onChange={(value) => onChange("machineType", value)} />
        <EditableField label="PLC Brand" value={form.plcBrand} disabled={!canEdit || isSaving} onChange={(value) => onChange("plcBrand", value)} />
        <EditableField label="HMI Brand" value={form.hmiBrand} disabled={!canEdit || isSaving} onChange={(value) => onChange("hmiBrand", value)} />
        <EditableField label="Robot Brand" value={form.robotBrand} disabled={!canEdit || isSaving} onChange={(value) => onChange("robotBrand", value)} />
        <label className="block">
          <span className="text-xs font-semibold uppercase text-[#64748b]">Project Status</span>
          <select
            value={form.status}
            onChange={(event) => onChange("status", event.target.value)}
            disabled={!canEdit || isSaving}
            className="mt-1 h-10 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 text-sm font-semibold text-white outline-none focus:border-[#2f80ed] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {projectStatusOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-[#263545] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[#9fb0bf]">
          {message || (hasChanges ? "Unsaved project information changes." : "Project information is up to date.")}
        </div>
        {canEdit && hasChanges ? (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-10 rounded-md bg-[#2f80ed] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-[#64748b]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-1 h-10 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 text-sm text-white outline-none focus:border-[#2f80ed] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function toProjectGeneralForm(project: ProjectDetail): ProjectGeneralForm {
  return {
    projectCode: project.projectCode,
    serialNumber: project.serialNumber,
    customerName: project.customer.customerName,
    machineName: project.machineName,
    machineType: project.machineType || "",
    plcBrand: project.plcBrand || "",
    hmiBrand: project.hmiBrand || "",
    robotBrand: project.robotBrand || "",
    status: project.status,
  };
}

function buildProjectGeneralChanges(project: ProjectDetail, form: ProjectGeneralForm): Record<string, unknown> {
  const initial = toProjectGeneralForm(project);
  const changes: Record<string, unknown> = {};

  addStringChange(changes, "projectCode", initial.projectCode, form.projectCode);
  addStringChange(changes, "serialNumber", initial.serialNumber, form.serialNumber);
  addStringChange(changes, "machineName", initial.machineName, form.machineName);
  addStringChange(changes, "machineType", initial.machineType, form.machineType);
  addStringChange(changes, "plcBrand", initial.plcBrand, form.plcBrand);
  addStringChange(changes, "hmiBrand", initial.hmiBrand, form.hmiBrand);
  addStringChange(changes, "robotBrand", initial.robotBrand, form.robotBrand);
  addStringChange(changes, "status", initial.status, form.status);

  if (normalizeFormValue(initial.customerName) !== normalizeFormValue(form.customerName)) {
    changes.customer = {
      customerName: normalizeFormValue(form.customerName),
    };
  }

  return changes;
}

function addStringChange(changes: Record<string, unknown>, key: string, oldValue: string, newValue: string): void {
  if (normalizeFormValue(oldValue) !== normalizeFormValue(newValue)) {
    changes[key] = normalizeFormValue(newValue);
  }
}

function normalizeFormValue(value: string): string {
  return value.trim();
}

function formatSectionOption(section: string, files: ProjectFileRow[]): string {
  if (!fileTabs.has(section)) {
    return section;
  }

  const count = countFilesForSection(files, section);

  return `${section} (${count})`;
}

function countFilesForSection(files: ProjectFileRow[], section: string): number {
  return files.filter((file) => categoryMatchesTab(file.category, section)).length;
}

function FileTabContent({
  tab,
  files,
  filesStatus,
  downloadStatus,
  onDownload,
  onPreview,
  onUpload,
}: {
  tab: string;
  files: ProjectFileRow[];
  filesStatus: string;
  downloadStatus: string | null;
  onDownload: (fileId: number) => void;
  onPreview: (fileId: number) => void;
  onUpload: () => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[#9fb0bf]">{tab} files for this project.</p>
        <button onClick={onUpload} className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white">
          Upload File
        </button>
      </div>
      <div className="overflow-hidden rounded-md border border-[#263545]">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-[#0f151d] text-xs uppercase text-[#9fb0bf]">
            <tr>
              <th className="px-4 py-3">File Name</th>
              <th className="px-4 py-3">Engineering Metadata</th>
              <th className="px-4 py-3">Latest Version</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">SHA256</th>
              <th className="px-4 py-3">Uploaded By</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr className="border-t border-[#263545] text-[#9fb0bf]">
                <td className="px-4 py-4" colSpan={8}>
                  {filesStatus}
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr key={file.id} className="border-t border-[#263545] text-[#d9e5ef]">
                  <td className="max-w-[320px] px-4 py-3"><span className="block break-words">{file.originalFileName}</span></td>
                  <td className="px-4 py-3">{formatEngineeringMetadata(file)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded border border-[#22c55e] bg-[#0d2618] px-2 py-1 text-xs font-semibold text-[#86efac]">
                      {file.versions?.[0]?.versionNo || file.currentVersionNo} Latest
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatBytes(file.fileSize)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{shortHash(file.checksum)}</td>
                  <td className="px-4 py-3">{file.uploadedBy?.username || "-"}</td>
                  <td className="px-4 py-3">{formatDateTime(file.uploadedAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onPreview(file.id)}
                        className="rounded-md border border-[#64748b] px-3 py-1 text-xs font-semibold text-[#d9e5ef]"
                      >
                        Preview
                      </button>
                    <button
                      onClick={() => onDownload(file.id)}
                      className="rounded-md border border-[#2f80ed] px-3 py-1 text-xs font-semibold text-[#38bdf8]"
                    >
                      Download
                    </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {downloadStatus ? (
        <div className="rounded-md border border-[#263545] bg-[#0f151d] p-3 text-sm text-[#9fb0bf]">
          {downloadStatus}
        </div>
      ) : null}
    </div>
  );
}

function VersionHistory({ files, filesStatus }: { files: ProjectFileRow[]; filesStatus: string }) {
  const rows = files.flatMap((file) =>
    (file.versions || []).map((version, index) => ({
      ...version,
      fileId: file.id,
      fileName: file.originalFileName,
      category: file.category,
      platform: file.platform,
      isLatest: index === 0,
    })),
  );

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-[#263545]">
      <table className="w-full min-w-[960px] border-collapse text-left text-sm">
        <thead className="bg-[#0f151d] text-xs uppercase text-[#9fb0bf]">
          <tr>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Version</th>
            <th className="px-4 py-3">Size</th>
            <th className="px-4 py-3">SHA256</th>
            <th className="px-4 py-3">Uploaded By</th>
            <th className="px-4 py-3">Upload Date</th>
            <th className="px-4 py-3">Change Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t border-[#263545] text-[#9fb0bf]">
              <td className="px-4 py-4" colSpan={8}>
                {filesStatus}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={`${row.fileId}-${row.id}`} className="border-t border-[#263545] text-[#d9e5ef]">
                <td className="px-4 py-3">{row.fileName}</td>
                <td className="px-4 py-3">{row.category}</td>
                <td className="px-4 py-3">
                  {row.isLatest ? (
                    <span className="rounded border border-[#22c55e] bg-[#0d2618] px-2 py-1 text-xs font-semibold text-[#86efac]">
                      {row.versionNo} Latest
                    </span>
                  ) : (
                    row.versionNo
                  )}
                </td>
                <td className="px-4 py-3">{formatBytes(row.fileSize)}</td>
                <td className="px-4 py-3 font-mono text-xs">{shortHash(row.checksum)}</td>
                <td className="px-4 py-3">{row.uploadedBy?.username || "-"}</td>
                <td className="px-4 py-3">{formatDateTime(row.uploadedAt)}</td>
                <td className="px-4 py-3">{row.changeNote || "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PreviewDialog({
  preview,
  status,
  blobUrl,
  onClose,
  onDownload,
}: {
  preview: FilePreviewResult | null;
  status: string | null;
  blobUrl: string | null;
  onClose: () => void;
  onDownload: (fileId: number) => void;
}) {
  const [imageFit, setImageFit] = useState(true);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70">
      <div className="flex h-full w-full max-w-6xl flex-col border-l border-[#263545] bg-[#0b0f14] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#263545] px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-white">File Preview</h3>
            <p className="text-xs text-[#9fb0bf]">{preview?.metadata.fileName || status || "Loading"}</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-[#263545] px-3 py-1 text-sm text-[#c6d3df]">
            Close
          </button>
        </div>

        {status ? (
          <div className="m-4 rounded-md border border-[#263545] bg-[#111820] p-4 text-sm text-[#9fb0bf]">{status}</div>
        ) : null}

        {preview ? (
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <PreviewMetadata preview={preview} onDownload={() => onDownload(preview.metadata.id)} />
            <div className="min-h-0 overflow-hidden rounded-md border border-[#263545] bg-[#111820]">
              <div className="flex items-center justify-between border-b border-[#263545] px-3 py-2">
                <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{preview.kind}</span>
                {preview.kind === "image" ? (
                  <button
                    onClick={() => setImageFit((value) => !value)}
                    className="rounded-md border border-[#263545] px-3 py-1 text-xs text-[#d9e5ef]"
                  >
                    {imageFit ? "Zoom" : "Fit"}
                  </button>
                ) : null}
              </div>
              <PreviewContent preview={preview} blobUrl={blobUrl} imageFit={imageFit} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewMetadata({ preview, onDownload }: { preview: FilePreviewResult; onDownload: () => void }) {
  const metadata = preview.metadata;
  const previewNotice = getPreviewNotice(preview);

  return (
    <aside className="overflow-auto rounded-md border border-[#263545] bg-[#111820] p-4">
      <div className="grid gap-3 text-sm">
        <PreviewField label="File name" value={metadata.fileName} />
        <PreviewField label="Category" value={metadata.category} />
        <PreviewField label="Manufacturer" value={metadata.manufacturer || "-"} />
        <PreviewField label="Platform / Software" value={metadata.softwareName || metadata.platform || "-"} />
        <PreviewField label="Software Version" value={metadata.softwareVersion || "-"} />
        <PreviewField label="Archive Version" value={metadata.archiveVersion} />
        <PreviewField label="Version" value={metadata.version} />
        <PreviewField label="Uploaded by" value={metadata.uploadedBy || "-"} />
        <PreviewField label="Upload date" value={formatDateTime(metadata.uploadedAt)} />
        <PreviewField label="File size" value={formatBytes(metadata.fileSize)} />
        <PreviewField label="SHA256" value={metadata.checksum} mono />
      </div>
      {previewNotice ? <PreviewNoticeCard notice={previewNotice} /> : null}
      <EngineeringDetectionPanel detection={preview.engineeringDetection} />
      <EngineeringScannerPanel scanners={preview.engineeringDetection?.scannerResults || []} />
      <FileIntelligencePanel intelligence={preview.intelligence} />
      <button onClick={onDownload} className="mt-4 w-full rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white">
        Download
      </button>
    </aside>
  );
}

function EngineeringDetectionPanel({ detection }: { detection?: EngineeringDetectionResult }) {
  if (!detection) {
    return null;
  }

  const hasDetection = Boolean(detection.detectedType);

  return (
    <section className="mt-4 rounded-md border border-[#263545] bg-[#0f151d] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0bf]">Engineering Detection</div>
          <div className="mt-1 text-sm font-semibold text-white">
            {hasDetection ? detection.detectedType : "No specific engineering system detected"}
          </div>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${getDetectionConfidenceClass(detection.confidence)}`}>
          {detection.confidence}%
        </span>
      </div>

      {hasDetection ? (
        <div className="mt-3 grid gap-2 text-sm">
          <PreviewField label="Detected Type" value={detection.detectedType || "-"} />
          <PreviewField label="Category" value={detection.category} />
          <PreviewField label="Manufacturer" value={detection.manufacturer || "-"} />
          <PreviewField label="Platform / Software" value={detection.platform || "-"} />
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-[#263545] bg-[#111820] p-3 text-xs text-[#9fb0bf]">
          No specific engineering system was detected from this file.
        </div>
      )}

      {detection.evidence.length ? (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase text-[#64748b]">Evidence</div>
          <ul className="mt-2 space-y-1 text-xs text-[#d9e5ef]">
            {detection.evidence.map((item) => (
              <li key={item} className="break-words rounded border border-[#263545] bg-[#111820] px-2 py-1">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {detection.warnings.length ? (
        <div className="mt-3 space-y-2">
          {detection.warnings.map((warning) => (
            <PreviewNoticeCard
              key={warning}
              compact
              notice={{
                type: "warning",
                title: "Detection note",
                body: sanitizeUserMessage(warning, "Additional engineering hints were found in this file."),
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function EngineeringScannerPanel({ scanners }: { scanners: EngineeringScannerResult[] }) {
  if (!scanners.length) {
    return (
      <section className="mt-4 rounded-md border border-[#263545] bg-[#0f151d] p-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0bf]">Engineering Scanner</div>
        <div className="mt-2 text-xs text-[#9fb0bf]">No vendor-specific scanner details were found for this file.</div>
      </section>
    );
  }

  return (
    <section className="mt-4 rounded-md border border-[#263545] bg-[#0f151d] p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0bf]">Engineering Scanner</div>
      <div className="mt-3 space-y-3">
        {scanners.slice(0, 3).map((scanner) => (
          <div key={`${scanner.scannerName}-${scanner.detectedSystem}`} className="rounded-md border border-[#263545] bg-[#111820] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words text-sm font-semibold text-white">{scanner.detectedSystem}</div>
                <div className="mt-1 text-xs text-[#9fb0bf]">{scanner.scannerName}</div>
              </div>
              <span className={`rounded border px-2 py-1 text-xs font-semibold ${getDetectionConfidenceClass(scanner.confidence)}`}>
                {scanner.confidence}%
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#d9e5ef]">{scanner.summary}</p>

            {scanner.metrics.length ? (
              <div className="mt-3 grid gap-2">
                {scanner.metrics.map((metric) => (
                  <PreviewField key={`${scanner.scannerName}-${metric.label}`} label={metric.label} value={String(metric.value)} />
                ))}
              </div>
            ) : null}

            {scanner.evidence.length ? (
              <div className="mt-3">
                <div className="text-xs font-semibold uppercase text-[#64748b]">Evidence</div>
                <ul className="mt-2 space-y-1 text-xs text-[#d9e5ef]">
                  {scanner.evidence.slice(0, 6).map((item) => (
                    <li key={item} className="break-words rounded border border-[#263545] bg-[#0f151d] px-2 py-1">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {scanner.warnings.length ? (
              <div className="mt-3 space-y-2">
                {scanner.warnings.map((warning) => (
                  <PreviewNoticeCard
                    key={warning}
                    compact
                    notice={{
                      type: "information",
                      title: "Scanner note",
                      body: sanitizeUserMessage(warning, "Some scanner details could not be extracted."),
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function FileIntelligencePanel({ intelligence }: { intelligence?: FileIntelligenceResult }) {
  if (!intelligence) {
    return null;
  }
  const warnings = intelligence.warnings.map((warning) =>
    formatIntelligenceWarning(intelligence.kind, intelligence.status, warning),
  );

  return (
    <section className="mt-4 rounded-md border border-[#263545] bg-[#0f151d] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb0bf]">File Intelligence</div>
          <div className="mt-1 text-sm font-semibold text-white">{formatPreviewKind(intelligence.kind)} metadata</div>
        </div>
        <span className={`rounded border px-2 py-1 text-xs font-semibold ${getIntelligenceStatusClass(intelligence.status)}`}>
          {intelligence.status}
        </span>
      </div>

      {intelligence.sections.length ? (
        <div className="mt-3 space-y-4">
          {intelligence.sections.map((section) => (
            <div key={section.title}>
              <div className="text-xs font-semibold uppercase text-[#64748b]">{section.title}</div>
              <div className="mt-2 grid gap-2">
                {section.fields.map((field) => (
                  <PreviewField key={`${section.title}-${field.label}`} label={field.label} value={field.value} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-[#9fb0bf]">No extractable metadata was found for this file.</div>
      )}

      {warnings.length ? (
        <div className="mt-3 space-y-2">
          {warnings.map((warning) => (
            <PreviewNoticeCard key={warning.title} notice={warning} compact />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function getDetectionConfidenceClass(confidence: number): string {
  if (confidence >= 85) return "border-[#22c55e] bg-[#0d2618] text-[#86efac]";
  if (confidence >= 60) return "border-[#3f2d14] bg-[#140f08] text-[#f8d28b]";

  return "border-[#263545] bg-[#111820] text-[#9fb0bf]";
}

interface PreviewNotice {
  type?: "information" | "warning" | "success";
  title: string;
  body: string;
  note?: string;
}

function PreviewNoticeCard({ notice, compact = false }: { notice: PreviewNotice; compact?: boolean }) {
  return (
    <div className={`mt-4 rounded-md border ${getNoticeClassName(notice.type || "information")} ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs font-bold ${getNoticeIconClassName(notice.type || "information")}`}>
          {getNoticeIcon(notice.type || "information")}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white">{notice.title}</div>
          <p className="mt-1 text-xs leading-5 text-[#d9e5ef]">{notice.body}</p>
          {notice.note ? <p className="mt-1 text-xs leading-5 text-[#c6a96c]">{notice.note}</p> : null}
        </div>
      </div>
    </div>
  );
}

function getPreviewNotice(preview: FilePreviewResult): PreviewNotice | null {
  if (!preview.message) {
    return null;
  }

  if (preview.kind === "archive") {
    return archivePreviewUnavailableNotice();
  }

  return {
    type: "information",
    title: "Preview note",
    body: sanitizeUserMessage(preview.message, "Preview is not available for this file. The file remains available for download."),
  };
}

function formatIntelligenceWarning(
  kind: FileIntelligenceResult["kind"],
  status: FileIntelligenceResult["status"],
  warning: string,
): PreviewNotice {
  if (kind === "archive" && isArchivePreviewTechnicalWarning(warning)) {
    return archivePreviewUnavailableNotice();
  }

  if (kind === "video" && isVideoMetadataTechnicalWarning(warning)) {
    return {
      type: "information",
      title: "Video Information",
      body: "The video can be previewed normally. Advanced technical metadata is not available on this server.",
    };
  }

  if (status === "PARTIAL") {
    return {
      type: "information",
      title: "File Intelligence",
      body: "Some advanced file information could not be extracted. The uploaded file remains fully usable.",
    };
  }

  return {
    type: "information",
    title: "File intelligence note",
    body: sanitizeUserMessage(warning, "Some advanced file information could not be extracted. The uploaded file remains fully usable."),
  };
}

function isArchivePreviewTechnicalWarning(warning: string): boolean {
  const normalized = warning.toLowerCase();

  return (
    normalized.includes("archive listing") ||
    normalized.includes("archive tree preview") ||
    normalized.includes("tooling") ||
    normalized.includes("archive format")
  );
}

function isVideoMetadataTechnicalWarning(warning: string): boolean {
  const normalized = warning.toLowerCase();

  return normalized.includes("ffprobe") || normalized.includes("video metadata");
}

function archivePreviewUnavailableNotice(): PreviewNotice {
  return {
    type: "information",
    title: "Archive Preview",
    body:
      "Preview is not available for this archive format on this server. The archive was uploaded successfully and remains available for download.",
    note: "If additional archive support is installed in the future, preview will become available automatically.",
  };
}

function getNoticeClassName(type: "information" | "warning" | "success"): string {
  if (type === "success") return "border-[#166534] bg-[#0d2618]";
  if (type === "warning") return "border-[#3f2d14] bg-[#140f08]";

  return "border-[#1d4ed8] bg-[#0b1b2d]";
}

function getNoticeIconClassName(type: "information" | "warning" | "success"): string {
  if (type === "success") return "border-[#86efac] text-[#86efac]";
  if (type === "warning") return "border-[#f8d28b] text-[#f8d28b]";

  return "border-[#93c5fd] text-[#93c5fd]";
}

function getNoticeIcon(type: "information" | "warning" | "success"): string {
  if (type === "success") return "OK";
  if (type === "warning") return "!";

  return "i";
}

function getIntelligenceStatusClass(status: FileIntelligenceResult["status"]): string {
  if (status === "EXTRACTED") return "border-[#22c55e] bg-[#0d2618] text-[#86efac]";
  if (status === "PARTIAL") return "border-[#3f2d14] bg-[#140f08] text-[#f8d28b]";
  if (status === "FAILED") return "border-[#7f1d1d] bg-[#2a1010] text-[#fecaca]";

  return "border-[#263545] bg-[#111820] text-[#9fb0bf]";
}

function formatPreviewKind(kind: FileIntelligenceResult["kind"]): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function PreviewField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-[#64748b]">{label}</div>
      <div className={`mt-1 break-all text-[#d9e5ef] ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function PreviewContent({ preview, blobUrl, imageFit }: { preview: FilePreviewResult; blobUrl: string | null; imageFit: boolean }) {
  if (preview.kind === "pdf") {
    return blobUrl ? <iframe src={blobUrl} title={preview.metadata.fileName} className="h-full min-h-[70vh] w-full bg-white" /> : <PreviewLoading />;
  }

  if (preview.kind === "image") {
    return (
      <div className="grid h-full min-h-[70vh] place-items-center overflow-auto bg-[#06090d] p-4">
        {blobUrl ? (
          <img
            src={blobUrl}
            alt={preview.metadata.fileName}
            className={imageFit ? "max-h-full max-w-full object-contain" : "max-w-none"}
          />
        ) : (
          <PreviewLoading />
        )}
      </div>
    );
  }

  if (preview.kind === "video") {
    return (
      <div className="grid h-full min-h-[70vh] place-items-center bg-black p-4">
        {blobUrl ? <video src={blobUrl} controls className="max-h-full max-w-full" /> : <PreviewLoading />}
      </div>
    );
  }

  if (preview.kind === "text") {
    return (
      <pre className={`h-full min-h-[70vh] overflow-auto p-4 text-xs leading-5 text-[#d9e5ef] ${getSyntaxClass(preview.metadata.fileName)}`}>
        {preview.textContent || ""}
      </pre>
    );
  }

  if (preview.kind === "archive") {
    return <ArchiveTree tree={preview.archiveTree || []} />;
  }

  return (
    <div className="grid min-h-[70vh] place-items-center p-6 text-center text-sm text-[#9fb0bf]">
      <div>
        <div className="text-base font-semibold text-white">Preview unavailable</div>
        <p className="mt-2">{preview.message || "This file type is not supported for in-browser preview."}</p>
      </div>
    </div>
  );
}

function PreviewLoading() {
  return <div className="p-4 text-sm text-[#9fb0bf]">Loading preview content...</div>;
}

function ArchiveTree({ tree }: { tree: ArchiveTreeItem[] }) {
  if (tree.length === 0) {
    return <div className="p-4 text-sm text-[#9fb0bf]">No files were found in this archive preview. The original archive remains available for download.</div>;
  }

  return (
    <div className="h-full min-h-[70vh] overflow-auto p-4 text-sm text-[#d9e5ef]">
      {tree.map((item) => (
        <ArchiveTreeNode key={item.path} item={item} depth={0} />
      ))}
    </div>
  );
}

function ArchiveTreeNode({ item, depth }: { item: ArchiveTreeItem; depth: number }) {
  return (
    <div>
      <div className="flex gap-2 py-1" style={{ paddingLeft: depth * 16 }}>
        <span className={item.type === "folder" ? "text-[#38bdf8]" : "text-[#d9e5ef]"}>{item.type === "folder" ? "[DIR]" : "[FILE]"}</span>
        <span className="break-all">{item.name}</span>
        {item.type === "file" ? <span className="ml-auto whitespace-nowrap text-[#64748b]">{formatBytes(item.size || 0)}</span> : null}
      </div>
      {item.children?.map((child) => (
        <ArchiveTreeNode key={child.path} item={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function getSyntaxClass(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "json") return "text-[#d9e5ef]";
  if (extension === "xml") return "text-[#c4b5fd]";
  if (extension === "csv") return "text-[#bfdbfe]";
  return "text-[#d9e5ef]";
}

function UploadDialog({
  projectId,
  activeTab,
  uploadStatus,
  prepareResult,
  onStatus,
  onPrepareResult,
  onUploaded,
  onClose,
}: {
  projectId: string;
  activeTab: string;
  uploadStatus: string | null;
  prepareResult: PrepareUploadResult | null;
  onStatus: (value: string | null) => void;
  onPrepareResult: (value: PrepareUploadResult | null) => void;
  onUploaded: () => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(categoryByTab[activeTab] || "DOCUMENT");
  const [manufacturer, setManufacturer] = useState("");
  const [softwareName, setSoftwareName] = useState("");
  const [softwareVersion, setSoftwareVersion] = useState("");
  const [versionNo, setVersionNo] = useState("V1.0");
  const [changeNote, setChangeNote] = useState("");
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const metadataOptions = ENGINEERING_METADATA_OPTIONS.filter((option) => option.category === category);
  const manufacturerOptions = Array.from(new Set(metadataOptions.map((option) => option.manufacturer)));
  const platformOptions = metadataOptions.filter((option) => option.manufacturer === manufacturer);
  const platformCode = resolveEngineeringMetadataCode(category, manufacturer, softwareName);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStatus(null);
    onPrepareResult(null);

    if (!file) {
      onStatus("Select a file first.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.set("file", file);
      formData.set("category", category);
      formData.set("versionNo", versionNo);
      formData.set("confirmWarnings", String(confirmWarnings));

      if (platformCode) {
        formData.set("platform", platformCode);
      }

      if (manufacturer) {
        formData.set("manufacturer", manufacturer);
      }

      if (softwareName) {
        formData.set("softwareName", softwareName);
      }

      if (softwareVersion) {
        formData.set("softwareVersion", softwareVersion);
      }

      if (changeNote) {
        formData.set("changeNote", changeNote);
      }

      const result = await postFormApi<PrepareUploadResult>(`/api/projects/${projectId}/files/upload`, formData);

      onPrepareResult(result);
      onStatus("File uploaded.");
      onUploaded();
    } catch (error) {
      onStatus(getUserErrorMessage(error, "Upload could not be completed."));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-md border border-[#263545] bg-[#111820] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Upload Project File</h3>
          <button onClick={onClose} disabled={isUploading} className="rounded-md border border-[#263545] px-3 py-1 text-sm text-[#c6d3df] disabled:cursor-not-allowed disabled:opacity-40">
            Close
          </button>
        </div>

        <form onSubmit={handleUpload} className="mt-4 grid gap-4">
          <label className="block">
            <span className="text-sm text-[#c6d3df]">File</span>
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField
              label="Category"
              value={category}
              onChange={(value) => {
                setCategory(value);
                setManufacturer("");
                setSoftwareName("");
              }}
              options={[
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
                "SERVICE",
                "COMMISSIONING",
                "BACKUP",
                "DOCUMENT",
                "PHOTO_VIDEO",
              ]}
            />
            <SelectField
              label="Manufacturer"
              value={manufacturer}
              onChange={(value) => {
                setManufacturer(value);
                setSoftwareName("");
              }}
              options={["", ...manufacturerOptions]}
            />
            <SelectField
              label="Platform / Software"
              value={softwareName}
              onChange={setSoftwareName}
              options={["", ...platformOptions.map((option) => option.platform)]}
            />
            <TextInput label="Software Version" value={softwareVersion} onChange={setSoftwareVersion} placeholder="Optional" />
            <TextInput label="Version" value={versionNo} onChange={setVersionNo} placeholder="V1.0" />
            <label className="flex items-end gap-2 pb-2 text-sm text-[#c6d3df]">
              <input
                type="checkbox"
                checked={confirmWarnings}
                onChange={(event) => setConfirmWarnings(event.target.checked)}
                className="h-4 w-4"
              />
              Confirm category/platform warnings
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-[#c6d3df]">Change Note</span>
            <textarea
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
            />
          </label>

          {prepareResult?.warnings?.length ? (
            <div className="rounded-md border border-[#f59e0b] bg-[#1f1a0d] p-3 text-sm text-[#f8d28b]">
              {prepareResult.warnings.map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
            </div>
          ) : null}

          {prepareResult?.ready ? (
            <div className="rounded-md border border-[#263545] bg-[#0f151d] p-3 text-sm text-[#9fb0bf]">
              <div className="break-all">Stored name: {prepareResult.storedFileName}</div>
              <div>Version: {prepareResult.versionNo}</div>
              <div className="break-all">Path: {prepareResult.storagePath?.relativePath}</div>
            </div>
          ) : null}

          {uploadStatus ? <div className="text-sm text-[#9fb0bf]">{uploadStatus}</div> : null}

          <div className="flex justify-end gap-2 border-t border-[#263545] pt-4">
            <button type="button" onClick={onClose} disabled={isUploading} className="rounded-md border border-[#263545] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={isUploading} className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {isUploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-[#c6d3df]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-sm text-[#c6d3df]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || "Select"}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <dl className="mt-4 grid gap-3 text-sm">{children}</dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3">
      <dt className="text-[#9fb0bf]">{label}</dt>
      <dd className="text-white">{value}</dd>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#263545] bg-[#111820] px-3 py-2">
      <div className="text-xs uppercase text-[#9fb0bf]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function buildProjectIntelligenceSummaries(files: ProjectFileRow[]): CategoryIntelligenceSummary[] {
  return [
    buildCategoryIntelligenceSummary("PLC", "PLC", files),
    buildCategoryIntelligenceSummary("HMI", "HMI", files),
    buildCategoryIntelligenceSummary("Robot", "ROBOT", files),
    buildCategoryIntelligenceSummary("Vision", "VISION", files),
    buildCategoryIntelligenceSummary("Electrical", "ELECTRICAL", files),
    buildCategoryIntelligenceSummary("Mechanical", "MECHANICAL", files),
    buildCategoryIntelligenceSummary("FAT", "FAT", files),
    buildCategoryIntelligenceSummary("SAT", "SAT", files),
    buildCategoryIntelligenceSummary("Service", "SERVICE", files),
    buildCategoryIntelligenceSummary("Backup", "BACKUP", files),
  ];
}

function buildCategoryIntelligenceSummary(
  label: string,
  category: string,
  files: ProjectFileRow[],
): CategoryIntelligenceSummary {
  const categoryFiles = files
    .filter((file) => file.category === category)
    .sort((first, second) => new Date(second.uploadedAt).getTime() - new Date(first.uploadedAt).getTime());
  const latest = categoryFiles[0];

  return {
    label,
    category,
    manufacturer: latest?.manufacturer || "-",
    softwareName: latest?.softwareName || latest?.platform || "-",
    softwareVersion: latest?.softwareVersion || "-",
    latestArchiveVersion: latest?.versions?.[0]?.versionNo || latest?.currentVersionNo || "-",
    fileCount: categoryFiles.length,
    lastUploadDate: latest?.uploadedAt || null,
  };
}

function getLastUploadedFile(files: ProjectFileRow[]): ProjectFileRow | null {
  return [...files].sort((first, second) => new Date(second.uploadedAt).getTime() - new Date(first.uploadedAt).getTime())[0] || null;
}

function formatOptionalDateTime(value?: string | null): string {
  return value ? formatDateTime(value) : "Not available";
}

function formatSystemSummary(summary?: CategoryIntelligenceSummary, fallback?: string | null): string {
  if (summary && summary.fileCount > 0) {
    const parts = [summary.manufacturer, summary.softwareName, summary.softwareVersion].filter((part) => part && part !== "-");

    return parts.length > 0 ? parts.join(" / ") : `${summary.fileCount} file${summary.fileCount === 1 ? "" : "s"}`;
  }

  return fallback?.trim() || "Not uploaded yet";
}

function analyzeArchiveHealth(
  project: ProjectDetail,
  summaries: CategoryIntelligenceSummary[],
  backupStatus: BackupStatusSummary | null,
): ArchiveHealthAnalysis {
  const hasCategory = (category: string) => summaries.some((summary) => summary.category === category && summary.fileCount > 0);
  const backupAvailable = hasCategory("BACKUP") || Boolean(backupStatus?.lastBackup?.finishedAt);
  const backupStatusValue = backupStatus?.lastBackup?.status || backupStatus?.status;
  const projectInfoStatus = getProjectInformationStatus(project);
  const items: ArchiveHealthItem[] = [
    buildCategoryHealthItem("PLC uploaded", "PLC", hasCategory("PLC")),
    buildCategoryHealthItem("HMI uploaded", "HMI", hasCategory("HMI")),
    buildCategoryHealthItem("Robot uploaded", "Robot", hasCategory("ROBOT")),
    buildCategoryHealthItem("Vision uploaded", "Vision", hasCategory("VISION")),
    buildCategoryHealthItem("Electrical uploaded", "Electrical", hasCategory("ELECTRICAL")),
    buildCategoryHealthItem("Mechanical uploaded", "Mechanical", hasCategory("MECHANICAL")),
    buildCategoryHealthItem("FAT uploaded", "FAT", hasCategory("FAT")),
    buildCategoryHealthItem("SAT uploaded", "SAT", hasCategory("SAT")),
    buildCategoryHealthItem("Service documents uploaded", "Service", hasCategory("SERVICE")),
    {
      label: "Backup available",
      status: backupAvailable ? "pass" : "missing",
      suggestion: backupAvailable ? undefined : "Upload a project backup archive or run a system backup.",
    },
    {
      label: "Backup verified",
      status: isSuccessfulBackupStatus(backupStatusValue) ? "warning" : "missing",
      suggestion: isSuccessfulBackupStatus(backupStatusValue)
        ? "Latest backup completed. Run backup verification from Settings to confirm integrity."
        : "Run and verify a backup from Settings.",
    },
    {
      label: "Restore tested",
      status: "missing",
      suggestion: "Run a restore dry run and record the result when restore history is available.",
    },
    {
      label: "Project information completed",
      status: projectInfoStatus,
      suggestion: projectInfoStatus === "pass" ? undefined : "Complete project code, serial number, customer, machine name, machine type, and status.",
    },
  ];
  const total = items.reduce((sum, item) => sum + (item.status === "pass" ? 1 : item.status === "warning" ? 0.5 : 0), 0);
  const score = Math.round((total / items.length) * 100);
  const suggestions = items
    .filter((item) => item.status !== "pass" && item.suggestion)
    .map((item) => item.suggestion as string);

  return {
    score,
    badge: getHealthBadge(score),
    items,
    suggestions,
  };
}

function buildCategoryHealthItem(label: string, displayCategory: string, exists: boolean): ArchiveHealthItem {
  return {
    label,
    status: exists ? "pass" : "missing",
    suggestion: exists ? undefined : `Upload ${displayCategory} archive files for this project.`,
  };
}

function getProjectInformationStatus(project: ProjectDetail): HealthItemStatus {
  const requiredFields = [
    project.projectCode,
    project.serialNumber,
    project.customer.customerName,
    project.machineName,
    project.status,
  ];

  if (requiredFields.some((field) => !field?.trim())) {
    return "missing";
  }

  return project.machineType?.trim() ? "pass" : "warning";
}

function getHealthBadge(score: number): ArchiveHealthAnalysis["badge"] {
  if (score >= 90) {
    return "Excellent";
  }

  if (score >= 75) {
    return "Good";
  }

  if (score >= 55) {
    return "Fair";
  }

  return "Needs Attention";
}

function getHealthBadgeClass(badge: ArchiveHealthAnalysis["badge"]): string {
  if (badge === "Excellent") {
    return "border-[#22c55e] bg-[#0d2618] text-[#86efac]";
  }

  if (badge === "Good") {
    return "border-[#2f80ed] bg-[#10243b] text-[#93c5fd]";
  }

  if (badge === "Fair") {
    return "border-[#f59e0b] bg-[#241908] text-[#f8d28b]";
  }

  return "border-[#ef4444] bg-[#2a1111] text-[#fca5a5]";
}

function getHealthDotClass(status: HealthItemStatus): string {
  if (status === "pass") {
    return "bg-[#22c55e]";
  }

  if (status === "warning") {
    return "bg-[#f59e0b]";
  }

  return "bg-[#ef4444]";
}

function getHealthStatusClass(status: HealthItemStatus): string {
  if (status === "pass") {
    return "border-[#22c55e] bg-[#0d2618] text-[#86efac]";
  }

  if (status === "warning") {
    return "border-[#f59e0b] bg-[#241908] text-[#f8d28b]";
  }

  return "border-[#ef4444] bg-[#2a1111] text-[#fca5a5]";
}

function formatLatestBackupStatus(backupStatus: BackupStatusSummary | null): string {
  const status = backupStatus?.lastBackup?.status || backupStatus?.status;

  if (!status) {
    return "Not available";
  }

  if (isSuccessfulBackupStatus(status)) {
    return "Completed";
  }

  return status.replaceAll("_", " ");
}

function isSuccessfulBackupStatus(status?: string | null): boolean {
  return status === "COMPLETED";
}

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  return formatDate(value);
}

function formatEngineeringMetadata(file: Pick<ProjectFileRow, "manufacturer" | "softwareName" | "softwareVersion" | "platform">): string {
  const friendly = [file.manufacturer, file.softwareName, file.softwareVersion].filter(Boolean).join(" / ");

  return friendly || file.platform || "-";
}

function categoryMatchesTab(category: string, tab: string): boolean {
  if (tab === "Documents") {
    return ["DOCUMENT", "PHOTO_VIDEO"].includes(category);
  }

  return categoryByTab[tab] === category;
}
