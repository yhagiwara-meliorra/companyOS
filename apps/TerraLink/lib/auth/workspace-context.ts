/**
 * Server-side workspace context helpers.
 * Resolves the current workspace from the URL slug and verifies membership.
 */
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan_code: string;
  primary_buyer_org_id: string | null;
  settings: Record<string, unknown>;
};

export type WorkspaceContext = {
  workspace: Workspace;
  membership: WorkspaceMember;
  userId: string;
};

/**
 * Resolve workspace by slug and verify current user is an active member.
 * Returns null if workspace not found or user is not a member.
 */
export async function getWorkspaceContext(
  slug: string
): Promise<WorkspaceContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Use admin client to fetch workspace (RLS on workspaces requires membership,
  // but we need to look up by slug first to get the workspace_id).
  const admin = createAdminClient();

  const { data: workspace } = await admin
    .from("workspaces")
    .select("id, name, slug, plan_code, primary_buyer_org_id, settings")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();

  if (!workspace) return null;

  // Check membership with the user's own credentials (RLS-safe)
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id, workspace_id, user_id, role, status")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return null;

  return {
    workspace: workspace as Workspace,
    membership: membership as WorkspaceMember,
    userId: user.id,
  };
}

/**
 * Get all workspaces the current user belongs to.
 */
export async function getUserWorkspaces(): Promise<
  (Workspace & { role: string })[]
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("workspace_members")
    .select(
      `
      role,
      workspace:workspaces (
        id, name, slug, plan_code, primary_buyer_org_id, settings
      )
    `
    )
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!data) return [];

  return data
    .filter((row) => row.workspace !== null)
    .map((row) => {
      const ws = row.workspace as unknown as Workspace;
      return { ...ws, role: row.role };
    });
}
