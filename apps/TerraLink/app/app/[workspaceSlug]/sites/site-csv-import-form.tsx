"use client";

import { useActionState, useState } from "react";
import { importSitesCsv } from "@/lib/domain/site-actions";
import type { ImportState } from "@/lib/domain/site-actions";
import { useCsvDrop } from "@/lib/hooks/use-csv-drop";
import { CsvDropOverlay } from "@/components/csv-drop-overlay";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

type Org = { id: string; display_name: string };

const SITE_CSV_TEMPLATE =
  "site_name,site_type,country_code,region,latitude,longitude,area_ha,address_text\n東京工場,factory,JP,東京都,35.6762,139.6503,5.2,東京都千代田区1-1\nサンプル農場,farm,BR,Mato Grosso,-12.6543,-55.3210,250.0,Fazenda Exemplo\n";

function downloadTemplate() {
  const bom = "\uFEFF";
  const blob = new Blob([bom + SITE_CSV_TEMPLATE], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sites_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function SiteCsvImportForm({
  workspaceSlug,
  orgs,
}: {
  workspaceSlug: string;
  orgs: Org[];
}) {
  const [selectedOrg, setSelectedOrg] = useState(orgs[0]?.id ?? "");
  const [showDetail, setShowDetail] = useState(false);
  const boundAction = importSitesCsv.bind(null, workspaceSlug);
  const [state, action, pending] = useActionState<ImportState, FormData>(
    boundAction,
    {}
  );

  const hasOrgs = orgs.length > 0;
  const { formRef, fileRef, isDragging } = useCsvDrop({
    disabled: pending || !hasOrgs,
  });

  return (
    <>
      {isDragging && hasOrgs && (
        <CsvDropOverlay label="サイト CSV をドロップしてインポート" />
      )}
      <div className="inline-flex flex-col items-end gap-1">
        <form ref={formRef} action={action} className="inline-flex items-center gap-2">
          <input type="hidden" name="organizationId" value={selectedOrg} />
          {hasOrgs && (
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="h-8 rounded-md border bg-transparent px-2 text-xs"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.display_name}
                </option>
              ))}
            </select>
          )}
          <input
            ref={fileRef}
            type="file"
            name="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values,application/csv,application/vnd.ms-excel"
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
            disabled={pending || !hasOrgs}
            title={!hasOrgs ? "先に組織をインポートしてください" : undefined}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-2 h-3.5 w-3.5" />
            {pending ? "インポート中..." : "CSV インポート"}
          </Button>
        </form>
        {!hasOrgs && (
          <span className="text-[11px] text-muted-foreground">
            ※ CSV インポートには組織の登録が必要です
          </span>
        )}
        {state.error && (
          <div className="max-w-sm text-right">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-red-600"
              onClick={() => setShowDetail(!showDetail)}
            >
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[200px]">{state.error.split("\n")[0]}</span>
              {state.error.includes("\n") && (
                showDetail ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {showDetail && (
              <pre className="mt-1 whitespace-pre-wrap text-left text-[11px] text-red-600 bg-red-50 rounded p-2 max-h-32 overflow-auto">
                {state.error}
              </pre>
            )}
          </div>
        )}
        {state.success && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            {state.imported}件インポート完了
          </span>
        )}
      </div>
    </>
  );
}
