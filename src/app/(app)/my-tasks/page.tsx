import type { Metadata } from "next";

import { MyTasksView } from "@/components/tasks/my-tasks-view";

export const metadata: Metadata = { title: "My Tasks" };

/**
 * Signed-in pages depend on the session (read per request in the (app) layout),
 * so they cannot be prerendered into a static shell.
 */
export const instant = false;

export default function Page() {
  return <MyTasksView />;
}
