"use server";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function generateInviteLink(): Promise<{
  url: string | null;
  error: string | null;
}> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { url: null, error: "認証エラー" };
  }

  // Verify user is owner/admin
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string; role: string } | null };

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { url: null, error: "権限がありません" };
  }

  const db = createAdminClient();

  // Table not yet in generated types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invitation, error: insertErr } = (await (db as any)
    .from("invitations")
    .insert({
      org_id: membership.org_id,
      created_by: user.id,
      role: "member",
      max_uses: 1,
    })
    .select("token")
    .single()) as { data: { token: string } | null; error: Record<string, unknown> | null };

  if (insertErr || !invitation) {
    console.error("Failed to create invitation:", insertErr);
    return { url: null, error: "招待リンクの作成に失敗しました" };
  }

  revalidatePath("/dashboard/members");

  // Build URL using origin detection
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://cocolog.meliorra.co";
  return { url: `${origin}/invite/${invitation.token}`, error: null };
}
