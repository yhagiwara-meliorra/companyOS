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

interface MessageItem {
  id: string;
  senderName: string;
  senderAvatar: string | null;
  channelName: string;
  sentAt: string;
  permalink: string | null;
  content: string | null;
  sceneLabel: string | null;
  toneScore: number | null;
  politenessScore: number | null;
  scores: Record<string, { value?: number; confidence?: number } | unknown>;
}

interface MessageData {
  messages: MessageItem[];
  totalCount: number;
  page: number;
  pageSize: number;
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

const SCORE_LABELS: Record<string, string> = {
  clarity: "明瞭さ",
  empathy: "共感",
  tone_score: "トーン",
  politeness_score: "丁寧さ",
};

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#64748b",
];

type Granularity = "daily" | "weekly" | "monthly";

const GRANULARITY_OPTIONS: { value: Granularity; label: string; days: number }[] = [
  { value: "daily", label: "日次", days: 30 },
  { value: "weekly", label: "週次", days: 90 },
  { value: "monthly", label: "月次", days: 365 },
];

function formatPeriod(period: string, granularity: Granularity) {
  if (granularity === "monthly") {
    const [_y, m] = period.split("-");
    return `${parseInt(m)}月`;
  }
  if (granularity === "weekly") {
    const d = new Date(period + "T00:00:00");
    return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }) + "週";
  }
  const d = new Date(period + "T00:00:00");
  return d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color =
    value >= 0.7
      ? "bg-emerald-50 text-emerald-700"
      : value >= 0.4
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {label} {Math.round(value * 100)}
    </span>
  );
}

export function ToneAnalytics() {
  const [data, setData] = useState<ToneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [personId, setPersonId] = useState("all");
  const [granularity, setGranularity] = useState<Granularity>("daily");

  // Message list state
  const [msgData, setMsgData] = useState<MessageData | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [riskOnly, setRiskOnly] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

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

  const fetchMessages = useCallback(async () => {
    if (!showMessages) return;
    setMsgLoading(true);
    try {
      const days = GRANULARITY_OPTIONS.find((g) => g.value === granularity)?.days ?? 30;
      const params = new URLSearchParams({
        personId,
        page: String(msgPage),
        days: String(days),
      });
      if (riskOnly) params.set("riskOnly", "true");
      const res = await fetch(`/api/analytics/messages?${params}`);
      if (res.ok) {
        const json = await res.json();
        setMsgData(json);
      }
    } catch {
      // silent
    } finally {
      setMsgLoading(false);
    }
  }, [personId, granularity, msgPage, riskOnly, showMessages]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Reset message page when filters change
  function handlePersonChange(newPersonId: string) {
    setPersonId(newPersonId);
    setMsgPage(1);
  }

  function handleRiskToggle() {
    setRiskOnly((prev) => !prev);
    setMsgPage(1);
  }

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

  const msgTotalPages = msgData ? Math.max(1, Math.ceil(msgData.totalCount / msgData.pageSize)) : 1;

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
            onChange={(e) => handlePersonChange(e.target.value)}
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

      {/* ── Message list section ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-700">メッセージ一覧</h3>

          <button
            type="button"
            onClick={() => {
              setShowMessages((prev) => !prev);
              if (!showMessages) setMsgPage(1);
            }}
            className="rounded-md border border-border-light px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {showMessages ? "一覧を閉じる" : "メッセージを表示"}
          </button>

          {showMessages && (
            <button
              type="button"
              onClick={handleRiskToggle}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                riskOnly
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-red-200 text-red-600 hover:bg-red-50"
              }`}
            >
              {riskOnly ? "⚠ ハラスメントリスクのみ表示中" : "⚠ ハラスメントリスク抽出"}
            </button>
          )}

          {showMessages && msgData && (
            <span className="ml-auto text-xs text-slate-400">
              {msgData.totalCount > 0 ? `${msgData.totalCount}件` : ""}
              {riskOnly ? "（スコア30以下）" : ""}
            </span>
          )}
        </div>

        {showMessages && (
          <>
            {msgLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-20 rounded-lg bg-slate-100" />
                <div className="h-20 rounded-lg bg-slate-100" />
                <div className="h-20 rounded-lg bg-slate-100" />
              </div>
            ) : msgData && msgData.messages.length > 0 ? (
              <>
                <div className="space-y-3">
                  {msgData.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl border p-4 ${
                        (msg.toneScore !== null && msg.toneScore <= 0.3) ||
                        (msg.politenessScore !== null && msg.politenessScore <= 0.3)
                          ? "border-red-200 bg-red-50/50"
                          : "border-border-light bg-surface-raised"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        {msg.senderAvatar ? (
                          <img
                            src={msg.senderAvatar}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full"
                          />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                            {msg.senderName[0]}
                          </div>
                        )}

                        {/* Message info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-slate-900">
                              {msg.senderName}
                            </span>
                            <span className="text-slate-400">in</span>
                            <span className="text-slate-600">#{msg.channelName}</span>
                            <span className="ml-auto shrink-0 text-xs text-slate-400">
                              {formatTime(msg.sentAt)}
                            </span>
                          </div>

                          {/* Score badges */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.sceneLabel && (
                              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                                {SCENE_LABELS[msg.sceneLabel] ?? msg.sceneLabel}
                              </span>
                            )}
                            {Object.entries(msg.scores).map(([key, val]) => {
                              const v =
                                typeof val === "object" && val !== null && "value" in val
                                  ? (val as { value: number }).value
                                  : typeof val === "number"
                                    ? val
                                    : null;
                              if (v === null || !SCORE_LABELS[key]) return null;
                              return (
                                <ScoreBadge key={key} label={SCORE_LABELS[key]} value={v} />
                              );
                            })}
                          </div>

                          {msg.permalink && (
                            <a
                              href={msg.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-xs text-primary-600 hover:underline"
                            >
                              Slackで見る →
                            </a>
                          )}
                        </div>

                        {/* Message content preview */}
                        {msg.content && (
                          <div className="hidden shrink-0 md:block md:w-1/3 lg:w-2/5">
                            <p className="line-clamp-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                              {msg.content}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {msgTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMsgPage((p) => Math.max(1, p - 1))}
                      disabled={msgPage <= 1}
                      className="rounded-md border border-border-light px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      前へ
                    </button>
                    <span className="text-sm text-slate-500">
                      {msgPage} / {msgTotalPages} ページ
                    </span>
                    <button
                      type="button"
                      onClick={() => setMsgPage((p) => Math.min(msgTotalPages, p + 1))}
                      disabled={msgPage >= msgTotalPages}
                      className="rounded-md border border-border-light px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      次へ
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-sm text-slate-400">
                {riskOnly
                  ? "ハラスメントリスクのあるメッセージはありません。"
                  : "メッセージがありません。"}
              </p>
            )}
          </>
        )}
      </div>
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
