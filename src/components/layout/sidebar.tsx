"use client";

import {
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Package,
  SquareKanban,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";

import { logout } from "@/app/login/actions";
import { Logo } from "@/components/brand/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/providers/auth-provider";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/board", label: "Scrum Board", icon: SquareKanban },
  { href: "/my-tasks", label: "My Tasks", icon: ListChecks },
  { href: "/inventory", label: "Inventory", icon: Package },
];

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useCurrentUser();

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <Logo size={38} decorative />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{APP_NAME}</p>
          <p className="truncate text-[11px] text-white/60">{APP_TAGLINE}</p>
        </div>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
        <ul className="grid gap-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-white/70",
                    active
                      ? "bg-sidebar-accent text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-white" : "text-white/60")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-1 pb-3">
          <UserAvatar user={user} size="md" className="bg-white text-brand-navy" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[11px] text-white/60">{user.email}</p>
          </div>
          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {isAdmin(user) ? "Admin" : "Member"}
          </span>
        </div>
        <Link
          href="/account/password"
          onClick={onNavigate}
          aria-current={pathname === "/account/password" ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-white/70",
            pathname === "/account/password"
              ? "bg-sidebar-accent text-white"
              : "text-white/70 hover:bg-white/5 hover:text-white",
          )}
        >
          <KeyRound className="size-4 text-white/60" aria-hidden />
          Change password
        </Link>
        <form action={logout}>
          <LogoutButton />
        </form>
      </div>
    </div>
  );
}

/** Submits the server-side logout action, which clears the session cookies. */
function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-white/70 disabled:opacity-60"
    >
      <LogOut className="size-4 text-white/60" aria-hidden />
      {pending ? "Logging out…" : "Log out"}
    </button>
  );
}
