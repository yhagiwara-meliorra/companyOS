"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  updateDdsStatus,
  deleteDdsStatement,
  createOrUpdateRiskAssessment,
} from "@/lib/domain/eudr-actions";
import { exportDdsAsJson } from "@/lib/domain/eudr-export";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Send,
  Download,
  Trash2,
  RotateCcw,
  XCircle,
} from "lucide-react";

export function DdsActions({
  workspaceSlug,
  ddsId,
  currentStatus,
  isReady,
}: {
  workspaceSlug: string;
  ddsId: string;
  currentStatus: string;
  isReady: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleStatusChange(newStatus: string) {
    setLoading(newStatus);
    const result = await updateDdsStatus(workspaceSlug, ddsId, newStatus);
    setLoading(null);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleRunAssessment() {
    setLoading("assess");
    const result = await createOrUpdateRiskAssessment(workspaceSlug, ddsId);
    setLoading(null);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  }

  async function handleExport() {
    setLoading("export");
    const result = await exportDdsAsJson(workspaceSlug, ddsId);
    setLoading(null);
    if (result.error) {
      alert(result.error);
    } else if (result.payload) {
      // Download as JSON file
      const blob = new Blob([JSON.stringify(result.payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dds_${ddsId.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function handleDelete() {
    if (!confirm("この DDS を削除しますか？この操作は取り消せません。")) return;
    setLoading("delete");
    const result = await deleteDdsStatement(workspaceSlug, ddsId);
    setLoading(null);
    if (result.error) {
      alert(result.error);
    } else {
      router.push(`/app/${workspaceSlug}/eudr/dds`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleRunAssessment}
        disabled={loading !== null}
      >
        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
        {loading === "assess" ? "評価中..." : "リスク評価実行"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={handleExport}
        disabled={loading !== null}
      >
        <Download className="mr-1.5 h-3.5 w-3.5" />
        {loading === "export" ? "エクスポート中..." : "JSON エクスポート"}
      </Button>

      {currentStatus === "draft" && (
        <Button
          size="sm"
          onClick={() => handleStatusChange("ready")}
          disabled={loading !== null || !isReady}
          title={!isReady ? "全ての必須項目を入力してください" : ""}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          {loading === "ready" ? "更新中..." : "提出準備完了"}
        </Button>
      )}

      {currentStatus === "ready" && (
        <>
          <Button
            size="sm"
            onClick={() => handleStatusChange("submitted")}
            disabled={loading !== null}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {loading === "submitted" ? "提出中..." : "提出"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange("draft")}
            disabled={loading !== null}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            下書きに戻す
          </Button>
        </>
      )}

      {currentStatus === "submitted" && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleStatusChange("withdrawn")}
          disabled={loading !== null}
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          {loading === "withdrawn" ? "取下げ中..." : "取下げ"}
        </Button>
      )}

      {(currentStatus === "draft" || currentStatus === "rejected") && (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={loading !== null}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          {loading === "delete" ? "削除中..." : "削除"}
        </Button>
      )}
    </div>
  );
}
