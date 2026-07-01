"use client";

import { FormEvent, useEffect, useState } from "react";
import { StatusBadge } from "../../../components/ui/status-badge";
import { downloadApiFile, getApi, postFormApi } from "../../../lib/api-client";
import { formatBytes, formatDate, formatDateTime, shortHash } from "../../../lib/format";

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

const tabs = [
  "General",
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
  "Versions",
  "Activity",
];
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

export function ProjectDetailClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [status, setStatus] = useState("Loading project");
  const [activeTab, setActiveTab] = useState("General");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [prepareResult, setPrepareResult] = useState<PrepareUploadResult | null>(null);
  const [files, setFiles] = useState<ProjectFileRow[]>([]);
  const [filesStatus, setFilesStatus] = useState("Loading files");
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  function refreshFiles() {
    getApi<ProjectFileRow[]>(`/api/projects/${projectId}/files`)
      .then((result) => {
        setFiles(result);
        setFilesStatus(result.length === 0 ? "No files uploaded." : `${result.length} file records`);
      })
      .catch((error) => {
        setFilesStatus(error instanceof Error ? error.message : "Could not load files.");
      });
  }

  useEffect(() => {
    getApi<ProjectDetail>(`/api/projects/${projectId}`)
      .then((result) => {
        setProject(result);
        setStatus("Project loaded");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Could not load project.");
      });
  }, [projectId]);

  useEffect(() => {
    refreshFiles();
  }, [projectId]);

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

      <div className="flex gap-2 overflow-x-auto border-b border-[#263545] pb-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md border px-3 py-2 text-sm ${
              activeTab === tab
                ? "border-[#2f80ed] bg-[#17304a] text-white"
                : "border-[#263545] bg-[#111820] text-[#c6d3df]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

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
        <h3 className="text-sm font-semibold text-white">{activeTab}</h3>
        {activeTab === "General" ? (
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <Field label="PLC Brand" value={project.plcBrand || "-"} />
            <Field label="PLC Model" value={project.plcModel || "-"} />
            <Field label="PLC Version" value={project.plcSoftwareVersion || "-"} />
            <Field label="HMI Brand" value={project.hmiBrand || "-"} />
            <Field label="HMI Model" value={project.hmiModel || "-"} />
            <Field label="HMI Version" value={project.hmiSoftwareVersion || "-"} />
            <Field label="Robot Brand" value={project.robotBrand || "-"} />
            <Field label="Robot Model" value={project.robotModel || "-"} />
            <Field label="Robot Controller" value={project.robotController || "-"} />
          </dl>
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
                  setDownloadStatus(error instanceof Error ? error.message : "Could not download file.");
                });
            }}
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
    </div>
  );
}

function FileTabContent({
  tab,
  files,
  filesStatus,
  downloadStatus,
  onDownload,
  onUpload,
}: {
  tab: string;
  files: ProjectFileRow[];
  filesStatus: string;
  downloadStatus: string | null;
  onDownload: (fileId: number) => void;
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
              <th className="px-4 py-3">Platform</th>
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
                  <td className="px-4 py-3">{file.originalFileName}</td>
                  <td className="px-4 py-3">{file.platform || "-"}</td>
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
                    <button
                      onClick={() => onDownload(file.id)}
                      className="rounded-md border border-[#2f80ed] px-3 py-1 text-xs font-semibold text-[#38bdf8]"
                    >
                      Download
                    </button>
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
  const [platform, setPlatform] = useState("");
  const [versionNo, setVersionNo] = useState("V1.0");
  const [changeNote, setChangeNote] = useState("");
  const [confirmWarnings, setConfirmWarnings] = useState(false);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStatus(null);
    onPrepareResult(null);

    if (!file) {
      onStatus("Select a file first.");
      return;
    }

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("category", category);
      formData.set("versionNo", versionNo);
      formData.set("confirmWarnings", String(confirmWarnings));

      if (platform) {
        formData.set("platform", platform);
      }

      if (changeNote) {
        formData.set("changeNote", changeNote);
      }

      const result = await postFormApi<PrepareUploadResult>(`/api/projects/${projectId}/files/upload`, formData);

      onPrepareResult(result);
      onStatus("File uploaded.");
      onUploaded();
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-md border border-[#263545] bg-[#111820] p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Upload Project File</h3>
          <button onClick={onClose} className="rounded-md border border-[#263545] px-3 py-1 text-sm text-[#c6d3df]">
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
              onChange={setCategory}
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
            <TextInput label="Platform" value={platform} onChange={setPlatform} placeholder="SIEMENS_TIA" />
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
              <div>Stored name: {prepareResult.storedFileName}</div>
              <div>Version: {prepareResult.versionNo}</div>
              <div>Path: {prepareResult.storagePath?.relativePath}</div>
            </div>
          ) : null}

          {uploadStatus ? <div className="text-sm text-[#9fb0bf]">{uploadStatus}</div> : null}

          <div className="flex justify-end gap-2 border-t border-[#263545] pt-4">
            <button type="button" onClick={onClose} className="rounded-md border border-[#263545] px-4 py-2 text-sm text-white">
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white">
              Upload File
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
            {option}
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

function categoryMatchesTab(category: string, tab: string): boolean {
  if (tab === "Documents") {
    return ["DOCUMENT", "PHOTO_VIDEO"].includes(category);
  }

  return categoryByTab[tab] === category;
}
