import { cn } from "@/lib/utils";

export function TierBadge({
  tier,
  className,
}: {
  tier: number | null | undefined;
  className?: string;
}) {
  if (tier == null) return null;

  const colors: Record<number, string> = {
    0: "bg-slate-100 text-slate-700 border-slate-200",
    1: "bg-violet-50 text-violet-700 border-violet-200",
    2: "bg-indigo-50 text-indigo-700 border-indigo-200",
    3: "bg-sky-50 text-sky-700 border-sky-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        colors[tier] ?? colors[3],
        className
      )}
    >
      T{tier}
    </span>
  );
}
