"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createDdsStatement } from "@/lib/domain/eudr-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type OrgOption = { orgId: string; name: string };

export function CreateDdsForm({
  workspaceSlug,
  orgs,
}: {
  workspaceSlug: string;
  orgs: OrgOption[];
}) {
  const boundAction = createDdsStatement.bind(null, workspaceSlug);
  const [state, action, pending] = useActionState(boundAction, {});
  const router = useRouter();

  // Redirect on success
  if (state.success && state.ddsId) {
    router.push(`/app/${workspaceSlug}/eudr/dds/${state.ddsId}`);
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-4 rounded-lg border p-6">
        <div className="space-y-2">
          <Label htmlFor="operatorOrgId">オペレーター組織</Label>
          <select
            id="operatorOrgId"
            name="operatorOrgId"
            required
            className={selectClass}
          >
            <option value="">組織を選択...</option>
            {orgs.map((org) => (
              <option key={org.orgId} value={org.orgId}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="internalReference">内部参照番号</Label>
          <Input
            id="internalReference"
            name="internalReference"
            required
            placeholder="例: DDS-2026-001"
          />
          <p className="text-xs text-muted-foreground">
            社内管理用の一意な参照番号
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="operatorType">オペレータータイプ</Label>
          <select
            id="operatorType"
            name="operatorType"
            defaultValue="operator"
            className={selectClass}
          >
            <option value="operator">オペレーター</option>
            <option value="non_sme_trader">大規模トレーダー</option>
            <option value="sme_trader">中小トレーダー</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="countryOfActivity">活動国</Label>
          <Input
            id="countryOfActivity"
            name="countryOfActivity"
            placeholder="例: JP"
            maxLength={2}
          />
          <p className="text-xs text-muted-foreground">
            ISO 3166-1 alpha-2 国コード
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">説明</Label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="DDS の概要を記入..."
          />
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "作成中..." : "DDS を作成"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
}
