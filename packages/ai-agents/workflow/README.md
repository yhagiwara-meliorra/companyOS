# LangGraph Workflow

`packages/ai-agents/workflow` は AI CEO の LangGraph 実装を集約する。

## Structure

- `decision-graph.state.ts`
  - Graph 入出力と内部 state schema
- `decision-workflow.ts`
  - Graph 定義と node 接続
- `nodes/`
  - 各 node で使う draft schema
- `routing/`
  - 条件分岐ルーター
- `interrupts/`
  - interrupt 定義と runtime

## Compatibility

`apps/company-os/src/graph/*` と `apps/company-os/src/server/orchestrators/decision-graph.runtime.ts` は、このディレクトリへの再エクスポートを提供する。

