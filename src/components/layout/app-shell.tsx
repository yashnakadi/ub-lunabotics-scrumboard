"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { Loader } from "@/components/layout/loader";
import { SidebarContent } from "@/components/layout/sidebar";
import { LoadError } from "@/components/shared/load-error";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCurrentUser } from "@/providers/auth-provider";
import { DataProvider, useData } from "@/providers/data-provider";

interface ShellContextValue {
  openNavigation: () => void;
}

const ShellContext = createContext<ShellContextValue>({ openNavigation: () => undefined });

export function useShell(): ShellContextValue {
  return useContext(ShellContext);
}

/** Holds pages back until the first load succeeds, so they can assume data is present. */
function DataGate({ children }: { children: ReactNode }) {
  const { loading, loadError, reload } = useData();
  if (loading) return <Loader />;
  if (loadError) return <LoadError message={loadError} onRetry={reload} className="flex-1" />;
  return children;
}

/**
 * Frame for every signed-in page: sidebar (drawer on small screens) and the
 * main content column. The session has already been verified on the server
 * by the (app) layout before this renders.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);
  const shell = useMemo(() => ({ openNavigation: () => setNavOpen(true) }), []);

  return (
    <ShellContext.Provider value={shell}>
      {/* Keyed by user so one account's data never lingers for the next. */}
      <DataProvider key={user.id}>
        <div className="flex h-dvh overflow-hidden bg-muted">
          <aside className="hidden w-60 shrink-0 lg:flex">
            <SidebarContent />
          </aside>

          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetContent
              side="left"
              showCloseButton={false}
              className="gap-0 border-0 bg-sidebar p-0 data-[side=left]:w-64"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Main navigation and account actions
              </SheetDescription>
              <SidebarContent onNavigate={() => setNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <main className="flex min-w-0 flex-1 flex-col">
            <DataGate>{children}</DataGate>
          </main>
        </div>
      </DataProvider>
    </ShellContext.Provider>
  );
}
