"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlot } from "@/lib/domain/eudr-actions";
import { PlotDrawMap, type DrawResult } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Loader2, AlertTriangle, Map } from "lucide-react";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type ProductLineOption = {
  id: string;
  cnCode: string;
  commodityType: string;
  countryOfProduction: string;
};

type SiteOption = {
  id: string;
  name: string;
};

export function AddPlotForm({
  workspaceSlug,
  productLines,
  sites,
}: {
  workspaceSlug: string;
  productLines: ProductLineOption[];
  sites: SiteOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [spatialWarning, setSpatialWarning] = useState<string | null>(null);
  const [geoType, setGeoType] = useState<"point" | "polygon">("point");
  const [drawResult, setDrawResult] = useState<DrawResult | null>(null);
  const [areaHa, setAreaHa] = useState<string>("");

  const handleDraw = useCallback((result: DrawResult) => {
    setDrawResult(result);
    setAreaHa(result.areaHa.toString());
  }, []);

  const handleClear = useCallback(() => {
    setDrawResult(null);
    setAreaHa("");
  }, []);

  // Auto-suggest polygon when area >= 4ha
  const numericArea = parseFloat(areaHa);
  const shouldUsePolygon = !isNaN(numericArea) && numericArea >= 4;

  function handleAreaChange(val: string) {
    setAreaHa(val);
    const a = parseFloat(val);
    if (!isNaN(a) && a >= 4 && geoType === "point") {
      // EUDR requires polygon for >= 4 ha
      setGeoType("polygon");
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setSpatialWarning(null);

    // Inject draw result data for polygon
    if (geoType === "polygon" && drawResult) {
      formData.set("geojson", drawResult.geojson);
      formData.set("latitude", drawResult.center[0].toString());
      formData.set("longitude", drawResult.center[1].toString());
      formData.set("areaHa", drawResult.areaHa.toString());
    }

    formData.set("geolocationType", geoType);

    startTransition(async () => {
      const result = await createPlot(workspaceSlug, {}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        // Check spatial hits
        if (result.spatialHits) {
          const hits = result.spatialHits;
          if (hits.forestHits > 0 || hits.protectedAreaHits > 0) {
            setSpatialWarning(
              `空間スクリーニング検出: 森林レイヤー ${hits.forestHits}件, 保護区域 ${hits.protectedAreaHits}件のヒット`
            );
          }
        }
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          生産区画を追加
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {/* Product Line */}
          <div className="space-y-2">
            <Label>製品明細</Label>
            <select name="productLineId" required className={selectCn}>
              <option value="">製品明細を選択...</option>
              {productLines.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.commodityType} — {pl.cnCode} ({pl.countryOfProduction})
                </option>
              ))}
            </select>
          </div>

          {/* Country of production */}
          <div className="space-y-2">
            <Label>生産国コード</Label>
            <Input
              name="countryOfProduction"
              required
              placeholder="例: BR, ID, CM"
              maxLength={3}
            />
          </div>

          {/* Area */}
          <div className="space-y-2">
            <Label>
              面積 (ha){" "}
              {shouldUsePolygon && (
                <span className="text-amber-600 text-xs">
                  — 4ha 以上はポリゴンが必要です (EUDR Art.9)
                </span>
              )}
            </Label>
            <Input
              name="areaHa"
              type="number"
              step="0.01"
              min="0"
              value={areaHa}
              onChange={(e) => handleAreaChange(e.target.value)}
              placeholder="例: 2.5"
            />
          </div>

          {/* Geolocation Type */}
          <div className="space-y-2">
            <Label>ジオロケーションタイプ</Label>
            <select
              name="geolocationType"
              value={geoType}
              onChange={(e) => setGeoType(e.target.value as "point" | "polygon")}
              className={selectCn}
            >
              <option value="point">ポイント（&lt; 4 ha）</option>
              <option value="polygon">ポリゴン（≥ 4 ha）</option>
            </select>
          </div>

          {/* Point mode: lat/lng inputs */}
          {geoType === "point" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>緯度</Label>
                <Input
                  name="latitude"
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  placeholder="例: -3.1234"
                />
              </div>
              <div className="space-y-2">
                <Label>経度</Label>
                <Input
                  name="longitude"
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  placeholder="例: 104.5678"
                />
              </div>
            </div>
          )}

          {/* Polygon mode: Leaflet Draw map */}
          {geoType === "polygon" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Map className="h-3.5 w-3.5" />
                ポリゴンを描画
              </Label>
              <p className="text-xs text-muted-foreground">
                地図上でポリゴンツールを使って生産区画の境界を描画してください
              </p>
              <PlotDrawMap
                onDraw={handleDraw}
                onClear={handleClear}
                className="h-[400px] w-full rounded-lg border"
              />
              {drawResult && (
                <p className="text-xs text-emerald-600">
                  ✓ ポリゴン描画済み — 面積: {drawResult.areaHa} ha, 中心:
                  [{drawResult.center[0].toFixed(4)},{" "}
                  {drawResult.center[1].toFixed(4)}]
                </p>
              )}
              {/* Hidden fields for polygon data */}
              <input type="hidden" name="geojson" value={drawResult?.geojson ?? ""} />
              <input type="hidden" name="latitude" value={drawResult?.center[0]?.toString() ?? ""} />
              <input type="hidden" name="longitude" value={drawResult?.center[1]?.toString() ?? ""} />
            </div>
          )}

          {/* Additional fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>生産開始日</Label>
              <Input name="productionStartDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label>生産終了日</Label>
              <Input name="productionEndDate" type="date" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>地域</Label>
              <Input name="region" placeholder="例: Pará, Sumatra" />
            </div>
            <div className="space-y-2">
              <Label>区画参照番号</Label>
              <Input name="plotReference" placeholder="任意の識別子" />
            </div>
          </div>

          {/* Optional site link */}
          {sites.length > 0 && (
            <div className="space-y-2">
              <Label>サイトとリンク（任意）</Label>
              <select name="siteId" className={selectCn}>
                <option value="">サイトを選択...</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Warnings / Errors */}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {spatialWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">{spatialWarning}</p>
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            区画を追加
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
