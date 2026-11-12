import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  /** Supporting text under the value. */
  hint?: string;
  /** Draws attention when the value signals a problem (e.g. overdue > 0). */
  tone?: "default" | "alert";
  className?: string;
}

/** Single headline number with a label. */
export function StatCard({ label, value, icon: Icon, hint, tone = "default", className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-white p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon
          className={cn("size-4", tone === "alert" ? "text-red-600" : "text-brand-slate")}
          aria-hidden
        />
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          tone === "alert" ? "text-red-700" : "text-foreground",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
