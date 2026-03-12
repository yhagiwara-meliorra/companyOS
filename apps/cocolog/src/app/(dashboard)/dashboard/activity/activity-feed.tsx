"use client";

import { useEffect, useState, useCallback } from "react";
import { HourlyChart } from "@/components/charts/hourly-chart";

interface ActivityItem {
  id: string;
  senderName: string;
  senderAvatar: string | null;
  channelName: string;
  sentAt: string;
  permalink: string | null;
  sceneLabel: string | null;
  scores: Record<string, { value?: number; confidence?: number } | unknown>;
}

interface ActivityData {
  items: ActivityItem[];
  hourly: { hour: number; count: number }[];
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
};

const SCORE_LABELS: Record<string, string> = {
  clarity: "明瞭さ",
  empathy: "共感",
  tone_score: "トーン",
  politeness_score: "丁寧さ",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
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

export function ActivityFeed() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/activity/recent");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border-light bg-surface-raised p-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            時間帯別メッセージ数（直近24時間）
          </h3>
          <p className="text-sm text-slate-400">データがありません。</p>
        </div>
        <p className="text-center text-sm text-slate-400">
          直近24時間のアクティビティはありません。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hourly chart */}
      <div className="rounded-xl border border-border-light bg-surface-raised p-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          時間帯別メッセージ数（直近24時間）
        </h3>
        <HourlyChart data={data.hourly} />
      </div>

      {/* Feed */}
      <div className="space-y-3">
        {data.items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border-light bg-surface-raised p-4"
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              {item.senderAvatar ? (
                <img
                  src={item.senderAvatar}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                  {item.senderName[0]}
                </div>
              )}

              <div className="min-w-0 flex-1">
                {/* Header row */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">
                    {item.senderName}
                  </span>
                  <span className="text-slate-400">in</span>
                  <span className="text-slate-600">#{item.channelName}</span>
                  <span className="ml-auto shrink-0 text-xs text-slate-400">
                    {formatDate(item.sentAt)} {formatTime(item.sentAt)}
                  </span>
                </div>

                {/* Scene label + scores */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.sceneLabel && (
                    <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                      {SCENE_LABELS[item.sceneLabel] ?? item.sceneLabel}
                    </span>
                  )}
                  {Object.entries(item.scores).map(([key, val]) => {
                    const v = typeof val === "object" && val !== null && "value" in val
                      ? (val as { value: number }).value
                      : typeof val === "number"
                        ? val
                        : null;
                    if (v === null || !SCORE_LABELS[key]) return null;
                    return (
                      <ScoreBadge
                        key={key}
                        label={SCORE_LABELS[key]}
                        value={v}
                      />
                    );
                  })}
                </div>

                {/* Permalink */}
                {item.permalink && (
                  <a
                    href={item.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-primary-600 hover:underline"
                  >
                    Slackで見る →
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
