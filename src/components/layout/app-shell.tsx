"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { FullScreenLoader, Loader } from "@/components/layout/loader";
import { SidebarContent } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/providers/auth-provider";
import { DataProvider, useData } from "@/providers/data-provider";

interface ShellContextValue {
  openNavigation: () => void;
}

const ShellContext = createContext<ShellContextValue>({ openNavigation: () => undefined });

export function useShell(): ShellContextValue {
  return useContext(ShellContext);
}

/** Waits for the initial data load so pages can assume records are present. */
function DataGate({ children }: { children: ReactNode }) {
  const { loading } = useData();
  return loading ? <Loader /> : children;
}

/**
 * Frame for every signed-in page: auth guard, sidebar (drawer on small
 * screens), and the main content column.
 *
 * The redirect below is a UX convenience only. Real protection must come from
 * server-side session checks once a backend exists.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  const shell = useMemo(() => ({ openNavigation: () => setNavOpen(true) }), []);

  if (status !== "authenticated" || !user) return <FullScreenLoader />;

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
