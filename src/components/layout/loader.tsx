import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Loader({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex flex-1 items-center justify-center py-16 text-brand-slate", className)}
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function FullScreenLoader() {
  return <Loader className="min-h-dvh" />;
}
