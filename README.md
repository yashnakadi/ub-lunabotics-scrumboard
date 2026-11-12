# UB Lunabotics · Team Project Management

Internal project management app for the University at Buffalo NASA Lunabotics team: Scrum boards for the Software, Electrical, and Mechanical teams, a personal task list, an equipment inventory, and a progress dashboard.

**This is a frontend-only prototype.** There is no backend, database, or real authentication. All data is mock data kept in the browser (localStorage), and the login accepts only the fictional test accounts listed on the login screen.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick a test account on the login screen. Every account uses the demo password `lunabotics-demo`.

| Account | Role | Teams |
| --- | --- | --- |
| Priya Raman | Admin | Software |
| Marcus Bell | Admin | Mechanical |
| Ethan Kowalski | Member | Software |
| Sofia Alvarez | Member | Software, Electrical |
| Jamal Okafor | Member | Electrical |
| Hannah Lindqvist | Member | Mechanical |
| Diego Santos | Member | Mechanical, Electrical |
| Mei Tanaka | Member | Software, Electrical, Mechanical |
| Noah Friedman | Member | Mechanical |

Changes persist in your browser across refreshes. **Reset demo data** on the login screen restores the original tasks and inventory.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS v4 · shadcn/ui (Base UI) · Lucide icons · dnd-kit

## Project layout

```
src/
  app/                    Routes. (app)/ holds the signed-in pages.
  types/                  Domain models: User, Team, Task, TaskComment, TaskChecklistItem, InventoryItem
  lib/
    permissions.ts        Admin/Member access rules (pure functions)
    task-filters.ts       Task filtering, sorting, summaries (pure functions)
    inventory.ts          Low-stock and summary helpers
    format.ts             Date helpers
    data/seed.ts          Mock users, teams, tasks, inventory
    services/
      types.ts            Data-access interfaces (AuthService, TaskService, ...)
      index.ts            The one place that selects the implementations
      mock/               localStorage-backed implementations + mock auth
  providers/              AuthProvider (session), DataProvider (records + actions)
  components/
    ui/                   shadcn/ui primitives
    shared/               Badges, avatars, selects, dialogs, table headers
    layout/               App shell, sidebar, page header
    board/ tasks/ inventory/ dashboard/ auth/
```

## Roles

| | Admin | Member |
| --- | --- | --- |
| Boards | All teams + "All Teams" | Only their teams |
| Create, edit, assign, delete tasks | Yes | No |
| Change status / drag cards | Any task | Tasks assigned to them |
| Checklist | Add, tick, remove | Add and tick on their own tasks |
| Comments | Yes | On tasks they can see |
| Inventory | Full CRUD | Read-only |

Admins can assign a task to anyone, including someone outside the task's team. That person sees it under **My Tasks** but does not get access to the other team's board.

## Connecting a real backend

The UI never touches storage directly. It calls the interfaces in `src/lib/services/types.ts` through `services` from `src/lib/services/index.ts`.

1. Implement `AuthService`, `DirectoryService`, `TaskService`, and `InventoryService` against your API.
2. Swap them in `src/lib/services/index.ts`.
3. Delete `src/lib/services/mock/` and the demo-account panel in `src/components/auth/login-view.tsx`.
4. Replace the client-side redirect in `src/components/layout/app-shell.tsx` with server-side session checks.

**Frontend checks are not security.** The rules in `src/lib/permissions.ts` decide what the UI shows, and the mock services re-check them on every write to mirror what a server must do. A real backend has to enforce the same rules itself on every request.

## Logo

`public/logo.svg` is a placeholder mark. Replace that file with the official UB Lunabotics logo (or add a PNG and update `LOGO_SRC` in `src/components/brand/logo.tsx`). It is used on the login screen, in the sidebar, and as the favicon.
