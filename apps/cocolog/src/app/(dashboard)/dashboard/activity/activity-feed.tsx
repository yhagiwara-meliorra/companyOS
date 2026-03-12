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
  content: string | null;
  sceneLabel: string | null;
  scores: Record<string, { value?: number; confidence?: number } | unknown>;
}

interface ActivityData {
  items: ActivityItem[];
  hourly: { hour: number; count: number }[];
  dateLabel: string;
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

/** Get today's date as YYYY-MM-DD in the user's local timezone */
function getLocalToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
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
  const [selectedDate, setSelectedDate] = useState(getLocalToday);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const params = new URLSearchParams({ tz, date: selectedDate, page: String(page) });
      const res = await fetch(`/api/activity/recent?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedDate, page]);

  useEffect(() => {
    fetchData();
    // Auto-refresh only when viewing today
    const isToday = selectedDate === getLocalToday();
    if (isToday) {
      const interval = setInterval(fetchData, 30_000);
      return () => clearInterval(interval);
    }
  }, [fetchData, selectedDate]);

  // Reset to page 1 when date changes
  function handleDateChange(newDate: string) {
    setSelectedDate(newDate);
    setPage(1);
  }

  function goToPrevDay() {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    handleDateChange(d.toISOString().slice(0, 10));
  }

  function goToNextDay() {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    // Don't go beyond today
    if (next <= getLocalToday()) {
      handleDateChange(next);
    }
  }

  function goToToday() {
    handleDateChange(getLocalToday());
  }

  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const dateLabel = data?.dateLabel ?? "";
  const isToday = selectedDate === getLocalToday();

  return (
    <div className="space-y-6">
      {/* Date picker bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrevDay}
            className="rounded-md border border-border-light px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="前の日"
          >
            ←
          </button>
          <input
            type="date"
            value={selectedDate}
            max={getLocalToday()}
            onChange={(e) => handleDateChange(e.target.value)}
            className="rounded-md border border-border-light bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            type="button"
            onClick={goToNextDay}
            disabled={isToday}
            className="rounded-md border border-border-light px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="次の日"
          >
            →
          </button>
        </div>

        {!isToday && (
          <button
            type="button"
            onClick={goToToday}
            className="rounded-md border border-border-light px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            今日に戻る
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">
          {totalCount > 0
            ? `${totalCount}件のメッセージ`
            : ""}
          {isToday && " · 30秒ごとに自動更新"}
        </span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
          <div className="h-20 rounded-lg bg-slate-100" />
        </div>
      ) : (
        <>
          {/* Hourly chart */}
          <div className="rounded-xl border border-border-light bg-surface-raised p-6">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              時間帯別メッセージ数{dateLabel ? `（${dateLabel}）` : ""}
            </h3>
            {data && data.hourly.some((h) => h.count > 0) ? (
              <HourlyChart data={data.hourly} />
            ) : (
              <p className="text-sm text-slate-400">データがありません。</p>
            )}
          </div>

          {/* Feed */}
          {data && data.items.length > 0 ? (
            <>
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

                      {/* Left: metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900">
                            {item.senderName}
                          </span>
                          <span className="text-slate-400">in</span>
                          <span className="text-slate-600">#{item.channelName}</span>
                          <span className="ml-auto shrink-0 text-xs text-slate-400">
                            {formatTime(item.sentAt)}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.sceneLabel && (
                            <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                              {SCENE_LABELS[item.sceneLabel] ?? item.sceneLabel}
                            </span>
                          )}
                          {Object.entries(item.scores).map(([key, val]) => {
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

                      {/* Right: message content */}
                      {item.content && (
                        <div className="hidden shrink-0 md:block md:w-1/3 lg:w-2/5">
                          <p className="line-clamp-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                            {item.content}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-md border border-border-light px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    前へ
                  </button>
                  <span className="text-sm text-slate-500">
                    {page} / {totalPages} ページ
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md border border-border-light px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-sm text-slate-400">
              {isToday
                ? "今日のアクティビティはまだありません。"
                : "この日のアクティビティはありません。"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
