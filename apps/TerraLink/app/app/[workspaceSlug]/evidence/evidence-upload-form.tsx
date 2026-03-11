"use client";

import { useState, useRef, useTransition } from "react";
import { uploadEvidence } from "@/lib/domain/evidence-actions";
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
import { Upload, Loader2, CheckCircle2 } from "lucide-react";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

type Props = {
  workspaceSlug: string;
  orgOptions: { id: string; name: string }[];
  siteOptions: { id: string; name: string }[];
};

export function EvidenceUploadForm({
  workspaceSlug,
  orgOptions,
  siteOptions,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await uploadEvidence(workspaceSlug, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setFileName(null);
        formRef.current?.reset();
        setTimeout(() => setSuccess(false), 3000);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          証憑アップロード
        </CardTitle>
        <CardDescription>
          ドキュメント、画像、データファイルを証憑としてアップロード
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="space-y-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label>ファイル</Label>
            <Input
              name="file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.xlsx,.xls,.csv,.json,.geojson,.zip"
              onChange={(e) =>
                setFileName(e.target.files?.[0]?.name ?? null)
              }
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                選択中: {fileName}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Evidence Type */}
            <div className="space-y-2">
              <Label>種別</Label>
              <select
                name="evidenceType"
                defaultValue="other"
                className={selectCn}
              >
                <option value="invoice">請求書</option>
                <option value="certificate">証明書</option>
                <option value="survey">調査</option>
                <option value="report">レポート</option>
                <option value="map">地図</option>
                <option value="contract">契約書</option>
                <option value="screenshot">スクリーンショット</option>
                <option value="other">その他</option>
              </select>
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <Label>公開範囲</Label>
              <select
                name="visibility"
                defaultValue="workspace_private"
                className={selectCn}
              >
                <option value="workspace_private">ワークスペース限定</option>
                <option value="shared_to_buyers">バイヤーに共有</option>
                <option value="org_private">組織限定</option>
              </select>
            </div>

            {/* Organization (optional) */}
            <div className="space-y-2">
              <Label>組織（任意）</Label>
              <select name="organizationId" className={selectCn}>
                <option value="">なし</option>
                {orgOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Site (optional) */}
            <div className="space-y-2">
              <Label>サイト（任意）</Label>
              <select name="siteId" className={selectCn}>
                <option value="">なし</option>
                {siteOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              ファイルをアップロードしました
            </p>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                アップロード中…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                アップロード
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
