"use client";

import { CircleAlert, Eye, EyeOff, FlaskConical, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { Field } from "@/components/shared/field";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { TEAMS } from "@/lib/data/seed";
// Prototype-only import: lists the fictional demo accounts on the login screen.
// Remove this (and <DemoAccounts />) when real authentication is connected.
import { DEMO_ACCOUNTS, DEMO_PASSWORD, resetDemoData } from "@/lib/services/mock/auth";
import { useAuth } from "@/providers/auth-provider";
import type { User } from "@/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormErrors {
  email?: string;
  password?: string;
  form?: string;
}

export function LoginView() {
  const { status, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/board");
  }, [status, router]);

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (validation.email || validation.password) {
      document.getElementById(validation.email ? "email" : "password")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const user = await signIn(email, password);
      toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
      router.replace("/board");
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "Unable to log in. Please try again.",
      });
      setSubmitting(false);
    }
  }

  function fillDemoAccount(account: User) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setErrors({});
    document.getElementById("login-submit")?.focus();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-muted px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-6 grid gap-4">
          {errors.form && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {errors.form}
            </div>
          )}

          <Field label="Email address" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="you@ublunabotics.test"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email || errors.form) setErrors({ ...errors, email: undefined, form: undefined });
              }}
              aria-invalid={Boolean(errors.email) || undefined}
              aria-describedby={errors.email ? "email-error" : undefined}
              className="h-9"
            />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password}>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password || errors.form)
                    setErrors({ ...errors, password: undefined, form: undefined });
                }}
                aria-invalid={Boolean(errors.password) || undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
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

          <Button id="login-submit" type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
            {submitting && <Loader2 className="animate-spin" aria-hidden />}
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Accounts are created by a team administrator.
        </p>
      </div>

      <DemoAccounts onSelect={fillDemoAccount} />
    </div>
  );
}

/** Prototype helper. Lists the fictional test accounts so reviewers can sign in. */
function DemoAccounts({ onSelect }: { onSelect: (account: User) => void }) {
  return (
    <section
      aria-labelledby="demo-accounts-title"
      className="w-full max-w-sm rounded-xl border border-dashed border-input bg-white/60 p-4"
    >
      <div className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-brand-slate" aria-hidden />
        <div className="min-w-0">
          <h2 id="demo-accounts-title" className="text-sm font-medium text-foreground">
            Prototype test accounts
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fictional accounts with mock data. Select one to fill the form. Shared demo password:{" "}
            <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[11px] text-foreground">
              {DEMO_PASSWORD}
            </code>
          </p>
        </div>
      </div>

      <ul className="mt-3 grid gap-1">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onSelect(account)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary"
            >
              <UserAvatar user={account} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-foreground">
                  {account.name}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {account.teamIds
                    .map((id) => TEAMS.find((team) => team.id === id)?.name)
                    .join(", ")}
                </span>
              </span>
              <span
                className={
                  account.role === "admin"
                    ? "rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground"
                    : "rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
                }
              >
                {account.role === "admin" ? "Admin" : "Member"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-border pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            resetDemoData();
            toast.success("Demo data restored to its original state");
          }}
        >
          <RotateCcw aria-hidden />
          Reset demo data
        </Button>
      </div>
    </section>
  );
}
