"use client";

import { useState, useTransition } from "react";
import {
  createAssessment,
  updateAssessmentStatus,
} from "@/lib/domain/leap-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Play, Archive, Loader2 } from "lucide-react";
import type { AssessmentRow } from "./page";

const ASSESSMENT_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  active: "アクティブ",
  archived: "アーカイブ済み",
};

const STATUS_STYLE: Record<string, string> = {
  draft:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  archived:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

export function AssessmentHeader({
  workspaceSlug,
  assessments,
  activeAssessment,
}: {
  workspaceSlug: string;
  assessments: AssessmentRow[];
  activeAssessment: AssessmentRow | undefined;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createAssessment(workspaceSlug, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
      }
    });
  }

  function handleStatusChange(assessmentId: string, status: string) {
    startTransition(async () => {
      await updateAssessmentStatus(workspaceSlug, assessmentId, status);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">アセスメントサイクル</CardTitle>
            <CardDescription>
              {activeAssessment
                ? `${activeAssessment.assessment_cycle} (${activeAssessment.method_version})`
                : "アセスメントがまだ開始されていません"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {activeAssessment && (
              <Badge
                variant="secondary"
                className={STATUS_STYLE[activeAssessment.status] ?? ""}
              >
                {ASSESSMENT_STATUS_LABELS[activeAssessment.status] ?? activeAssessment.status}
              </Badge>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  新規アセスメント
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>アセスメントを作成</DialogTitle>
                </DialogHeader>
                <form action={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="assessmentCycle">アセスメントサイクル</Label>
                    <Input
                      id="assessmentCycle"
                      name="assessmentCycle"
                      placeholder="例: FY2026 Q1"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="methodVersion">メソッドバージョン</Label>
                    <Input
                      id="methodVersion"
                      name="methodVersion"
                      placeholder="例: TNFD v1.0"
                      defaultValue="TNFD v1.0"
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    作成
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      {activeAssessment && (
        <CardContent>
          <div className="flex items-center gap-3">
            {activeAssessment.status === "draft" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  handleStatusChange(activeAssessment.id, "active")
                }
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                アクティブ化
              </Button>
            )}
            {activeAssessment.status === "active" && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() =>
                  handleStatusChange(activeAssessment.id, "archived")
                }
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                アーカイブ
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              開始日:{" "}
              {activeAssessment.started_at
                ? new Date(activeAssessment.started_at).toLocaleDateString("ja-JP")
                : "—"}
            </span>
            {assessments.length > 1 && (
              <span className="text-xs text-muted-foreground">
                (全{assessments.length}件のアセスメント)
              </span>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
