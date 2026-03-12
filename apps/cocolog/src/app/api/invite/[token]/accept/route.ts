import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/invite/[token]/accept
 * Accept an invitation for a logged-in user.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = createAdminClient();

  // Look up invitation (table not yet in generated types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invitation } = (await (db as any)
    .from("invitations")
    .select("id, org_id, role, expires_at, max_uses, use_count")
    .eq("token", token)
    .single()) as {
    data: {
      id: string;
      org_id: string;
      role: string;
      expires_at: string;
      max_uses: number;
      use_count: number;
    } | null;
  };

  if (!invitation) {
    return NextResponse.json({ error: "無効な招待リンクです" }, { status: 404 });
  }

  // Check expiry and usage
  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "招待リンクの期限が切れています" }, { status: 410 });
  }
  if (invitation.max_uses !== null && invitation.use_count >= invitation.max_uses) {
    return NextResponse.json({ error: "招待リンクは使用済みです" }, { status: 410 });
  }

  // Check if already a member
  const { data: existing } = await db
    .from("memberships")
    .select("id")
    .eq("org_id", invitation.org_id)
    .eq("profile_id", user.id)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, message: "既にメンバーです" });
  }

  // Create membership
  const { error: memErr } = await db.from("memberships").insert({
    org_id: invitation.org_id,
    profile_id: user.id,
    role: invitation.role as "owner" | "admin" | "member",
  });

  if (memErr) {
    console.error("Failed to create membership:", memErr);
    return NextResponse.json({ error: "参加に失敗しました" }, { status: 500 });
  }

  // Update invitation usage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("invitations")
    .update({
      use_count: invitation.use_count + 1,
      used_by: user.id,
      used_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  // Audit log (best-effort)
  await db
    .schema("audit")
    .from("event_log")
    .insert({
      org_id: invitation.org_id,
      actor_id: user.id,
      action: "member.joined_via_invite",
      resource_type: "membership",
      metadata: { invitation_id: invitation.id },
    })
    .then(
      () => {},
      (err) => console.error("Audit log failed:", err),
    );

  return NextResponse.json({ ok: true });
}
