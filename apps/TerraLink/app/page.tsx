import Link from "next/link";
import { Globe, Shield, BarChart3, Leaf } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Globe className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">TerraLink</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          生物多様性・サプライチェーン リスク管理プラットフォーム
        </p>
      </div>

      <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-background p-4 text-center">
          <Shield className="h-6 w-6 text-emerald-600" />
          <p className="text-sm font-medium">TNFD / CSRD 対応</p>
          <p className="text-xs text-muted-foreground">
            国際基準に沿ったリスク評価と開示
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-background p-4 text-center">
          <BarChart3 className="h-6 w-6 text-sky-600" />
          <p className="text-sm font-medium">サプライチェーン可視化</p>
          <p className="text-xs text-muted-foreground">
            TierN サプライヤーの追跡と管理
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-background p-4 text-center">
          <Leaf className="h-6 w-6 text-green-600" />
          <p className="text-sm font-medium">LEAP ワークフロー</p>
          <p className="text-xs text-muted-foreground">
            特定・評価・査定・準備の4フェーズ
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          はじめる
        </Link>
        <Link
          href="/login"
          className="rounded-md border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          ログイン
        </Link>
      </div>
    </main>
  );
}
