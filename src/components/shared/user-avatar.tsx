import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { User } from "@/types";

/** Muted, on-brand tints. Picked per user so people stay recognizable. */
const TINTS = [
  "bg-[#1d334b] text-white",
  "bg-[#74818d] text-white",
  "bg-[#dce3e9] text-[#1d334b]",
  "bg-[#3f5b78] text-white",
  "bg-[#b4bec7] text-[#142536]",
];

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
} as const;

function tintFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

interface UserAvatarProps {
  user: User | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Initials avatar. Renders a dashed placeholder when there is no user. */
export function UserAvatar({ user, size = "sm", className }: UserAvatarProps) {
  if (!user) {
    return (
      <span
        title="Unassigned"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-brand-slate/60 text-brand-slate",
          SIZES[size],
          className,
        )}
      >
        <UserRound className="size-[60%]" aria-hidden />
        <span className="sr-only">Unassigned</span>
      </span>
    );
  }

  return (
    <span
      title={user.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide select-none",
        SIZES[size],
        tintFor(user.id),
        className,
      )}
    >
      <span aria-hidden>{user.initials}</span>
      <span className="sr-only">{user.name}</span>
    </span>
  );
}
