import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { AcceptButton } from "./accept-button";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const db = createAdminClient();

  // Look up invitation (table not yet in generated types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invitation } = (await (db as any)
    .from("invitations")
    .select("id, org_id, token, role, expires_at, max_uses, use_count, organizations(name)")
    .eq("token", token)
    .single()) as {
    data: {
      id: string;
      org_id: string;
      token: string;
      role: string;
      expires_at: string;
      max_uses: number;
      use_count: number;
      organizations: { name: string } | null;
    } | null;
  };

  // Invalid or expired invitation
  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-xl border border-border-light bg-surface-raised p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">招待リンクが無効です</h1>
          <p className="mt-2 text-sm text-slate-500">
            このリンクは無効または期限切れです。管理者に新しいリンクを依頼してください。
          </p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invitation.expires_at) < new Date();
  const isUsed = invitation.max_uses !== null && invitation.use_count >= invitation.max_uses;

  if (isExpired || isUsed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md rounded-xl border border-border-light bg-surface-raised p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            {isExpired ? "招待リンクの期限切れ" : "招待リンクは使用済み"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            管理者に新しい招待リンクを依頼してください。
          </p>
        </div>
      </div>
    );
  }

  // Check if user is already logged in
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If logged in, check if already a member
  if (user) {
    const { data: existingMembership } = await db
      .from("memberships")
      .select("id")
      .eq("org_id", invitation.org_id)
      .eq("profile_id", user.id)
      .single();

    if (existingMembership) {
      // Already a member, redirect to dashboard
      redirect("/dashboard");
    }
  }

  const orgName = invitation.organizations?.name ?? "組織";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-xl border border-border-light bg-surface-raised p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">
            {orgName}への招待
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {orgName}のCocologチームに招待されています。
          </p>
        </div>

        <div className="mt-6">
          <AcceptButton
            token={token}
            orgName={orgName}
            isLoggedIn={!!user}
          />
        </div>
      </div>
    </div>
  );
}
