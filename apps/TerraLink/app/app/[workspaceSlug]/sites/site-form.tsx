"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createSite, updateSite } from "@/lib/domain/site-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Site = {
  id: string;
  name: string;
  site_type: string;
  country_code: string | null;
  region_admin1: string | null;
  lat: number | null;
  lng: number | null;
  area_ha: number | null;
  address: string | null;
};

type Org = { id: string; display_name: string };

export function SiteForm({
  workspaceSlug,
  orgs,
  site,
}: {
  workspaceSlug: string;
  orgs: Org[];
  site?: Site;
}) {
  const router = useRouter();
  const isEdit = !!site;

  const boundAction = isEdit
    ? updateSite.bind(null, workspaceSlug, site.id)
    : createSite.bind(null, workspaceSlug);

  const [state, action, pending] = useActionState(boundAction, {});

  if (state.success && !isEdit) {
    router.push(`/app/${workspaceSlug}/sites`);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={action} className="space-y-5">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="organizationId">組織</Label>
              <select
                id="organizationId"
                name="organizationId"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">組織を選択...</option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">サイト名</Label>
              <Input
                id="name"
                name="name"
                defaultValue={site?.name ?? ""}
                placeholder="Main processing facility"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteType">種別</Label>
              <select
                id="siteType"
                name="siteType"
                defaultValue={site?.site_type ?? "other"}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="farm">農場</option>
                <option value="plantation">プランテーション</option>
                <option value="factory">工場</option>
                <option value="warehouse">倉庫</option>
                <option value="port">港</option>
                <option value="mine">鉱山</option>
                <option value="office">オフィス</option>
                <option value="other">その他</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="countryCode">国コード</Label>
              <Input
                id="countryCode"
                name="countryCode"
                defaultValue={site?.country_code ?? ""}
                placeholder="BRA"
                maxLength={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regionAdmin1">地域</Label>
              <Input
                id="regionAdmin1"
                name="regionAdmin1"
                defaultValue={site?.region_admin1 ?? ""}
                placeholder="Mato Grosso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaHa">面積（ヘクタール）</Label>
              <Input
                id="areaHa"
                name="areaHa"
                type="number"
                step="0.01"
                defaultValue={site?.area_ha ?? ""}
                placeholder="1500"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lat">緯度</Label>
              <Input
                id="lat"
                name="lat"
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                defaultValue={site?.lat ?? ""}
                placeholder="-12.9714"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">経度</Label>
              <Input
                id="lng"
                name="lng"
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                defaultValue={site?.lng ?? ""}
                placeholder="-38.5124"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">住所</Label>
            <Input
              id="address"
              name="address"
              defaultValue={site?.address ?? ""}
              placeholder="123 Forest Road, Region, Country"
            />
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
                  ? "サイトを更新"
                  : "サイトを作成"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/app/${workspaceSlug}/sites`}>
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
