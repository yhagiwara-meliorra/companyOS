import { createServerClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { InviteSection } from "./invite-section";

interface MemberRow {
  profile_id: string;
  role: string;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export default async function MembersPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("profile_id", user!.id) as { data: { org_id: string; role: string }[] | null };

  const membership = memberships?.[0];
  const orgId = membership?.org_id;
  const isOwnerOrAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  let members: MemberRow[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("memberships")
      .select("profile_id, role, created_at, profiles(display_name, avatar_url)")
      .eq("org_id", orgId)
      .order("created_at");
    members = (data ?? []) as unknown as MemberRow[];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">メンバー管理</h1>
        <p className="mt-1 text-sm text-slate-500">
          組織のメンバーと招待の管理。
        </p>
      </div>

      {/* Invite section (owner/admin only) */}
      {isOwnerOrAdmin && <InviteSection />}

      {/* Members list */}
      <div className="rounded-xl border border-border-light bg-surface-raised">
        <div className="border-b border-border-light px-6 py-3">
          <h2 className="text-sm font-semibold text-slate-700">
            メンバー一覧（{members.length}人）
          </h2>
        </div>
        {members.length > 0 ? (
          <ul className="divide-y divide-border-light">
            {members.map((m) => (
              <li
                key={m.profile_id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div className="flex items-center gap-3">
                  {m.profiles?.avatar_url ? (
                    <img
                      src={m.profiles.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                      {(m.profiles?.display_name ?? "?")[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {m.profiles?.display_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500">
                      参加日: {new Date(m.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                </div>
                <Badge variant={m.role === "owner" ? "warning" : "default"}>
                  {m.role}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-4 text-sm text-slate-400">
            メンバーがいません。
          </p>
        )}
      </div>
    </div>
  );
}
