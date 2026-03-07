# Next.js routes / server actions map for Company Builder OS v1

## Goal
AI CEO との議論を `thread` として保存し、その結果を `decision_packet` に構造化し、必要に応じて `artifact` へ fan-out する。

---

## App Router pages

### 1. `/threads/new`
目的:
- 新しい議論スレッドを起票する
- thread type を選ぶ
- raw input を入力する
- 憲法スナップショットを読み込む

フォーム項目:
- title
- threadType
- rawUserInput
- constitutionText

送信先:
- `createThreadAction`

---

### 2. `/threads/[threadId]`
目的:
- スレッドの対話履歴を見る
- AI CEO 実行を再開する
- 最新の Decision Packet へ遷移する

表示:
- thread summary
- latest messages
- latest run status
- last decision packet status

アクション:
- `runDecisionPacketAction`
- `resumeApprovalAction`

---

### 3. `/decision-packets/[packetId]`
目的:
- Decision Packet を閲覧する

表示:
- 憲法整合性
- 課題整理
- ソリューション
- MVP
- 技術方針
- GTM
- リスク
- 承認必要性
- next actions

アクション:
- `requestArtifactAction`
- `createApprovalAction`

---

### 4. `/decision-packets/[packetId]/review`
目的:
- 人間承認が必要な Packet をレビューする

表示:
- approval reasons
- estimated cost impact
- CEO AI design change flag
- blocking issues

アクション:
- `approveDecisionPacketAction`
- `rejectDecisionPacketAction`
- `approveWithEditsAction`

---

### 5. `/artifacts/[artifactId]`
目的:
- PRD / build plan / GTM brief / legal change request を閲覧する

アクション:
- `regenerateArtifactAction`
- `publishArtifactAction`

---

### 6. `/approvals`
目的:
- 承認待ち一覧を見る

表示:
- packet title
- approval reasons
- requested by
- requested at
- status

---

### 7. `/handoffs/legal`
目的:
- AI Legal へ handoff された改訂依頼一覧を見る

表示:
- trigger reason
- impacted documents
- owner
- status

---

## Suggested server actions / route handlers

### `createThreadAction`
役割:
- threads を作る
- thread_messages に初回 user message を保存する
- 直後に graph 実行をキックしてもよい

入力:
- organizationId
- title
- threadType
- rawUserInput
- constitutionText

出力:
- threadId

---

### `runDecisionPacketAction`
役割:
- LangGraph workflow を invoke する
- thread_id は `thread.id` と同一 UUID を使う
- 出力を decision_packets に保存する

入力:
- threadId

出力:
- decisionPacketId
- runStatus

---

### `resumeApprovalAction`
役割:
- human approval interrupt を resume する
- approve / reject / approve-with-edit のいずれかで再開する

入力:
- threadId
- review payload

出力:
- updated packet
- runStatus

---

### `requestArtifactAction`
役割:
- packet_artifact_requests を追加する
- artifact generator workflow を enqueue する

入力:
- decisionPacketId
- artifactType

---

### `createApprovalAction`
役割:
- approvals テーブルへ pending を作る
- reviewer に通知する

---

## Minimal implementation order

1. `threads/new` フォーム
2. `createThreadAction`
3. `runDecisionPacketAction`
4. `decision-packets/[packetId]` 表示
5. `decision-packets/[packetId]/review`
6. `resumeApprovalAction`
7. artifact fan-out

---

## Recommended folder layout

```text
src/
  app/
    threads/
      new/page.tsx
      [threadId]/page.tsx
    decision-packets/
      [packetId]/page.tsx
      [packetId]/review/page.tsx
    artifacts/
      [artifactId]/page.tsx
    approvals/page.tsx
    handoffs/legal/page.tsx
  domain/
    decision-packet.schema.ts
  graph/
    decision-graph.state.ts
    decision-workflow.ts
  server/
    actions/
      create-thread.ts
      run-decision-packet.ts
      resume-approval.ts
    repositories/
      threads.repo.ts
      decision-packets.repo.ts
      approvals.repo.ts
      artifacts.repo.ts
```
