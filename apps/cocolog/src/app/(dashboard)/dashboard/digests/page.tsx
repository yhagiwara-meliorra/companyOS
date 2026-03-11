import { createServerClient } from "@/lib/supabase/server";
import { DataTable } from "@/components/tables/data-table";
import Link from "next/link";

interface DigestRow {
  id: string;
  week_start: string;
  created_at: string;
  person_id: string;
  people: { display_name: string } | null;
}

export default async function DigestsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user!.id) as { data: { org_id: string }[] | null };

  const orgId = memberships?.[0]?.org_id;

  let digests: DigestRow[] = [];
  if (orgId) {
    const { data } = await supabase
      .from("weekly_digests")
      .select("id, week_start, created_at, person_id, people(display_name)")
      .eq("org_id", orgId)
      .order("week_start", { ascending: false })
      .limit(50);
    digests = (data ?? []) as unknown as DigestRow[];
  }

  const columns = [
    {
      key: "week_start",
      header: "週",
      render: (row: DigestRow) => (
        <span className="font-medium text-slate-900">
          {new Date(row.week_start).toLocaleDateString("ja-JP")}
        </span>
      ),
    },
    {
      key: "person",
      header: "メンバー",
      render: (row: DigestRow) => (
        <span className="text-slate-700">
          {row.people?.display_name ?? "不明"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "生成日",
      render: (row: DigestRow) =>
        new Date(row.created_at).toLocaleDateString("ja-JP"),
    },
    {
      key: "actions",
      header: "",
      render: (row: DigestRow) => (
        <Link
          href={`/dashboard/digests/${row.id}`}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          詳細
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">コーチングダイジェスト</h1>
        <p className="mt-1 text-sm text-slate-500">
          各メンバーのAI生成週次コーチングレポート。
        </p>
      </div>

      <DataTable
        columns={columns}
        data={digests}
        emptyMessage="まだダイジェストがありません。分析されたメッセージから毎週作成されます。"
      />
    </div>
  );
}
