import { cn } from "@/lib/utils";

export function BarSeries({
  data,
  className
}: {
  data: Array<{ label: string; value: number; hint?: string }>;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <div className={cn("flex h-40 items-end gap-1.5", className)}>
      {data.map((item) => (
        <div key={item.label} className="group flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-loop-500/80 transition group-hover:bg-loop-600"
            style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}
            title={`${item.label}: ${item.value}${item.hint ? ` (${item.hint})` : ""}`}
          />
        </div>
      ))}
    </div>
  );
}

export function FunnelSteps({
  steps
}: {
  steps: Array<{ label: string; value: number; tone?: string }>;
}) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{step.label}</span>
            <span className="font-semibold text-slate-900">{step.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-loop-500 to-loop-700"
              style={{ width: `${Math.max(2, (step.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
