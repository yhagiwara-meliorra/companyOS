"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Upload,
  Trash2,
  Share2,
  Link2,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import type { AuditEntryRow } from "./page";

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  insert: {
    label: "作成",
    icon: <Upload className="h-3.5 w-3.5" />,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  },
  delete: {
    label: "削除",
    icon: <Trash2 className="h-3.5 w-3.5" />,
    color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  share: {
    label: "共有",
    icon: <Share2 className="h-3.5 w-3.5" />,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  status_change: {
    label: "更新",
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  link: {
    label: "リンク",
    icon: <Link2 className="h-3.5 w-3.5" />,
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  },
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

function describeChange(entry: AuditEntryRow): string {
  const table = entry.target_table.replace(/_/g, " ");
  const action = entry.action;

  if (action === "insert" && entry.after_state) {
    const state = entry.after_state;
    if (state.file_name) return `アップロード ${state.file_name}`;
    if (state.target_type) return `リンク先: ${state.target_type}`;
    return `作成 ${table} レコード`;
  }
  if (action === "delete") return `削除 ${table} レコード`;
  if (action === "share" && entry.after_state) {
    return `公開範囲を変更: ${String(entry.after_state.visibility ?? "").replace(/_/g, " ")}`;
  }
  if (action === "status_change" && entry.after_state) {
    return `公開範囲を変更: ${String(entry.after_state.visibility ?? "").replace(/_/g, " ")}`;
  }
  return `${action} on ${table}`;
}

type Props = {
  entries: AuditEntryRow[];
};

export function AuditLog({ entries }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleEntries = showAll ? entries : entries.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          監査ログ
        </CardTitle>
        <CardDescription>
          コンプライアンスと監査のために記録された最近の変更
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            監査エントリがまだありません。証憑のアップロード、共有、変更時にここに記録されます。
          </p>
        ) : (
          <div className="space-y-3">
            {visibleEntries.map((entry) => {
              const config = ACTION_CONFIG[entry.action] ?? {
                label: entry.action,
                icon: <Clock className="h-3.5 w-3.5" />,
                color:
                  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
              };

              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.color}`}
                  >
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {describeChange(entry)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {entry.target_table.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatRelativeTime(entry.created_at)}
                      </span>
                      {entry.actor_user_id && (
                        <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
                          {entry.actor_user_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {entries.length > 10 && !showAll && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowAll(true)}
              >
                <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                全{entries.length}件を表示
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
