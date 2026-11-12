"use client";

import { CloudOff, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadErrorProps {
  message: string;
  onRetry: () => Promise<unknown> | void;
  className?: string;
}

/** Shown when records could not be loaded. Never falls back to placeholder data. */
export function LoadError({ message, onRetry, className }: LoadErrorProps) {
  const [retrying, setRetrying] = useState(false);
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700">
        <CloudOff className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium text-foreground">Couldn&apos;t load data</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        className="mt-2"
        disabled={retrying}
        onClick={async () => {
          setRetrying(true);
          try {
            await onRetry();
          } finally {
            setRetrying(false);
          }
        }}
      >
        <RotateCcw aria-hidden />
        {retrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}
