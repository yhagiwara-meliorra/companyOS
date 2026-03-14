import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createClient } from "@/lib/auth/supabase-server";
import { InviteMemberForm } from "./invite-member-form";
import { isAdmin } from "@/lib/auth/roles";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("id, user_id, role, status, profiles(full_name)")
    .eq("workspace_id", ctx.workspace.id);

  const hasAdminAccess = isAdmin(ctx.membership.role);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">設定</h2>
        <p className="mt-1 text-muted-foreground">
          ワークスペースのメンバーと設定を管理します。
        </p>
      </div>

      {/* Members list */}
      <section>
        <h3 className="text-lg font-semibold">メンバー</h3>
        <div className="mt-3 rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">名前</th>
                <th className="px-4 py-2 text-left font-medium">役割</th>
                <th className="px-4 py-2 text-left font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members?.map((m) => {
                const profile = m.profiles as unknown as {
                  full_name: string;
                } | null;
                return (
                  <tr key={m.id}>
                    <td className="px-4 py-2">
                      {profile?.full_name || m.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs ${
                          m.status === "active"
                            ? "text-green-600"
                            : "text-yellow-600"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invite form — only for owner/admin */}
      {hasAdminAccess && (
        <section>
          <h3 className="text-lg font-semibold">メンバーを招待</h3>
          <InviteMemberForm workspaceId={ctx.workspace.id} />
        </section>
      )}
    </div>
  );
}
