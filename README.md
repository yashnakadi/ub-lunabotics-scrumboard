# UB Lunabotics · Team Project Management

Internal project management for the University at Buffalo NASA Lunabotics team: Scrum boards for the Software, Electrical, and Mechanical teams, a personal task list, an equipment inventory, and a progress dashboard.

Data and accounts live in **Supabase**: PostgreSQL with row level security, plus Supabase Auth. People log in with their **email and password**. There is no public signup; administrators create accounts in the Supabase Dashboard.

## Quick start

1. **Environment.** Copy `.env.example` to `.env.local` and fill in both values. No secret key is needed:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
2. **Database.** Run both files in `supabase/migrations/`, in order, in the Supabase SQL Editor. Then run `supabase/tests/rls_verification.sql` to check the permissions.
3. **Auth settings.** Turn off public signups, set the Site URL, and turn on Secure password change.
4. **First admin.** Create your Auth user, then run `private.configure_user(...)` with role `'admin'`.
5. **Run it:**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000 and log in with your email.

[`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) has step-by-step instructions for each of these, plus how to add members, assign teams, change roles, and reset passwords.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Lucide · dnd-kit · Supabase (`@supabase/ssr`, `@supabase/supabase-js`)

## Roles

| | Admin | Member |
| --- | --- | --- |
| Boards | All teams + "All Teams" | Only their teams |
| Tasks assigned to them on other teams | n/a | Visible in My Tasks (not the whole board) |
| Create, edit, assign, delete tasks | Yes | No |
| Change status / drag cards | Any task | Tasks assigned to them |
| Checklist | Add, tick, remove | Add and tick on their own tasks |
| Comments | Yes | On tasks they can see |
| Inventory | Add, edit, delete | Read and search |
| Roles and team membership | Supabase Dashboard only | No |

The **database** enforces these rules (RLS policies, column privileges, and triggers), not the UI. See section 6 of the setup guide.

## Project layout

```
supabase/
  migrations/             Schema, RLS, triggers, functions (version-controlled)
  tests/                  rls_verification.sql — 44 self-rolling-back permission checks
docs/SUPABASE_SETUP.md    Setup and user administration
src/
  proxy.ts                Refreshes the Supabase session; redirects signed-out visitors
  app/
    login/                Email login page + server actions (login, logout)
    auth/confirm/         Handles invite and password-recovery email links
    (app)/                Signed-in pages; layout verifies the session on the server
  lib/
    supabase/             Browser, server, and proxy clients (publishable key only)
    auth/                 Current-user loader, login rate limiter, password policy
    services/             Data-access interfaces + Supabase implementations
    permissions.ts        UI-side mirror of the access rules
  providers/              AuthProvider (verified user), DataProvider (records + actions)
  components/             UI (board, tasks, inventory, dashboard, layout, shared, ui)
public/logo.svg           Official UB Lunabotics badge
```

## How login works

1. The person enters their email and password. The form posts to a server action.
2. The server validates the input, applies rate limits, and calls `supabase.auth.signInWithPassword`. Supabase verifies the password; the app never stores, hashes or logs passwords.
3. `@supabase/ssr` stores the session in cookies (`Secure` in production, `SameSite=Lax`). The proxy refreshes the session on each request, and the `(app)` layout confirms it with Supabase Auth before rendering. That check runs per request, so personal data is never prerendered or cached for anyone else.

Every login failure shows the same "Incorrect email or password." message, and failed attempts take a minimum amount of time. Neither the error text nor the response time reveals whether an account exists.
