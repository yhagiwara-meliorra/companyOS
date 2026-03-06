# Detailed flow for Company Builder OS UI v2

## 1. `/threads/new`
- 目的: 問いを固定する
- 保存先: `threads`, `thread_messages`
- 次アクション: thread 詳細画面へ遷移

## 2. `/threads/[threadId]`
- 目的: 履歴確認と AI CEO 実行
- 実行: `runDecisionPacketAction`
- 裏側: LangGraph を `thread.id == langgraph_thread_id` で invoke

## 3. `runDecisionPacketAction`
- thread, messages, constitution を graph input に変換
- graph ノードを順に実行
- Decision Packet を保存
- interrupt が返れば `approvals` を作成して review へリダイレクト
- interrupt がなければ artifact fan-out して packet へリダイレクト

## 4. `/decision-packets/[packetId]`
- 目的: 経営判断の正規レコードを読む
- 次アクション: PRD / Build Plan / GTM brief を個別生成

## 5. `/decision-packets/[packetId]/review`
- 目的: approve / edit / reject
- 実行: `resumeApprovalAction`
- 裏側: `graph.invoke(new Command({ resume }))`

## 6. Artifact fan-out
- packet から PRD, Build Plan, GTM brief, Legal change request を生成
- 保存先: `packet_artifact_requests`, `artifacts`

## Production note
- 現在の scaffold は `MemorySaver` 前提。
- 本番では durable checkpointer に差し替えること。
