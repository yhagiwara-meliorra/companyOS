import { createServerClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";

interface PersonRow {
  id: string;
  display_name: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
  identity_links: { provider: string; provider_user_id: string }[];
}

export default async function PeoplePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user!.id) as { data: { org_id: string }[] | null };

  const orgId = memberships?.[0]?.org_id;

  let people: PersonRow[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("people")
      .select("id, display_name, email, is_active, created_at, identity_links(provider, provider_user_id)")
      .eq("org_id", orgId)
      .order("display_name");
    people = (data ?? []) as unknown as PersonRow[];
  }

  const columns = [
    {
      key: "display_name",
      header: "名前",
      render: (row: PersonRow) => (
        <span className="font-medium text-slate-900">{row.display_name}</span>
      ),
    },
    {
      key: "email",
      header: "メール",
      render: (row: PersonRow) => (
        <span className="text-slate-600">{row.email ?? "—"}</span>
      ),
    },
    {
      key: "provider",
      header: "連携済み",
      render: (row: PersonRow) => (
        <div className="flex gap-1">
          {row.identity_links?.map((link, i) => (
            <Badge key={i} variant="primary">
              {link.provider}
            </Badge>
          ))}
          {(!row.identity_links || row.identity_links.length === 0) && (
            <span className="text-slate-400">なし</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "ステータス",
      render: (row: PersonRow) => (
        <Badge variant={row.is_active ? "success" : "default"}>
          {row.is_active ? "アクティブ" : "非アクティブ"}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "追加日",
      render: (row: PersonRow) =>
        new Date(row.created_at).toLocaleDateString("ja-JP"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">メンバー</h1>
          <p className="mt-1 text-sm text-slate-500">
            Slackの会話から追跡された分析対象者。
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={people}
        emptyMessage="まだメンバーがいません。Slackを接続して開始してください。"
      />
    </div>
  );
}
