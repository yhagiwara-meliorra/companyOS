"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/auth/supabase-browser";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, Radio, AlertTriangle } from "lucide-react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// ── Types ──────────────────────────────────────────────

interface RealtimeEvent {
  id: string;
  type: "monitoring_event" | "change_log";
  title: string;
  severity?: string;
  action?: string;
  targetTable?: string;
  timestamp: string;
}

interface DashboardRealtimeProps {
  workspaceId: string;
  /** Initial server-rendered alert count */
  initialAlertCount: number;
}

// ── Constants ──────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "重大",
  warning: "警告",
  info: "情報",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "作成",
  update: "更新",
  delete: "削除",
  status_change: "状態変更",
  share: "共有",
  unshare: "共有解除",
};

const TABLE_LABEL: Record<string, string> = {
  organizations: "組織",
  sites: "サイト",
  workspace_organizations: "WS組織",
  workspace_sites: "WSサイト",
  supply_relationships: "取引関係",
  supply_edges: "供給エッジ",
  evidence_items: "証憑",
  assessments: "アセスメント",
  assessment_scopes: "評価スコープ",
  risk_register: "リスク",
  monitoring_rules: "監視ルール",
  monitoring_events: "監視イベント",
  disclosures: "開示",
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Component ──────────────────────────────────────────

export function DashboardRealtime({
  workspaceId,
  initialAlertCount,
}: DashboardRealtimeProps) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [alertDelta, setAlertDelta] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const handleMonitoringEvent = useCallback(
    (
      payload: RealtimePostgresChangesPayload<{
        [key: string]: unknown;
      }>
    ) => {
      const newRow = payload.new as Record<string, unknown> | undefined;
      if (!newRow) return;

      // Only track events for this workspace (via monitoring_rules join not
      // available in realtime — we accept all and let the server re-filter).
      const event: RealtimeEvent = {
        id: (newRow.id as string) ?? crypto.randomUUID(),
        type: "monitoring_event",
        title: (newRow.title as string) ?? "新規アラート",
        severity: (newRow.severity as string) ?? "info",
        timestamp: (newRow.created_at as string) ?? new Date().toISOString(),
      };
      setEvents((prev) => [event, ...prev].slice(0, 20));

      // Update alert count delta
      if (payload.eventType === "INSERT" && newRow.status === "open") {
        setAlertDelta((d) => d + 1);
      } else if (
        payload.eventType === "UPDATE" &&
        newRow.status === "resolved"
      ) {
        setAlertDelta((d) => d - 1);
      }
    },
    []
  );

  const handleChangeLog = useCallback(
    (
      payload: RealtimePostgresChangesPayload<{
        [key: string]: unknown;
      }>
    ) => {
      const newRow = payload.new as Record<string, unknown> | undefined;
      if (!newRow) return;

      // Filter for this workspace
      if (newRow.workspace_id !== workspaceId) return;

      const event: RealtimeEvent = {
        id: (newRow.id as string) ?? crypto.randomUUID(),
        type: "change_log",
        action: (newRow.action as string) ?? "update",
        targetTable: (newRow.target_table as string) ?? "",
        title: `${TABLE_LABEL[(newRow.target_table as string) ?? ""] ?? newRow.target_table} を${ACTION_LABEL[(newRow.action as string) ?? ""] ?? newRow.action}`,
        timestamp: (newRow.created_at as string) ?? new Date().toISOString(),
      };
      setEvents((prev) => [event, ...prev].slice(0, 20));
    },
    [workspaceId]
  );

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`dashboard:${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "monitoring_events",
        },
        handleMonitoringEvent
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "change_log",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        handleChangeLog
      )
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, handleMonitoringEvent, handleChangeLog]);

  const currentAlertCount = initialAlertCount + alertDelta;

  // Don't render anything if no realtime events yet
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Radio
          className={`h-3 w-3 ${isConnected ? "text-emerald-500" : "text-slate-400"}`}
        />
        {isConnected ? "リアルタイム接続中" : "接続中..."}
        {alertDelta !== 0 && (
          <Badge
            variant="secondary"
            className={alertDelta > 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}
          >
            アラート: {currentAlertCount} ({alertDelta > 0 ? "+" : ""}
            {alertDelta})
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio
              className={`h-4 w-4 ${isConnected ? "text-emerald-500 animate-pulse" : "text-slate-400"}`}
            />
            リアルタイムフィード
          </CardTitle>
          <div className="flex items-center gap-2">
            {alertDelta !== 0 && (
              <Badge
                variant="secondary"
                className={
                  alertDelta > 0
                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                }
              >
                <AlertTriangle className="mr-1 h-3 w-3" />
                アラート: {currentAlertCount}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {events.length}件の更新
            </span>
          </div>
        </div>
        <CardDescription>直近のリアルタイム変更</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start gap-3 rounded-md border px-3 py-2 text-sm animate-in slide-in-from-top-1 duration-200"
            >
              <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{ev.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatTime(ev.timestamp)}
                </p>
              </div>
              {ev.severity && (
                <Badge
                  variant="secondary"
                  className={`text-[10px] flex-shrink-0 ${SEVERITY_COLOR[ev.severity] ?? ""}`}
                >
                  {SEVERITY_LABEL[ev.severity] ?? ev.severity}
                </Badge>
              )}
              {ev.targetTable && (
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {TABLE_LABEL[ev.targetTable] ?? ev.targetTable}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
