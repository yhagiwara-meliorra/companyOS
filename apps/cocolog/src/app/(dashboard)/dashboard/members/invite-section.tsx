"use client";

import { useState } from "react";
import { generateInviteLink } from "./actions";
import { Link2, Copy, Check } from "lucide-react";

export function InviteSection() {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const result = await generateInviteLink();
    if (result.error) {
      setError(result.error);
    } else {
      setUrl(result.url);
    }
    setLoading(false);
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border-light bg-surface-raised p-6">
      <h2 className="text-lg font-semibold text-slate-900">メンバーを招待</h2>
      <p className="mt-1 text-sm text-slate-500">
        招待リンクを生成して共有してください。リンクは7日間有効です。
      </p>

      <div className="mt-4">
        {!url ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              {loading ? "生成中..." : "招待リンクを生成"}
            </button>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={url}
                className="flex-1 rounded-lg border border-border-light bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    コピー済み
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    コピー
                  </>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setUrl(null);
                setCopied(false);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              新しいリンクを生成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
