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
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyScore {
  date: string;
  tone: number;
  politeness: number;
  count: number;
}

interface SceneItem {
  label: string;
  count: number;
}

interface MemberData {
  personId: string;
  displayName: string;
  dailyScores: DailyScore[];
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function MemberScoreChart({ data }: { data: DailyScore[] }) {
  const chartData = data.map((d) => ({
    date: formatDate(d.date),
    トーン: Math.round(d.tone * 100),
    丁寧さ: Math.round(d.politeness * 100),
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
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

function MemberSceneChart({ data }: { data: SceneItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    name: SCENE_LABELS[d.label] ?? d.label,
    value: d.count,
  }));

  if (chartData.length === 0) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value}件 (${Math.round((value / total) * 100)}%)`, ""]}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {chartData.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1 text-xs text-slate-600">
            <div
              className="h-2.5 w-2.5 rounded-full"
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

export function MemberAnalytics() {
  const [members, setMembers] = useState<MemberData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics/members");
      if (res.ok) {
        const json = await res.json();
        setMembers(json.members ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-64 rounded-lg bg-slate-100" />
          <div className="h-64 rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-400">
          まだメンバー別の分析データがありません。
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {members.map((member) => {
        const totalMessages = member.dailyScores.reduce((s, d) => s + d.count, 0);
        // Calculate overall averages
        const avgTone = totalMessages > 0
          ? member.dailyScores.reduce((s, d) => s + d.tone * d.count, 0) / totalMessages
          : 0;
        const avgPoliteness = totalMessages > 0
          ? member.dailyScores.reduce((s, d) => s + d.politeness * d.count, 0) / totalMessages
          : 0;

        return (
          <Card key={member.personId}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{member.displayName}</CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {totalMessages}件のメッセージ
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                    トーン {Math.round(avgTone * 100)}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    丁寧さ {Math.round(avgPoliteness * 100)}
                  </span>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-4">
              {/* Score trend chart */}
              {member.dailyScores.length > 1 && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-slate-500">
                    トーン・丁寧さスコア推移（直近14日）
                  </h4>
                  <MemberScoreChart data={member.dailyScores} />
                </div>
              )}

              {/* Scene distribution */}
              {member.sceneDistribution.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-medium text-slate-500">
                    コメント分類の比率
                  </h4>
                  <MemberSceneChart data={member.sceneDistribution} />
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
