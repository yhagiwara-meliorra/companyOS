import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/supabase-server";
import { getUserWorkspaces } from "@/lib/auth/workspace-context";
import { WorkspaceSelector } from "./workspace-selector";

/**
 * /app — Workspace selector.
 * If the user has exactly one workspace, redirect there directly.
 */
export default async function WorkspaceSelectorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const workspaces = await getUserWorkspaces();

  // Auto-redirect if user belongs to exactly one workspace
  if (workspaces.length === 1) {
    redirect(`/app/${workspaces[0].slug}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <WorkspaceSelector workspaces={workspaces} />
    </main>
  );
}
