# AI Providers

`packages/ai-agents/providers` は AI provider 接続層を管理する。

## Structure

- `run-structured-step.ts`
  - provider 実行エントリポイント
- `routing/provider-routing.ts`
  - section ごとの provider ルーティング
- `anthropic/anthropic-structured-step.ts`
  - Anthropic 呼び出しアダプタ
- `openai/openai-structured-step.ts`
  - OpenAI 呼び出しアダプタ
- `shared/mock-structured-step.ts`
  - mock 出力（ローカル実行・未接続時）

## Notes

- `MOCK_DECISION_PACKET !== "false"` または API キー未設定時は mock を使用。
- 実 SDK 接続時は `anthropic` と `openai` アダプタを実装し、`provider-routing.ts` で振り分ける。

