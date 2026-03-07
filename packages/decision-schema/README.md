# Decision Schema Package

`packages/decision-schema` は、`company-os` と各 product app で共有する Decision Packet の共通語彙を管理する。

## Why on GitHub

公開する。理由は、Decision Packet が `company-os` と product apps の共通語彙であり、仕様同期とレビューを一元化するため。

## Structure

- `src/decision-packet.schema.ts`
  - Decision Packet の正規スキーマ（中核）
- `src/artifact.schema.ts`
  - 生成成果物の型定義
- `src/approval.schema.ts`
  - 承認判定と人間承認ロジック
- `src/thread.schema.ts`
  - スレッド種別、ステータス、メタデータ

## Notes

- Decision Packet は会話ログではなく、会社の正規データ。
- LangGraph state はワークフロー実行用であり、Decision Packet とは分離して扱う。
- 既存アプリ互換のため、`apps/company-os/src/domain/decision-packet.schema.ts` は本パッケージへの再エクスポートを行う。

