"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";

interface ScorePoint {
  period: string;
  tone: number;
  politeness: number;
  count: number;
}

interface SceneItem {
  label: string;
  count: number;
}

interface PersonOption {
  personId: string;
  displayName: string;
}

interface ToneData {
  people: PersonOption[];
  scores: ScorePoint[];
  sceneDistribution: SceneItem[];
}

const SCENE_LABELS: Record<string, string> = {
  question: "質問",
  answer: "回答",
  feedback: "フィードバック",
  request: "依頼",
  report: "報告",
  greeting: "挨拶",
  discussion: "議論",
  announcement: "アナウンス",
  gratitude: "感謝",
  apology: "謝罪",
  casual: "雑談",
  status_update: "状況報告",
  decision: "意思決定",
  other: "その他",
};

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#64748b",
];

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITY_OPTIONS: { value: Granularity; label: string; days: number }[] = [
  { value: "daily", label: "デイリー", days: 30 },
  { value: "weekly", label: "ウィークリー", days: 90 },
  { value: "monthly", label: "マンスリー", days: 365 },
];

function formatPeriod(period: string, granularity: Granularity) {
  if (granularity === "monthly") {
    // YYYY-MM → M月
    const [_y, m] = period.split("-");
    return `${parseInt(m)}月`;
  }
  if (granularity === "weekly") {
    const d = new Date(period + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) + "週";
  }
  // daily: YYYY-MM-DD
  const d = new Date(period + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

export function ToneAnalytics() {
  const [data, setData] = useState<ToneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [personId, setPersonId] = useState("all");
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const days = GRANULARITY_OPTIONS.find((g) => g.value === granularity)?.days ?? 30;
      const params = new URLSearchParams({
        personId,
        granularity,
        days: String(days),
      });
      const res = await fetch(`/api/analytics/members?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [personId, granularity]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const selectedName =
    personId === "all"
      ? "全体"
      : data?.people.find((p) => p.personId === personId)?.displayName ?? "—";

  // Compute averages
  const totalCount = data?.scores.reduce((s, d) => s + d.count, 0) ?? 0;
  const avgTone = totalCount > 0
    ? (data?.scores.reduce((s, d) => s + d.tone * d.count, 0) ?? 0) / totalCount
    : 0;
  const avgPoliteness = totalCount > 0
    ? (data?.scores.reduce((s, d) => s + d.politeness * d.count, 0) ?? 0) / totalCount
    : 0;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Person filter */}
        <div>
          <label htmlFor="person-filter" className="mr-2 text-xs font-medium text-slate-500">
            対象
          </label>
          <select
            id="person-filter"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="rounded-md border border-border-light bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">全体</option>
            {data?.people.map((p) => (
              <option key={p.personId} value={p.personId}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Granularity tabs */}
        <div className="flex rounded-md border border-border-light">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGranularity(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                granularity === opt.value
                  ? "bg-primary-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              } ${opt.value === "daily" ? "rounded-l-md" : ""} ${opt.value === "monthly" ? "rounded-r-md" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Summary badges */}
        {!loading && totalCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">{selectedName}</span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500">{totalCount}件</span>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
              トーン {Math.round(avgTone * 100)}
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              丁寧さ {Math.round(avgPoliteness * 100)}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-72 rounded-lg bg-slate-100" />
        </div>
      ) : !data || (data.scores.length === 0 && data.sceneDistribution.length === 0) ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-400">
            分析データがありません。
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Left: Pie chart (2/5) */}
          <div className="lg:col-span-2">
            <Card>
              <div className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  コメント分類の比率
                </h3>
                <SceneDistributionChart data={data.sceneDistribution} />
              </div>
            </Card>
          </div>

          {/* Right: Line chart (3/5) */}
          <div className="lg:col-span-3">
            <Card>
              <div className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-700">
                  トーン・丁寧さスコア推移
                </h3>
                <ScoreTrendChart data={data.scores} granularity={granularity} />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreTrendChart({ data, granularity }: { data: ScorePoint[]; granularity: Granularity }) {
  const chartData = data.map((d) => ({
    period: formatPeriod(d.period, granularity),
    トーン: Math.round(d.tone * 100),
    丁寧さ: Math.round(d.politeness * 100),
    件数: d.count,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            interval={data.length > 15 ? Math.floor(data.length / 10) : 0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Line
            type="monotone"
            dataKey="トーン"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="丁寧さ"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SceneDistributionChart({ data }: { data: SceneItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    name: SCENE_LABELS[d.label] ?? d.label,
    value: d.count,
  }));

  if (chartData.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">データなし</p>;
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={75}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [
                `${value}件 (${Math.round((value / total) * 100)}%)`,
                "",
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1 text-xs text-slate-600">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span>{d.name}</span>
            <span className="text-slate-400">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
