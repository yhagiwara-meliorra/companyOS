# Supabase Schema

`infra/supabase` は Company Builder OS の Supabase スキーマとマイグレーションを管理する。

## Structure

- `schema/company_builder.sql`
  - 正本スキーマ（現在の全体定義）
- `migrations/`
  - 適用順に管理するマイグレーションSQL
- `seed/`
  - 初期データ投入用ファイル

## Current Files

- `migrations/0001_company_builder_init.sql`
  - 初期スキーマ

## Operation

1. 変更時は `schema/company_builder.sql` を更新する。
2. 同内容または差分を `migrations/` に新規SQLとして追加する。
3. seed が必要な場合は `seed/` に追加する。

