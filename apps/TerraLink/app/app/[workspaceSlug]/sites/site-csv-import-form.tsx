"use client";

import { useRef, useActionState, useState } from "react";
import { importSitesCsv } from "@/lib/domain/site-actions";
import type { ImportState } from "@/lib/domain/site-actions";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2 } from "lucide-react";

type Org = { id: string; display_name: string };

const SITE_CSV_TEMPLATE =
  "name,site_type,country_code,region_admin1,lat,lng,area_ha,address\n東京工場,factory,JPN,東京都,35.6762,139.6503,5.2,東京都千代田区1-1\n";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedOrg, setSelectedOrg] = useState(orgs[0]?.id ?? "");
  const boundAction = importSitesCsv.bind(null, workspaceSlug);
  const [state, action, pending] = useActionState<ImportState, FormData>(
    boundAction,
    {}
  );

  if (orgs.length === 0) {
    return null;
  }

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="organizationId" value={selectedOrg} />
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
