"use client";

import { useActionState, useState } from "react";
import { importProductLinesCsv } from "@/lib/domain/eudr-actions";
import type { ImportState } from "@/lib/domain/eudr-actions";
import { useCsvDrop } from "@/lib/hooks/use-csv-drop";
import { CsvDropOverlay } from "@/components/csv-drop-overlay";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

const PL_CSV_TEMPLATE =
  "commodity_type,cn_code,product_description,country_of_production,quantity_kg,hs_code,trade_name,scientific_name\ncoffee,0901,Green coffee beans,RW,5000,0901.11,Arabica,Coffea arabica\nsoya,1201,Soybeans,BR,50000,1201.90,,Glycine max\n";

function downloadTemplate() {
  const bom = "\uFEFF";
  const blob = new Blob([bom + PL_CSV_TEMPLATE], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product_lines_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductLineCsvImportForm({
  workspaceSlug,
  ddsId,
}: {
  workspaceSlug: string;
  ddsId: string;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const boundAction = importProductLinesCsv.bind(null, workspaceSlug, ddsId);
  const [state, action, pending] = useActionState<ImportState, FormData>(
    boundAction,
    {}
  );
  const { formRef, fileRef, isDragging } = useCsvDrop({ disabled: pending });

  return (
    <>
      {isDragging && <CsvDropOverlay label="製品明細 CSV をドロップしてインポート" />}
      <div className="inline-flex flex-col items-end gap-1">
        <form ref={formRef} action={action} className="inline-flex items-center gap-2">
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
          <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
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
        </form>
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
