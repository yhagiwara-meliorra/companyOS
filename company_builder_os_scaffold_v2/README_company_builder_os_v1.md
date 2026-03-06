# Company Builder OS scaffold v1

この一式は、AI CEO との議論を `Decision Packet` に構造化し、
そこから PRD / Build Plan / GTM / Legal へ分岐するための最小実装雛形です。

## 含まれるファイル

- `src/domain/decision-packet.schema.ts`
  - 会社の正規データモデル
- `src/graph/decision-graph.state.ts`
  - LangGraph の input / internal state / output 定義
- `src/graph/decision-workflow.ts`
  - LangGraph ワークフローの骨格
- `db/supabase_company_builder_schema.sql`
  - Supabase Postgres のテーブル定義
- `docs/nextjs_routes_and_actions.md`
  - Next.js 画面と server action の対応表

## 重要な考え方

### 1. Decision Packet は LangGraph ではない
Decision Packet は会社の正規業務オブジェクト。
LangGraph はそれを生成・更新・レビューするための runtime。

### 2. thread と decision packet は別物
- `thread`: 経営議論の単位
- `decision_packet`: thread の現時点の構造化結論

### 3. 承認境界は first-class に持つ
この設計では、少なくとも以下を first-class に保持する。
- approval_required
- approval_reasons
- estimated_cost_impact_jpy
- changes_ceo_ai_design
- legal_trigger_required

## 使い方

### Step 1
Supabase に `db/supabase_company_builder_schema.sql` を適用する。

### Step 2
Next.js 側で `threads/new` を作り、入力を `DecisionGraphInput` へ変換する。

### Step 3
`createDecisionWorkflow()` にモデル実装を注入する。

必要実装:
- `runStructuredStep()`
- `saveDecisionPacket()`
- `onArtifactRequests()`

### Step 4
LangGraph invoke 時に `thread_id = thread.id` を渡す。

### Step 5
interrupt が返ったら `/decision-packets/[packetId]/review` に飛ばし、人間レビューで resume する。

## まず最初に動かすとよいもの

1. `threads/new`
2. `runDecisionPacketAction`
3. `decision-packets/[packetId]`
4. `decision-packets/[packetId]/review`

## 次に追加するとよいもの

- artifact generator graph
- AI Legal handoff graph
- pricing memo generator
- approval dashboard
- packet diff viewer
