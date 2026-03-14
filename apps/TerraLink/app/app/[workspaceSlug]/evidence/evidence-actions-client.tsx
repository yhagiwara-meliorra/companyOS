"use client";

import { useState, useTransition } from "react";
import {
  getEvidenceUrl,
  updateEvidenceVisibility,
  deleteEvidence,
} from "@/lib/domain/evidence-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Download,
  Eye,
  EyeOff,
  Share2,
  Trash2,
  Loader2,
} from "lucide-react";

type Props = {
  workspaceSlug: string;
  evidenceId: string;
  storagePath: string;
  currentVisibility: string;
  canEdit?: boolean;
};

export function EvidenceActions({
  workspaceSlug,
  evidenceId,
  storagePath,
  currentVisibility,
  canEdit = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const res = await getEvidenceUrl(storagePath);
      if (res.url) {
        window.open(res.url, "_blank");
      } else {
        setError("ダウンロードURLの取得に失敗しました");
      }
    });
  }

  function handleVisibilityChange(visibility: string) {
    setError(null);
    startTransition(async () => {
      const res = await updateEvidenceVisibility(workspaceSlug, evidenceId, visibility);
      if (res && "error" in res) {
        setError("公開範囲の変更に失敗しました");
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteEvidence(workspaceSlug, evidenceId);
      if (res && "error" in res) {
        setError("削除に失敗しました");
      } else {
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={isPending}
            aria-label="アクションメニュー"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MoreHorizontal className="h-3.5 w-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-3.5 w-3.5" />
            ダウンロード
          </DropdownMenuItem>
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              {currentVisibility !== "shared_to_buyers" && (
                <DropdownMenuItem
                  onClick={() => handleVisibilityChange("shared_to_buyers")}
                >
                  <Share2 className="mr-2 h-3.5 w-3.5" />
                  バイヤーに共有
                </DropdownMenuItem>
              )}
              {currentVisibility !== "workspace_private" && (
                <DropdownMenuItem
                  onClick={() => handleVisibilityChange("workspace_private")}
                >
                  <EyeOff className="mr-2 h-3.5 w-3.5" />
                  非公開にする
                </DropdownMenuItem>
              )}
              {currentVisibility !== "org_private" && (
                <DropdownMenuItem
                  onClick={() => handleVisibilityChange("org_private")}
                >
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  組織限定
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirmOpen(true)}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                削除
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>証憑を削除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            この証憑ファイルを削除してもよろしいですか？ファイルは論理削除され、ライブラリに表示されなくなります。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              削除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
