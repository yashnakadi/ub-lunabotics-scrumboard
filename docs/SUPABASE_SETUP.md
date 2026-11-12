# Supabase setup and user administration

How UB Lunabotics runs on Supabase: environment variables, database migrations, Auth settings, and how to create and manage accounts.

People log in with **email and password** (Supabase Auth). The app has no signup page and no admin screens for users; all account administration happens in the Supabase Dashboard.

---

## 1. Environment variables

| Variable | Used by | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server | No. It only grants what row level security allows. |

That's all. **The app does not use a secret (service-role) key.** Every query runs as the signed-in user, so row level security applies everywhere.

If `SUPABASE_SECRET_KEY` is still in your `.env.local` from the earlier username-login version, remove it. Then delete that key under Dashboard → **Project Settings → API Keys**. An unused credential that can't leak is the safest kind. Never add a secret key to your hosting environment for this app.

---

## 2. Database migrations

Apply these in order. All are safe to re-run and none deletes data.

| File | What it does |
| --- | --- |
| `supabase/migrations/20261112000000_initial_schema.sql` | Creates the tables, row level security policies, triggers, helper functions and column privileges. Seeds only the three teams. |
| `supabase/migrations/20261113000000_email_login.sql` | Switches to email login: removes the username lookup function and the username rules, and stops showing usernames (the column itself is kept). Fixes server-side (`service_role`) writes. Removes direct access to the task-number counter. Limits the size of task tags. |
| `supabase/migrations/20261114000000_configure_user_v2.sql` | Replaces `private.configure_user()` with the safer version described in section 4. It only replaces the function; no accounts or data change. |

**How to apply:** Dashboard → **SQL Editor → New query**, paste the file, click **Run**. Or with the CLI: `npx supabase link --project-ref <ref>` and then `npx supabase db push`.

**What migration 2 changes, row by row:**
- Profiles with an empty `full_name` get their old username as their display name, so nobody shows up nameless.
- Nothing else changes. Auth accounts, passwords, roles, team memberships, tasks and inventory are untouched.

**Optional cleanup:** the `profiles.username` column is now unused. To delete it permanently, run this yourself:
```sql
alter table public.profiles drop column username;
```
It is destructive: the stored usernames are lost. Nothing in the app or database depends on them.

### Verify

Two test scripts are included. Run them in the SQL Editor after the migrations. Each uses temporary users and always ends with an error, which rolls back everything it created. Real accounts are never touched.

| Script | Checks | Pass message |
| --- | --- | --- |
| `supabase/tests/rls_verification.sql` | 44 permission rules for every role | `ERROR: RLS verification PASSED: 44 checks. …` |
| `supabase/tests/configure_user_verification.sql` | 25 checks of `configure_user` (needs migration 3) | `ERROR: configure_user verification PASSED: 25 checks. …` |

A failure reads `ERROR: FAIL: <what broke>`.

---

## 3. Auth settings (Dashboard → Authentication)

| Setting | Where | Recommended |
| --- | --- | --- |
| **Allow new users to sign up** | Sign In / Providers → User Signups | **Off** (verified off on this project) |
| Email provider | Sign In / Providers → Email | Enabled |
| Minimum password length | Sign In / Providers → Email → Password | **10 or more.** The app's change-password form requires 10. |
| **Secure password change** | Sign In / Providers → Email | **On.** Changing a password then requires a recent login, so a stolen session can't silently take over the account. |
| Leaked password protection | Sign In / Providers → Email → Password (Pro plan) | On, if available |
| Site URL | URL Configuration | Your production URL, e.g. `https://lunabotics.example.edu` |
| Redirect URLs | URL Configuration | Add `http://localhost:3000/**` for development |
| Sign-in rate limit | Rate Limits | See below |
| Session timeouts | Sessions (Pro plan) | Consider an inactivity timeout, e.g. 7 days |

**Rate limits.** Logins go through the Next.js server, so Supabase sees them coming from the server's IP and applies its per-IP sign-in limit to everyone together. If many people log in within a few minutes, raise **Rate limit for sign ups and sign ins**.

The app also limits failed attempts itself, per 15 minutes: 5 per email from one IP, 15 per email overall, and 25 per IP. These counters live in memory on each server instance; see `src/lib/auth/rate-limit.ts`.

### Email templates (invitations and password resets)

Links in Auth emails must point at the app's `/auth/confirm` route. It verifies the one-time token on the server and sends the user to **Change password**.

Dashboard → **Authentication → Email Templates**:

**Invite user:**
```html
<h2>You're invited to UB Lunabotics</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Accept the invitation and set your password</a></p>
```

**Reset password:**
```html
<h2>Reset your UB Lunabotics password</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a></p>
```

**Change email address** (only if you let people change their email):
```html
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Confirm your new email</a></p>
```

Supabase's built-in email sender is limited to a few messages per hour. For real use, set up custom SMTP under **Authentication → Emails → SMTP Settings**.

---

## 4. Create accounts

### Step 1: Create the Auth user

Dashboard → **Authentication → Users → Add user**, then choose one:

- **Create new user.** Enter the email and a temporary password, and tick **Auto Confirm User**. Send the password to the person privately. They can change it under **Change password** in the sidebar.
- **Send invitation.** The person gets the invite email (set up the template first, above) and chooses their own password.

A database trigger creates their profile immediately, with:
- `role = 'member'` (always; roles are never taken from account metadata),
- `full_name` = the part of the email before `@`,
- no teams.

### Step 2: Set name, role, and teams

In the **SQL Editor**:

```sql
select * from private.configure_user(
  'student@buffalo.edu',            -- email of an EXISTING Auth user (any capitalization)
  'Student Name',                   -- display name
  'member',                         -- 'member' or 'admin'
  array['software', 'electrical']   -- any of: software, electrical, mechanical
);
```

It returns the saved result (`user_id, email, full_name, role, team_ids`) so you can see what changed.

**The Auth account must exist first** (step 1). The function looks the user up in Supabase Authentication by email. If there's no match, it stops with "No Supabase Auth user has the email …". It never creates accounts and never touches passwords, emails or sign-in settings.

How each argument behaves:

| Argument | Rules | Pass `NULL` to… |
| --- | --- | --- |
| Email | Required. Matched case-insensitively. | n/a |
| Full name | 1–120 characters; blank is rejected | keep the current name |
| Role | `admin` or `member` (any capitalization); anything else is rejected | keep the current role |
| Teams | **Replaces** all memberships. Names are case-insensitive and duplicates are ignored. An unknown name stops the whole call and is reported by name. `array[]::text[]` means no teams. | keep the current teams |

- All four arguments are required, so you can't accidentally demote someone by leaving the role off.
- Each call is all-or-nothing: if anything is invalid, nothing changes.
- Running the same call again changes nothing.

Only the SQL Editor (the database owner) can run `private.configure_user`. It isn't available through the Data API, and no app user (signed in or not) can execute it.

### Examples

```sql
-- New member on one team (after creating their Auth account)
select * from private.configure_user('jdoe@buffalo.edu', 'Jane Doe', 'member', array['software']);

-- Assign several teams
select * from private.configure_user('jdoe@buffalo.edu', 'Jane Doe', 'member',
                                     array['software', 'electrical', 'mechanical']);

-- Promote to admin (name and teams unchanged)
select * from private.configure_user('jdoe@buffalo.edu', null, 'admin', null);

-- Demote back to member
select * from private.configure_user('jdoe@buffalo.edu', null, 'member', null);

-- Change teams: she ends up on Mechanical only
select * from private.configure_user('jdoe@buffalo.edu', null, null, array['mechanical']);

-- Remove all team assignments
select * from private.configure_user('jdoe@buffalo.edu', null, null, array[]::text[]);

-- Change only the display name
select * from private.configure_user('jdoe@buffalo.edu', 'Jane Q. Doe', null, null);
```

### The first administrator

Your admin account already exists. To add another admin later, create their Auth user, then run `configure_user` with `'admin'`.

Roles can only be changed from the SQL Editor or Table Editor. The database rejects role changes made through the API, even by admins.

---

## 5. Day-to-day administration

```sql
-- Everyone, with teams
select p.full_name, p.email, p.role,
       coalesce(string_agg(tm.team_id, ', ' order by tm.team_id), '') as teams
from public.profiles p
left join public.team_members tm on tm.user_id = p.id
group by p.id
order by p.full_name;
```

Use `private.configure_user` (above) for names, roles and teams.

- **Reset a password:** Authentication → Users → the user → **Send password recovery**. This needs the Reset password template from section 3.
- **Remove someone:** Authentication → Users → **Delete user**. Their profile and team memberships go with them. Their tasks become unassigned, and their comments and history remain, labeled "former member".
- **When changes apply:** the database enforces role and team changes immediately. The app's menus update the next time the person reloads the page.

---

## 6. How security is enforced

**Database** (the actual security boundary):
- **Row level security** is on for every table. Anonymous requests can't read anything.
- **Column privileges** stop the API from writing fields like `task_number`, `created_by` or `role`. Nobody can read another person's `email` through the API.
- **Triggers** enforce the rules RLS can't express:
  - Members may only change the status and position of tasks assigned to them.
  - Members may tick checklist items, but not reword or delete them.
  - Comment authors and task creators are always the signed-in user.
  - Task history is written only by the database.
  - Task numbers come from a per-team counter, taken under a row lock, with a unique constraint as a backstop.
- **Helper functions** live in a `private` schema that isn't exposed through the API. The `SECURITY DEFINER` ones use an empty `search_path` and only answer questions about the calling user.

**Next.js:**
- Signed-in pages read the session per request (`await connection()` and then `supabase.auth.getUser()`), so personal data is never prerendered or shared between users. Their responses are sent `Cache-Control: private, no-store`.
- The proxy refreshes sessions and redirects signed-out visitors. When it rewrites cookies, it also marks the response uncacheable.
- Session cookies are `Secure` in production and `SameSite=Lax`. They are readable by JavaScript because the Supabase browser client needs them. A Content-Security-Policy limits where scripts can load from and where the page can send data.
- Server Actions (login, logout, password change) are protected against cross-site submission by Next.js's Origin check.

**Cross-team assignment:** a member assigned a task on another team sees that task under **My Tasks**. They don't get access to that team's board or its other tasks.

---

## 7. Optional: inventory photos

Inventory items take an image **URL** (`https://` only, enforced by the database). Supabase Storage uploads aren't wired up. To add them later:
1. Create a bucket.
2. Add storage policies: `select` for `authenticated`, and writes only when `private.is_admin()` is true.
3. Restrict file types and sizes on the bucket.
