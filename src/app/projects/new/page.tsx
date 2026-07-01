"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postApi } from "../../../lib/api-client";

const statusOptions = ["DESIGN", "SOFTWARE", "COMMISSIONING", "COMPLETED", "SERVICE", "ARCHIVED"];

interface CreatedProject {
  id: number;
  projectCode: string;
}

type FieldErrors = Partial<Record<keyof NewProjectForm, string>>;

interface NewProjectForm {
  projectCode: string;
  serialNumber: string;
  customerName: string;
  machineName: string;
  machineType: string;
  plcBrand: string;
  hmiBrand: string;
  robotBrand: string;
  status: string;
  description: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<NewProjectForm>({
    projectCode: "",
    serialNumber: "",
    customerName: "",
    machineName: "",
    machineType: "",
    plcBrand: "",
    hmiBrand: "",
    robotBrand: "",
    status: "DESIGN",
    description: "",
  });
  const [message, setMessage] = useState("Project code must use PRJ-YYYY-NNN format.");
  const [messageType, setMessageType] = useState<"info" | "success" | "error">("info");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateProjectForm(form);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setMessage("Fix the highlighted fields before creating the project.");
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setMessage("Creating project...");
    setMessageType("info");

    try {
      const project = await postApi<CreatedProject>("/api/projects", {
        projectCode: form.projectCode.trim().toUpperCase(),
        serialNumber: form.serialNumber.trim().toUpperCase(),
        customer: {
          customerName: form.customerName.trim(),
        },
        machineName: form.machineName.trim(),
        machineType: emptyToUndefined(form.machineType),
        plcBrand: emptyToUndefined(form.plcBrand),
        hmiBrand: emptyToUndefined(form.hmiBrand),
        robotBrand: emptyToUndefined(form.robotBrand),
        status: form.status,
        description: emptyToUndefined(form.description),
      });

      if (!project?.id) {
        throw new Error("Project was created but the API did not return a project id.");
      }

      setMessage(`Project ${project.projectCode} created. Opening project detail...`);
      setMessageType("success");
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project could not be created.");
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">New Project</h2>
        <p className="mt-1 text-sm text-[#9fb0bf]">Create a customer machine archive record.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-md border border-[#263545] bg-[#111820] p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField label="Project Code" value={form.projectCode} error={fieldErrors.projectCode} onChange={(value) => updateField("projectCode", value)} />
          <TextField label="Serial Number" value={form.serialNumber} error={fieldErrors.serialNumber} onChange={(value) => updateField("serialNumber", value)} />
          <TextField label="Customer Name" value={form.customerName} error={fieldErrors.customerName} onChange={(value) => updateField("customerName", value)} />
          <TextField label="Machine Name" value={form.machineName} error={fieldErrors.machineName} onChange={(value) => updateField("machineName", value)} />
          <TextField label="Machine Type" value={form.machineType} onChange={(value) => updateField("machineType", value)} />
          <TextField label="PLC Brand" value={form.plcBrand} onChange={(value) => updateField("plcBrand", value)} />
          <TextField label="HMI Brand" value={form.hmiBrand} onChange={(value) => updateField("hmiBrand", value)} />
          <TextField label="Robot Brand" value={form.robotBrand} onChange={(value) => updateField("robotBrand", value)} />
          <label className="block">
            <span className="text-sm text-[#c6d3df]">Status</span>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
              className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="block lg:col-span-2">
            <span className="text-sm text-[#c6d3df]">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#263545] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            role={messageType === "error" ? "alert" : "status"}
            className={`rounded-md border px-3 py-2 text-sm ${getMessageClassName(messageType)}`}
          >
            {message}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-[#c6d3df]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className={`mt-1 w-full rounded-md border bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed] ${
          error ? "border-[#ef4444]" : "border-[#263545]"
        }`}
      />
      {error ? <span className="mt-1 block text-xs text-[#fca5a5]">{error}</span> : null}
    </label>
  );
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function validateProjectForm(form: NewProjectForm): FieldErrors {
  const errors: FieldErrors = {};

  if (!/^PRJ-\d{4}-\d{3}$/.test(form.projectCode.trim().toUpperCase())) {
    errors.projectCode = "Use PRJ-YYYY-NNN format, for example PRJ-2026-001.";
  }

  if (!form.serialNumber.trim()) {
    errors.serialNumber = "Serial number is required.";
  } else if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(form.serialNumber.trim().toUpperCase())) {
    errors.serialNumber = "Use uppercase letters, numbers, and dashes only.";
  }

  if (!form.customerName.trim()) {
    errors.customerName = "Customer name is required.";
  }

  if (!form.machineName.trim()) {
    errors.machineName = "Machine name is required.";
  }

  return errors;
}

function getMessageClassName(type: "info" | "success" | "error"): string {
  if (type === "success") {
    return "border-[#14532d] bg-[#07130d] text-[#86efac]";
  }

  if (type === "error") {
    return "border-[#7f1d1d] bg-[#1f0d0d] text-[#fca5a5]";
  }

  return "border-[#263545] bg-[#0f151d] text-[#9fb0bf]";
}
