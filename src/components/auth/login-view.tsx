"use client";

import { CircleAlert, Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { login, type LoginState } from "@/app/login/actions";
import { Logo } from "@/components/brand/logo";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

const REASON_MESSAGES: Record<string, string> = {
  session: "Your session has ended. Please log in again.",
  "signed-out": "You have been logged out.",
  "link-invalid": "That link is invalid or has expired. Ask an administrator to send a new one.",
};

export function LoginView() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "";
  const notice = REASON_MESSAGES[searchParams.get("reason") ?? ""];

  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Move focus to the first problem after a failed attempt.
  useEffect(() => {
    if (state.fieldErrors?.email) emailRef.current?.focus();
    else if (state.fieldErrors?.password || state.error) passwordRef.current?.focus();
  }, [state]);

  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={104} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </div>

        <form action={formAction} noValidate className="mt-6 grid gap-4">
          <input type="hidden" name="next" value={next} />

          {state.error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </div>
          ) : (
            notice && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground"
              >
                <Info className="mt-0.5 size-4 shrink-0 text-brand-slate" aria-hidden />
                {notice}
              </div>
            )
          )}

          <Field label="Email address" htmlFor="email" error={emailError}>
            <Input
              ref={emailRef}
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={254}
              defaultValue={state.email ?? ""}
              key={state.email ?? ""}
              aria-invalid={Boolean(emailError) || undefined}
              aria-describedby={emailError ? "email-error" : undefined}
              className="h-9"
              autoFocus
            />
          </Field>

          <Field label="Password" htmlFor="password" error={passwordError}>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                maxLength={256}
                aria-invalid={Boolean(passwordError) || undefined}
                aria-describedby={passwordError ? "password-error" : undefined}
                className="h-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-brand-slate hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>

          <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Accounts are created by a team administrator.
        </p>
      </div>
    </div>
  );
}
