"use client";

import { useActionState } from "react";
import { updateSupplierProfile } from "@/lib/domain/supplier-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Loader2 } from "lucide-react";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const ORG_TYPE_OPTIONS = [
  { value: "supplier", label: "サプライヤー" },
  { value: "buyer", label: "バイヤー" },
  { value: "customer", label: "顧客" },
  { value: "partner", label: "パートナー" },
  { value: "logistics", label: "物流" },
  { value: "internal", label: "内部" },
];

type Props = {
  organization: {
    id: string;
    legal_name: string;
    display_name: string;
    org_type: string;
    country_code: string | null;
    website: string | null;
  };
};

export function SupplierProfileForm({ organization }: Props) {
  const [state, action, isPending] = useActionState(updateSupplierProfile, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          組織情報
        </CardTitle>
        <CardDescription>
          バイヤーに共有される組織プロファイルを編集
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">法人名</Label>
              <Input
                id="legalName"
                name="legalName"
                defaultValue={organization.legal_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={organization.display_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgType">組織種別</Label>
              <select
                id="orgType"
                name="orgType"
                className={selectCn}
                defaultValue={organization.org_type}
              >
                {ORG_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="countryCode">国コード</Label>
              <Input
                id="countryCode"
                name="countryCode"
                defaultValue={organization.country_code ?? ""}
                maxLength={3}
                placeholder="JPN"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="website">ウェブサイト</Label>
              <Input
                id="website"
                name="website"
                type="url"
                defaultValue={organization.website ?? ""}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-emerald-600">プロファイルを更新しました</p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isPending ? "保存中..." : "プロファイルを保存"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
