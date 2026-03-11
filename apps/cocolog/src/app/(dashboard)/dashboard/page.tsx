import { createServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { WeeklyTrendChart, SIGNAL_COLORS } from "@/components/charts/weekly-trend-chart";
import { SignalBar } from "@/components/charts/signal-bar";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name)")
    .eq("profile_id", user!.id) as {
    data: {
      org_id: string;
      role: string;
      organizations: { name: string } | null;
    }[] | null;
  };

  const orgId = memberships?.[0]?.org_id;
  const orgName = memberships?.[0]?.organizations?.name ?? "";

  if (!orgId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
        <Card>
          <div className="py-8 text-center">
            <p className="text-slate-600">まだ組織に所属していません。</p>
            <p className="mt-2 text-sm text-slate-400">
              管理者に招待を依頼するか、設定から新しい組織を作成してください。
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Fetch summary stats + weekly org metrics in parallel
  const [people, digests, orgMetrics] = await Promise.all([
    supabase
      .from("people")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("weekly_digests")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("v_org_weekly_metrics")
      .select("week_start, metrics, active_people_count, total_message_count")
      .eq("org_id", orgId)
      .order("week_start", { ascending: true })
      .limit(12),
  ]);

  const peopleCount = people.count ?? 0;
  const digestCount = digests.count ?? 0;
  const weeklyData = (orgMetrics.data ?? []) as {
    week_start: string;
    metrics: Record<string, { avg: number; count: number }>;
    active_people_count: number;
    total_message_count: number;
  }[];

  // Build chart data
  const chartData = weeklyData.map((row) => {
    const point: { week: string; [key: string]: string | number } = {
      week: new Date(row.week_start).toLocaleDateString("ja-JP", {
        month: "short",
        day: "numeric",
      }),
    };
    for (const [key, val] of Object.entries(row.metrics)) {
      point[key] = Math.round(val.avg * 100) / 100;
    }
    return point;
  });

  // Get latest week's signal values for the bar chart
  const latestWeek = weeklyData[weeklyData.length - 1];
  const prevWeek = weeklyData.length >= 2 ? weeklyData[weeklyData.length - 2] : null;

  const signalList = [
    { key: "clarity", label: "明瞭さ" },
    { key: "empathy", label: "共感力" },
    { key: "constructiveness", label: "建設性" },
    { key: "responsiveness", label: "応答性" },
    { key: "professionalism", label: "プロ意識" },
  ];

  const chartSignals = signalList.map((s) => ({
    ...s,
    color: SIGNAL_COLORS[s.key] ?? "#94a3b8",
  }));

  // Latest message stats
  const latestMessages = latestWeek?.total_message_count ?? 0;
  const latestActivePeople = latestWeek?.active_people_count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
        <p className="mt-1 text-sm text-slate-500">
          {orgName}のコミュニケーションコーチングの概要です。
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            メンバー
          </p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{peopleCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            今週のメッセージ
          </p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{latestMessages}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            アクティブ人数
          </p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{latestActivePeople}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            ダイジェスト
          </p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{digestCount}</p>
        </Card>
      </div>

      {/* Weekly trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>週次シグナルトレンド</CardTitle>
        </CardHeader>
        {chartData.length > 0 ? (
          <WeeklyTrendChart data={chartData} signals={chartSignals} />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">
            まだ週次データがありません。Slackメッセージが分析されると表示されます。
          </p>
        )}
      </Card>

      {/* Latest signal breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最新週のシグナルスコア</CardTitle>
          </CardHeader>
          {latestWeek ? (
            <div className="space-y-4">
              {signalList.map((signal) => {
                const val = latestWeek.metrics[signal.key]?.avg ?? 0;
                const prev = prevWeek?.metrics[signal.key]?.avg;
                return (
                  <SignalBar
                    key={signal.key}
                    label={signal.label}
                    value={val}
                    prevValue={prev}
                    color={SIGNAL_COLORS[signal.key] ?? "#94a3b8"}
                  />
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">
              データがありません
            </p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>クイックリンク</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <Link
              href="/dashboard/people"
              className="block rounded-lg border border-border-light px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              メンバー一覧 &rarr;
            </Link>
            <Link
              href="/dashboard/digests"
              className="block rounded-lg border border-border-light px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              コーチングダイジェスト &rarr;
            </Link>
            <Link
              href="/dashboard/analytics"
              className="block rounded-lg border border-border-light px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              組織分析 &rarr;
            </Link>
            <Link
              href="/dashboard/settings"
              className="block rounded-lg border border-border-light px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              設定 &rarr;
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
