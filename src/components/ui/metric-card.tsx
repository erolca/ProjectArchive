"use client";

export function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
      <div className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      {detail ? <div className="mt-2 text-xs text-[#748596]">{detail}</div> : null}
    </div>
  );
}
