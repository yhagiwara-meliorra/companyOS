"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";
import { z } from "zod/v4";
import { ADMIN_ROLES } from "@/lib/auth/roles";

// ── Validation ──────────────────────────────────────────────
const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, "ワークスペース名は2文字以上にしてください").max(100),
});

/**
 * Generate a URL-safe slug from a workspace name.
 * Handles Japanese / multibyte names by falling back to a random ID.
 */
function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    // Replace common fullwidth characters
    .replace(/[\s\u3000]+/g, "-") // spaces / fullwidth space → hyphen
    .replace(/[^\p{L}\p{N}-]/gu, "") // keep letters, digits, hyphens
    // If result contains non-ASCII (e.g. kanji), fall back to random
    .replace(/[^a-z0-9-]/g, "");

  // Clean up hyphens
  const cleaned = slug
    .replace(/-{2,}/g, "-") // collapse consecutive hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens

  // If the slug is too short (e.g. all-Japanese name), generate a random one
  if (cleaned.length < 2) {
    const rand = Math.random().toString(36).slice(2, 10);
    return `ws-${rand}`;
  }

  return cleaned.slice(0, 50);
}

export type CreateWorkspaceState = {
  error?: string;
};

// ── Create workspace ────────────────────────────────────────
export async function createWorkspace(
  _prev: CreateWorkspaceState,
  formData: FormData
): Promise<CreateWorkspaceState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "認証されていません。ログインしてください。" };
  }

  const parsed = CreateWorkspaceSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name } = parsed.data;
  const admin = createAdminClient();

  // Auto-generate slug from name, with collision resolution
  let slug = generateSlug(name);
  const baseSlug = slug;
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: existing } = await admin
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .single();

    if (!existing) break;

    attempt++;
    slug = `${baseSlug}-${attempt}`;

    if (attempt > 20) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      break;
    }
  }

  // Create workspace
  const { data: workspace, error: wsError } = await admin
    .from("workspaces")
    .insert({ name, slug })
    .select("id, slug")
    .single();

  if (wsError || !workspace) {
    return {
      error: "ワークスペースの作成に失敗しました。しばらくしてから再度お試しください。",
    };
  }

  // Add creator as owner
  const { error: memberError } = await admin
    .from("workspace_members")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    });

  if (memberError) {
    return { error: "メンバー登録に失敗しました。管理者にお問い合わせください。" };
  }

  await appendChangeLog(workspace.id, user.id, "workspaces", workspace.id, "insert", null, {
    name, slug: workspace.slug,
  });

  redirect(`/app/${workspace.slug}`);
}

// ── Invite member ───────────────────────────────────────────
const InviteMemberSchema = z.object({
  email: z.email(),
  role: z.enum([
    "admin",
    "analyst",
    "reviewer",
    "supplier_manager",
    "viewer",
  ]),
  workspaceId: z.string().uuid(),
});

export type InviteMemberState = {
  error?: string;
  success?: boolean;
};

export async function inviteWorkspaceMember(
  _prev: InviteMemberState,
  formData: FormData
): Promise<InviteMemberState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "認証されていません。ログインしてください。" };
  }

  const parsed = InviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    workspaceId: formData.get("workspaceId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, role, workspaceId } = parsed.data;

  // Check caller is owner/admin of this workspace (via RLS-safe query)
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (
    !callerMembership ||
    !(ADMIN_ROLES as readonly string[]).includes(callerMembership.role)
  ) {
    return { error: "メンバーを招待する権限がありません" };
  }

  const admin = createAdminClient();

  // Look up invited user by email (or invite via Supabase Auth)
  const { data: invitedUsers } = await admin.auth.admin.listUsers();
  const invitedUser = invitedUsers?.users?.find((u) => u.email === email);

  if (invitedUser) {
    // User exists — check if already a member
    const { data: existingMember } = await admin
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", invitedUser.id)
      .single();

    if (existingMember) {
      return { error: "このユーザーは既にワークスペースのメンバーです" };
    }

    // Add as invited member
    const { error } = await admin.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: invitedUser.id,
      role,
      status: "invited",
    });

    if (error) return { error: error.message };
  } else {
    // User doesn't exist — invite via Supabase Auth
    const { data: newUser, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      });

    if (inviteError || !newUser?.user) {
      return { error: "招待メールの送信に失敗しました" };
    }

    // Add as invited member
    const { error } = await admin.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: newUser.user.id,
      role,
      status: "invited",
    });

    if (error) return { error: error.message };
  }

  await appendChangeLog(workspaceId, user.id, "workspace_members", workspaceId, "insert", null, {
    email, role,
  });

  // Revalidate settings page so the member list reflects the new invite
  const { data: ws } = await admin
    .from("workspaces")
    .select("slug")
    .eq("id", workspaceId)
    .single();
  if (ws) {
    revalidatePath(`/app/${ws.slug}/settings`);
  }

  return { success: true };
}
