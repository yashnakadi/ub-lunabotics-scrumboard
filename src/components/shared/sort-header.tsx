"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/** Clicking the active column flips direction; a new column starts ascending. */
export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

interface SortHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right";
  className?: string;
}

/** Table header cell with a keyboard-accessible sort button. */
export function SortHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className,
}: SortHeaderProps<K>) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium tracking-wide uppercase transition-colors hover:bg-secondary hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden />
      </button>
    </TableHead>
  );
}

/** Plain (non-sortable) header cell styled to match SortHeader. */
export function PlainHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableHead
      className={cn("text-xs font-medium tracking-wide text-muted-foreground uppercase", className)}
    >
      {children}
    </TableHead>
  );
}
