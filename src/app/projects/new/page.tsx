"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { postApi } from "../../../lib/api-client";

const statusOptions = ["DESIGN", "SOFTWARE", "COMMISSIONING", "COMPLETED", "SERVICE", "ARCHIVED"];

interface CreatedProject {
  id: number;
  projectCode: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
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
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const project = await postApi<CreatedProject>("/api/projects", {
        projectCode: form.projectCode,
        serialNumber: form.serialNumber,
        customer: {
          customerName: form.customerName,
        },
        machineName: form.machineName,
        machineType: emptyToUndefined(form.machineType),
        plcBrand: emptyToUndefined(form.plcBrand),
        hmiBrand: emptyToUndefined(form.hmiBrand),
        robotBrand: emptyToUndefined(form.robotBrand),
        status: form.status,
        description: emptyToUndefined(form.description),
      });

      router.push(`/projects/${project.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project could not be created.");
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
          <TextField label="Project Code" value={form.projectCode} onChange={(value) => updateField("projectCode", value)} />
          <TextField label="Serial Number" value={form.serialNumber} onChange={(value) => updateField("serialNumber", value)} />
          <TextField label="Customer Name" value={form.customerName} onChange={(value) => updateField("customerName", value)} />
          <TextField label="Machine Name" value={form.machineName} onChange={(value) => updateField("machineName", value)} />
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
          <div className="text-sm text-[#9fb0bf]">{message || "Project code must use PRJ-YYYY-NNN format."}</div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Creating" : "Create Project"}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-[#c6d3df]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      />
    </label>
  );
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}
