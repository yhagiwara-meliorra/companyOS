import { createServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { WeeklyTrendChart, SIGNAL_COLORS } from "@/components/charts/weekly-trend-chart";
import { SignalBar } from "@/components/charts/signal-bar";
import { MemberAnalytics } from "./member-analytics";

export default async function AnalyticsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, organizations(name)")
    .eq("profile_id", user!.id) as {
    data: { org_id: string; organizations: { name: string } | null }[] | null;
  };

  const orgId = memberships?.[0]?.org_id;
  const orgName = memberships?.[0]?.organizations?.name ?? "";

  if (!orgId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">組織分析</h1>
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">
            組織に所属していません。
          </p>
        </Card>
      </div>
    );
  }

  // Fetch org-level + person-level weekly metrics in parallel
  const [orgMetrics, personMetrics] = await Promise.all([
    supabase
      .from("v_org_weekly_metrics")
      .select("week_start, metrics, active_people_count, total_message_count")
      .eq("org_id", orgId)
      .order("week_start", { ascending: true })
      .limit(12),
    supabase
      .from("v_person_weekly_metrics")
      .select("week_start, person_id, metrics, message_count, people(display_name)")
      .eq("org_id", orgId)
      .order("week_start", { ascending: false })
      .limit(100),
  ]);

  type OrgWeekRow = {
    week_start: string;
    metrics: Record<string, { avg: number; count: number }>;
    active_people_count: number;
    total_message_count: number;
  };

  type PersonWeekRow = {
    week_start: string;
    person_id: string;
    metrics: Record<string, { avg: number; count: number }>;
    message_count: number;
    people: { display_name: string } | null;
  };

  const weeklyData = (orgMetrics.data ?? []) as OrgWeekRow[];
  const personData = (personMetrics.data ?? []) as PersonWeekRow[];

  // Build org chart data
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

  // Activity trend data (messages & active people over time)
  const activityData = weeklyData.map((row) => ({
    week: new Date(row.week_start).toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
    }),
    messages: row.total_message_count,
    activePeople: row.active_people_count,
  }));

  // Person ranking for latest week
  const latestWeekStart = weeklyData[weeklyData.length - 1]?.week_start;
  const prevWeekStart =
    weeklyData.length >= 2 ? weeklyData[weeklyData.length - 2]?.week_start : null;

  const latestPersonRows = latestWeekStart
    ? personData.filter((r) => r.week_start === latestWeekStart)
    : [];

  const prevPersonMap = new Map<string, PersonWeekRow>();
  if (prevWeekStart) {
    for (const r of personData.filter((r) => r.week_start === prevWeekStart)) {
      prevPersonMap.set(r.person_id, r);
    }
  }

  // Sort by message count descending
  latestPersonRows.sort((a, b) => b.message_count - a.message_count);

  // Overall latest org metrics for signal bar
  const latestOrg = weeklyData[weeklyData.length - 1];
  const prevOrg = weeklyData.length >= 2 ? weeklyData[weeklyData.length - 2] : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">組織分析</h1>
        <p className="mt-1 text-sm text-slate-500">
          {orgName}のコミュニケーションシグナル分析。
        </p>
      </div>

      {/* Org signal trend */}
      <Card>
        <CardHeader>
          <CardTitle>組織シグナルトレンド（最大12週）</CardTitle>
        </CardHeader>
        {chartData.length > 0 ? (
          <WeeklyTrendChart data={chartData} signals={chartSignals} height={350} />
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">
            まだ週次データがありません。
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Latest org signal scores */}
        <Card>
          <CardHeader>
            <CardTitle>最新週の組織スコア</CardTitle>
          </CardHeader>
          {latestOrg ? (
            <div className="space-y-4">
              {signalList.map((signal) => {
                const val = latestOrg.metrics[signal.key]?.avg ?? 0;
                const prev = prevOrg?.metrics[signal.key]?.avg;
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

        {/* Activity summary */}
        <Card>
          <CardHeader>
            <CardTitle>アクティビティサマリー</CardTitle>
          </CardHeader>
          {activityData.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    合計メッセージ
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary-600">
                    {weeklyData.reduce((sum, r) => sum + r.total_message_count, 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    分析週数
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary-600">
                    {weeklyData.length}
                  </p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    <th className="pb-2">週</th>
                    <th className="pb-2 text-right">メッセージ</th>
                    <th className="pb-2 text-right">アクティブ人数</th>
                  </tr>
                </thead>
                <tbody>
                  {activityData
                    .slice()
                    .reverse()
                    .slice(0, 8)
                    .map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 text-slate-700">{row.week}</td>
                        <td className="py-2 text-right font-medium text-slate-900">
                          {row.messages}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {row.activePeople}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">
              データがありません
            </p>
          )}
        </Card>
      </div>

      {/* Per-person breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>メンバー別スコア（最新週）</CardTitle>
        </CardHeader>
        {latestPersonRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-4">メンバー</th>
                  <th className="pb-2 text-right">メッセージ</th>
                  {signalList.map((s) => (
                    <th key={s.key} className="pb-2 text-right">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latestPersonRows.map((row) => {
                  const prev = prevPersonMap.get(row.person_id);
                  return (
                    <tr
                      key={row.person_id}
                      className="border-b border-slate-100"
                    >
                      <td className="py-2 pr-4 font-medium text-slate-900">
                        {row.people?.display_name ?? "不明"}
                      </td>
                      <td className="py-2 text-right text-slate-600">
                        {row.message_count}
                      </td>
                      {signalList.map((s) => {
                        const val = row.metrics[s.key]?.avg;
                        const prevVal = prev?.metrics[s.key]?.avg;
                        const delta =
                          val != null && prevVal != null ? val - prevVal : null;
                        return (
                          <td key={s.key} className="py-2 text-right">
                            <span className="font-medium text-slate-900">
                              {val != null ? Math.round(val * 100) : "—"}
                            </span>
                            {delta != null && delta !== 0 && (
                              <span
                                className={`ml-1 text-xs ${delta > 0 ? "text-emerald-600" : "text-red-500"}`}
                              >
                                {delta > 0 ? "+" : ""}
                                {Math.round(delta * 100)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-slate-400">
            まだメンバー別データがありません。
          </p>
        )}
      </Card>

      {/* Per-member tone/politeness trends + scene distribution */}
      <div>
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          メンバー別 トーン・丁寧さ推移 &amp; コメント分類
        </h2>
        <MemberAnalytics />
      </div>
    </div>
  );
}
