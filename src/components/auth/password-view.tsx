"use client";

import { CircleAlert, CircleCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { updatePassword, type PasswordState } from "@/app/(app)/account/password/actions";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Field } from "@/components/shared/field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { useCurrentUser } from "@/providers/auth-provider";

export function PasswordView() {
  const user = useCurrentUser();
  const welcome = useSearchParams().get("welcome") === "1";
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(updatePassword, {});
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Password updated");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <>
      <PageHeader title="Change password" context={user.email} />
      <PageBody>
        <div className="max-w-md rounded-xl border border-border bg-white p-5 sm:p-6">
          {welcome && (
            <div className="mb-4 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              Welcome, {user.name.split(" ")[0]}! Set a password to finish setting up your account.
              You&apos;ll log in with <strong>{user.email}</strong>.
            </div>
          )}

          {state.ok ? (
            <div className="grid gap-4">
              <p role="status" className="flex items-center gap-2 text-sm text-foreground">
                <CircleCheck className="size-4 text-emerald-600" aria-hidden />
                Your password has been updated.
              </p>
              <Link href="/board" className={buttonVariants({ className: "w-fit" })}>
                Go to the Scrum Board
              </Link>
            </div>
          ) : (
            <form ref={formRef} action={formAction} noValidate className="grid gap-4">
              {state.error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {state.error}
                </div>
              )}

              {/* Helps password managers associate the new password with the account. */}
              <input type="email" name="email" autoComplete="username" value={user.email} readOnly hidden />

              <Field
                label="New password"
                htmlFor="password"
                error={state.fieldErrors?.password}
                hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
              >
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={MAX_PASSWORD_LENGTH}
                    aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
                    aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
                    className="h-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide passwords" : "Show passwords"}
                    aria-pressed={show}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-brand-slate hover:text-foreground"
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>

              <Field label="Confirm new password" htmlFor="confirm" error={state.fieldErrors?.confirm}>
                <Input
                  id="confirm"
                  name="confirm"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  maxLength={MAX_PASSWORD_LENGTH}
                  aria-invalid={Boolean(state.fieldErrors?.confirm) || undefined}
                  aria-describedby={state.fieldErrors?.confirm ? "confirm-error" : undefined}
                  className="h-9"
                />
              </Field>

              <Button type="submit" disabled={pending} className="w-fit">
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {pending ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </PageBody>
    </>
  );
}
