"use client";

import { useState, useTransition } from "react";
import { runSampleIngestion } from "@/lib/domain/ingestion-actions";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle2, Loader2 } from "lucide-react";

export function IngestionTriggerButton({
  workspaceSlug,
  dataSourceId,
  sourceName,
}: {
  workspaceSlug: string;
  dataSourceId: string;
  sourceName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
  } | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await runSampleIngestion(workspaceSlug, dataSourceId);
      setResult(res);
    });
  }

  return (
    <div className="space-y-1.5">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={isPending}
        onClick={handleClick}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            実行中...
          </>
        ) : (
          <>
            <Play className="mr-2 h-3.5 w-3.5" />
            インジェスション実行
          </>
        )}
      </Button>
      {result?.success && (
        <p className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          インジェスション完了
        </p>
      )}
      {result?.error && (
        <p className="text-xs text-red-600 truncate" title={result.error}>
          {result.error}
        </p>
      )}
    </div>
  );
}
