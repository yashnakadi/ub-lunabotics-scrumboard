"use client";

import { Layers } from "lucide-react";

import { TEAM_ICONS } from "@/components/shared/badges";
import { cn } from "@/lib/utils";
import type { Team, TeamId } from "@/types";

export type TeamFilter = TeamId | "all";

interface TeamTabsProps {
  /** Teams the current user is allowed to pick. */
  teams: Team[];
  value: TeamFilter;
  onChange: (value: TeamFilter) => void;
  /** When set, adds a combined option with this label (e.g. "All Teams"). */
  allLabel?: string;
  className?: string;
}

/** Segmented team switcher used on the board and dashboard. */
export function TeamTabs({ teams, value, onChange, allLabel, className }: TeamTabsProps) {
  const options: { id: TeamFilter; label: string; Icon: typeof Layers }[] = [
    ...(allLabel ? [{ id: "all" as const, label: allLabel, Icon: Layers }] : []),
    ...teams.map((team) => ({ id: team.id, label: team.name, Icon: TEAM_ICONS[team.id] })),
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Team"
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-secondary p-0.5",
        className,
      )}
    >
      {options.map(({ id, label, Icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              selected
                ? "bg-white text-foreground shadow-xs ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
