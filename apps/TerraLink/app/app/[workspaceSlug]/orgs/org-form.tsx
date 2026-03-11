"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createOrganization,
  updateOrganization,
} from "@/lib/domain/organization-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Org = {
  id: string;
  legal_name: string;
  display_name: string;
  org_type: string;
  country_code: string | null;
  website: string | null;
};

export function OrgForm({
  workspaceSlug,
  org,
}: {
  workspaceSlug: string;
  org?: Org;
}) {
  const router = useRouter();
  const isEdit = !!org;

  const boundAction = isEdit
    ? updateOrganization.bind(null, workspaceSlug, org.id)
    : createOrganization.bind(null, workspaceSlug);

  const [state, action, pending] = useActionState(boundAction, {});

  useEffect(() => {
    if (state.success && !isEdit) {
      router.push(`/app/${workspaceSlug}/orgs`);
    }
  }, [state.success, isEdit, router, workspaceSlug]);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="legalName">法人名</Label>
              <Input
                id="legalName"
                name="legalName"
                defaultValue={org?.legal_name ?? ""}
                placeholder="Acme Corporation Ltd."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">表示名</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={org?.display_name ?? ""}
                placeholder="Acme Corp"
                required
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="orgType">種別</Label>
              <select
                id="orgType"
                name="orgType"
                defaultValue={org?.org_type ?? "supplier"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="buyer">バイヤー</option>
                <option value="supplier">サプライヤー</option>
                <option value="customer">顧客</option>
                <option value="partner">パートナー</option>
                <option value="logistics">物流</option>
                <option value="internal">社内</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="countryCode">国コード</Label>
              <Input
                id="countryCode"
                name="countryCode"
                defaultValue={org?.country_code ?? ""}
                placeholder="JPN"
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">ウェブサイト</Label>
              <Input
                id="website"
                name="website"
                type="url"
                defaultValue={org?.website ?? ""}
                placeholder="https://example.com"
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          {state.success && isEdit && (
            <p className="text-sm text-green-600">更新しました！</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              <Save className="mr-2 h-4 w-4" />
              {pending
                ? "保存中..."
                : isEdit
                  ? "組織を更新"
                  : "組織を作成"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/app/${workspaceSlug}/orgs`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                戻る
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
