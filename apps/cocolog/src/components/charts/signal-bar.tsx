"use client";

interface SignalBarProps {
  label: string;
  value: number;
  prevValue?: number;
  color: string;
}

export function SignalBar({ label, value, prevValue, color }: SignalBarProps) {
  const pct = Math.round(value * 100);
  const delta = prevValue != null ? value - prevValue : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{pct}%</span>
          {delta != null && delta !== 0 && (
            <span
              className={`text-xs font-medium ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}
            >
              {delta > 0 ? "+" : ""}
              {Math.round(delta * 100)}
            </span>
          )}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
