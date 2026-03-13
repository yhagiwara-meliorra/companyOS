"use client";

import { useState } from "react";

interface RefreshResult {
  updatedUsers: number;
  updatedChannels: number;
  failedUsers: number;
  failedChannels: number;
  totalStaleUsers: number;
  totalStaleChannels: number;
  errors: string[];
  error?: string;
  message?: string;
  debug?: {
    authTeamId?: string;
    authTeam?: string;
    dbTeamId?: string;
    tokenPrefix?: string;
    staleUserIds?: string[];
    staleChannelIds?: string[];
  };
}

export function RefreshNamesButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RefreshResult | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/refresh-names", { method: "POST" });
      const json = await res.json();
      setResult(json);
    } catch {
      setResult({
        updatedUsers: 0,
        updatedChannels: 0,
        failedUsers: 0,
        failedChannels: 0,
        totalStaleUsers: 0,
        totalStaleChannels: 0,
        errors: ["リクエストに失敗しました。"],
      });
    } finally {
      setLoading(false);
    }
  }

  const hasError = result?.error;
  const hasUpdates = result && !result.error && (result.updatedUsers > 0 || result.updatedChannels > 0);
  const noStale = result && !result.error && result.totalStaleUsers === 0 && result.totalStaleChannels === 0;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="rounded-md border border-border-light px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            取得中...
          </span>
        ) : (
          "名前を再取得"
        )}
      </button>

      {result && (
        <div className="text-xs">
          {hasError && (
            <p className="text-red-600">{result.message ?? result.error}</p>
          )}
          {hasUpdates && (
            <p className="text-emerald-600">
              {result.updatedUsers > 0 && `${result.updatedUsers}人のユーザー名`}
              {result.updatedUsers > 0 && result.updatedChannels > 0 && "と"}
              {result.updatedChannels > 0 && `${result.updatedChannels}個のチャンネル名`}
              を更新しました。
              {result.failedUsers > 0 && ` (${result.failedUsers}件のユーザー取得失敗)`}
              {result.failedChannels > 0 && ` (${result.failedChannels}件のチャンネル取得失敗)`}
            </p>
          )}
          {noStale && (
            <p className="text-slate-500">更新が必要なレコードはありません。</p>
          )}
          {!hasError && !hasUpdates && !noStale && result.failedUsers + result.failedChannels > 0 && (
            <p className="text-amber-600">
              すべての取得に失敗しました（ユーザー: {result.failedUsers}件、チャンネル: {result.failedChannels}件）。Slack Appの再インストールを試してください。
            </p>
          )}
          {result.errors && result.errors.length > 0 && !hasError && (
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-600">
                エラー詳細 ({result.errors.length})
              </summary>
              <ul className="mt-1 space-y-0.5 font-mono text-slate-400">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
          {result.debug && (
            <details className="mt-1">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-600">
                デバッグ情報
              </summary>
              <pre className="mt-1 overflow-auto rounded bg-slate-50 p-2 font-mono text-[10px] text-slate-500">
                {JSON.stringify(result.debug, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
