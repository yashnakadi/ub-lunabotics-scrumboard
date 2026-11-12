"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";

import { useShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  /** Secondary context shown next to the title, e.g. the selected team. */
  context?: string;
  actions?: ReactNode;
}

/** Compact top bar for a page. Includes the menu button on small screens. */
export function PageHeader({ title, context, actions }: PageHeaderProps) {
  const { openNavigation } = useShell();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-white px-3 sm:px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={openNavigation}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="shrink-0 text-[15px] font-semibold text-foreground">{title}</h1>
        {context && (
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            <span aria-hidden className="mr-2 text-border">
              /
            </span>
            {context}
          </p>
        )}
      </div>
      {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Scrollable content area below the header. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl space-y-4 p-3 sm:p-4 lg:p-6">{children}</div>
    </div>
  );
}
