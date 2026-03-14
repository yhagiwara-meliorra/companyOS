"use client";

import { useActionState } from "react";
import { addSupplierSite } from "@/lib/domain/supplier-actions";
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
import { MapPin, Loader2, Plus } from "lucide-react";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const SITE_TYPES = [
  { value: "farm", label: "農場" },
  { value: "factory", label: "工場" },
  { value: "warehouse", label: "倉庫" },
  { value: "port", label: "港湾" },
  { value: "mine", label: "鉱山" },
  { value: "office", label: "オフィス" },
  { value: "project_site", label: "プロジェクトサイト" },
  { value: "store", label: "店舗" },
  { value: "unknown", label: "不明" },
];

export function SupplierSiteForm() {
  const [state, action, isPending] = useActionState(addSupplierSite, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4" />
          サイトを追加
        </CardTitle>
        <CardDescription>
          新しいサイトを登録。登録されたサイトは取引先バイヤーのワークスペースに自動反映されます。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="siteName">サイト名</Label>
              <Input
                id="siteName"
                name="siteName"
                placeholder="工場名・拠点名"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteType">種別</Label>
              <select id="siteType" name="siteType" className={selectCn}>
                {SITE_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="countryCode">国コード</Label>
              <Input
                id="countryCode"
                name="countryCode"
                maxLength={3}
                placeholder="JPN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regionAdmin1">地域</Label>
              <Input
                id="regionAdmin1"
                name="regionAdmin1"
                placeholder="都道府県・州"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lat">緯度</Label>
              <Input
                id="lat"
                name="lat"
                type="number"
                step="any"
                min={-90}
                max={90}
                placeholder="35.6762"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">経度</Label>
              <Input
                id="lng"
                name="lng"
                type="number"
                step="any"
                min={-180}
                max={180}
                placeholder="139.6503"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaHa">面積 (ha)</Label>
              <Input
                id="areaHa"
                name="areaHa"
                type="number"
                step="any"
                min={0}
                placeholder="100"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="address">住所</Label>
              <Input
                id="address"
                name="address"
                placeholder="詳細住所（任意）"
              />
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-emerald-600">
              サイトを追加しました
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="mr-2 h-4 w-4" />
            )}
            {isPending ? "登録中..." : "サイトを登録"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
