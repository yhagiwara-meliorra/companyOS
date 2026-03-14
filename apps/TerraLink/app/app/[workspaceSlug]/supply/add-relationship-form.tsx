"use client";

import { useActionState } from "react";
import { createSupplyRelationship } from "@/lib/domain/supply-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

type Org = { wsOrgId: string; name: string };

export function AddRelationshipForm({
  workspaceSlug,
  orgs,
}: {
  workspaceSlug: string;
  orgs: Org[];
}) {
  const boundAction = createSupplyRelationship.bind(null, workspaceSlug);
  const [state, action, pending] = useActionState(boundAction, {});

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label htmlFor="fromWsOrgId">From 組織</Label>
          <select
            id="fromWsOrgId"
            name="fromWsOrgId"
            required
            className={selectClass}
          >
            <option value="">組織を選択...</option>
            {orgs.map((org) => (
              <option key={org.wsOrgId} value={org.wsOrgId}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="toWsOrgId">To 組織</Label>
          <select
            id="toWsOrgId"
            name="toWsOrgId"
            required
            className={selectClass}
          >
            <option value="">組織を選択...</option>
            {orgs.map((org) => (
              <option key={org.wsOrgId} value={org.wsOrgId}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="relationshipType">関係タイプ</Label>
          <select
            id="relationshipType"
            name="relationshipType"
            defaultValue="supplies"
            className={selectClass}
          >
            <option value="supplies">供給</option>
            <option value="manufactures_for">製造委託</option>
            <option value="ships_for">輸送</option>
            <option value="sells_to">販売</option>
            <option value="owns">所有</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tier">ティア</Label>
          <Input
            id="tier"
            name="tier"
            type="number"
            min={0}
            max={10}
            defaultValue={1}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="verificationStatus">検証状態</Label>
          <select
            id="verificationStatus"
            name="verificationStatus"
            defaultValue="inferred"
            className={selectClass}
          >
            <option value="inferred">推定</option>
            <option value="declared">自己申告</option>
            <option value="verified">検証済み</option>
          </select>
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600">取引関係を作成しました！</p>
      )}

      <Button type="submit" disabled={pending} size="sm">
        <Plus className="mr-2 h-3.5 w-3.5" />
        {pending ? "作成中..." : "取引関係を追加"}
      </Button>
    </form>
  );
}
