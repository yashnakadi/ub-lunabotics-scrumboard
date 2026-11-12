import { CircleAlert, LogOut, RotateCcw } from "lucide-react";
import Link from "next/link";

import { logout } from "@/app/login/actions";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";

interface AccountProblemProps {
  title: string;
  description: string;
  /** Offer a reload link (for transient failures). */
  retry?: boolean;
}

/** Full-page message for signed-in users who can't enter the app. */
export function AccountProblem({ title, description, retry }: AccountProblemProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 text-center shadow-xs sm:p-8">
        <Logo size={64} className="mx-auto" />
        <div className="mt-5 flex items-center justify-center gap-2 text-foreground">
          <CircleAlert className="size-4 text-destructive" aria-hidden />
          <h1 className="text-base font-semibold">{title}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <div className="mt-6 flex flex-col gap-2">
          {retry && (
            <Link href="/board" className={buttonVariants({ size: "lg" })}>
              <RotateCcw aria-hidden />
              Try again
            </Link>
          )}
          <form action={logout}>
            <Button type="submit" variant="outline" size="lg" className="w-full">
              <LogOut aria-hidden />
              Log out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
