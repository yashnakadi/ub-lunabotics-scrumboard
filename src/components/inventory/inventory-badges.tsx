import { Box, Cog, Cpu, Radar, TriangleAlert, Wrench, Zap, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { InventoryCategory, InventoryCondition } from "@/types";

export const CATEGORY_ICONS: Record<InventoryCategory, LucideIcon> = {
  Computing: Cpu,
  Electrical: Zap,
  Mechanical: Cog,
  Sensors: Radar,
  Tools: Wrench,
  Miscellaneous: Box,
};

const CONDITION_DOT: Record<InventoryCondition, string> = {
  New: "bg-emerald-600",
  Good: "bg-emerald-600",
  Fair: "bg-amber-500",
  "Needs Repair": "bg-red-500",
  "Out of Service": "bg-slate-400",
};

export function ConditionBadge({ condition }: { condition: InventoryCondition }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-foreground">
      <span className={cn("size-1.5 rounded-full", CONDITION_DOT[condition])} aria-hidden />
      {condition}
    </span>
  );
}

export function LowStockBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md bg-amber-50 px-1.5 text-[11px] font-medium whitespace-nowrap text-amber-800",
        className,
      )}
    >
      <TriangleAlert className="size-3" aria-hidden />
      Low stock
    </span>
  );
}

export function CategoryLabel({ category }: { category: InventoryCategory }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-foreground">
      <Icon className="size-3.5 text-brand-slate" aria-hidden />
      {category}
    </span>
  );
}
