"use client";

import { useRef, useActionState } from "react";
import { importOrganizationsCsv } from "@/lib/domain/organization-actions";
import type { ImportState } from "@/lib/domain/organization-actions";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2 } from "lucide-react";

const ORG_CSV_TEMPLATE =
  "legal_name,display_name,org_type,country_code,website\nサンプル株式会社,サンプル,supplier,JPN,https://example.com\n";

function downloadTemplate() {
  const bom = "\uFEFF";
  const blob = new Blob([bom + ORG_CSV_TEMPLATE], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "organizations_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function OrgCsvImportForm({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const boundAction = importOrganizationsCsv.bind(null, workspaceSlug);
  const [state, action, pending] = useActionState<ImportState, FormData>(
    boundAction,
    {}
  );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        name="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            e.target.form?.requestSubmit();
          }
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={downloadTemplate}
      >
        <Download className="mr-2 h-3.5 w-3.5" />
        テンプレート
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="mr-2 h-3.5 w-3.5" />
        {pending ? "インポート中..." : "CSV インポート"}
      </Button>
      {state.error && (
        <span className="text-xs text-red-600 max-w-xs truncate" title={state.error}>
          {state.error}
        </span>
      )}
      {state.success && (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          {state.imported}件インポート
        </span>
      )}
    </form>
  );
}
