"use client";

const statusStyles: Record<string, string> = {
  DESIGN: "border-[#64748b] bg-[#111827] text-[#cbd5e1]",
  SOFTWARE: "border-[#2f80ed] bg-[#10243b] text-[#93c5fd]",
  COMMISSIONING: "border-[#f59e0b] bg-[#2b1f0b] text-[#f8d28b]",
  COMPLETED: "border-[#22c55e] bg-[#0d2618] text-[#86efac]",
  SERVICE: "border-[#38bdf8] bg-[#0c2a35] text-[#7dd3fc]",
  ARCHIVED: "border-[#475569] bg-[#0f172a] text-[#94a3b8]",
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded border px-2 py-1 text-xs font-semibold uppercase ${
        statusStyles[value] || "border-[#263545] bg-[#0f151d] text-[#c6d3df]"
      }`}
    >
      {value}
    </span>
  );
}
