# Decision Packet / LangGraph / Supabase / Next.js 設計 v1

## 結論
Decision Packet の項目定義は **LangGraph そのものではない**。  
Decision Packet は **会社の意思決定を表す正規の業務スキーマ** であり、LangGraph はそのスキーマを生成・更新・審査するオーケストレーション層として使う。

推奨レイヤー:

1. **Domain Contract**: `DecisionPacket`（正規スキーマ）
2. **Workflow State**: `DecisionGraphState`（LangGraph state）
3. **Persistence**: Supabase tables
4. **Presentation**: Next.js screens / forms

---

## 1. Decision Packet の役割
AI CEO 対話の結果を、議事録ではなく「後続処理に流せる構造化データ」に変換したもの。

これを単一ソースにして、以下を派生生成する。
- PRD
- Build Plan
- GTM Brief
- Legal Change Request
- Approval Item

---

## 2. Decision Packet 項目定義

### 2.1 Metadata
- `id`
- `threadId`
- `version`
- `status` (`draft` / `review_required` / `approved` / `rejected` / `archived`)
- `threadType` (`company_strategy` / `new_product` / `service_addition` / `go_to_market` / `legal_policy_change`)
- `title`
- `summary`
- `createdAt`
- `updatedAt`
- `createdBy`

### 2.2 Constitution Fit
- `missionFit`
- `visionFit`
- `solveFit`
- `principles`
  - `explainableToNextGeneration`
  - `reducesExternalities`
  - `transparent`
  - `empowersIndividuals`
  - `scalableToLargeMarket`
- `misalignmentPoints[]`
- `constitutionScore`
- `constitutionDecision` (`pass` / `needs_revision` / `fail`)

### 2.3 Problem Frame
- `targetCustomer`
- `targetUser`
- `coreProblem`
- `currentAlternatives`
- `painLevel`
- `urgency`
- `willingnessToPay`
- `marketHypothesis`
- `evidence[]`

### 2.4 World / Why Now
- `whyNow`
- `desiredWorld`
- `socialImpact`
- `nonGoals[]`

### 2.5 Solution Frame
- `solutionConcept`
- `aiRole`
- `humanRole`
- `workflowChange`
- `whyAI`
- `whyNotAI[]`

### 2.6 MVP Scope
- `inScopeFeatures[]`
- `outOfScopeFeatures[]`
- `successCriteria[]`
- `initialCustomers[]`
- `initialKPIs[]`

### 2.7 Build Direction
- `recommendedStack`
  - `frontend`
  - `backend`
  - `database`
  - `orchestration`
  - `models`
- `dataRequirements[]`
- `agentPlan[]`
- `humanApprovalPoints[]`

### 2.8 GTM
- `positioning`
- `valueProposition`
- `targetIndustry`
- `buyerPersona`
- `pricingHypothesis`
- `salesMotion`
- `marketingAssetsNeeded[]`

### 2.9 Risk / Legal
- `legalRisks[]`
- `ethicalRisks[]`
- `marketRisks[]`
- `implementationRisks[]`
- `requiredContracts[]`
- `requiredPolicies[]`
- `legalTriggerRequired` (boolean)

### 2.10 Approval
- `approvalRequired` (boolean)
- `approvalReasons[]`
- `estimatedCostImpactJPY`
- `changesCeoAiDesign` (boolean)
- `finalDecision` (`go` / `hold` / `reject`)
- `decisionReason`

### 2.11 Execution
- `nextActions[]`
- `owners[]`
- `dueDates[]`
- `artifactRequests[]`

---

## 3. LangGraph で持つべきもの
Decision Packet そのものは正規スキーマ。  
LangGraph では、これに加えて「対話中の途中状態」を持つ。

### 3.1 DecisionGraphState
- `threadId`
- `threadType`
- `messages[]`
- `rawUserInput`
- `constitutionContext`
- `problemDraft`
- `solutionDraft`
- `mvpDraft`
- `gtmDraft`
- `riskDraft`
- `legalImpactDraft`
- `approvalDraft`
- `decisionPacketDraft`
- `approvalRequired`
- `blockingIssues[]`
- `artifactsToGenerate[]`
- `runStatus`

### 3.2 Nodes
- `intake`
- `constitution_check`
- `problem_frame`
- `world_check`
- `solution_frame`
- `mvp_cut`
- `build_direction`
- `gtm_frame`
- `risk_and_legal_check`
- `approval_gate`
- `persist_decision_packet`
- `fanout_artifacts`

---

## 4. Supabase テーブル

### 4.1 threads
- `id`
- `thread_type`
- `title`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### 4.2 thread_messages
- `id`
- `thread_id`
- `role`
- `content`
- `created_at`

### 4.3 decision_packets
- `id`
- `thread_id`
- `version`
- `status`
- `title`
- `summary`
- `constitution_score`
- `approval_required`
- `approval_reasons_json`
- `estimated_cost_impact_jpy`
- `changes_ceo_ai_design`
- `final_decision`
- `packet_json`
- `created_at`
- `updated_at`

### 4.4 artifact_requests
- `id`
- `decision_packet_id`
- `artifact_type` (`prd` / `build_plan` / `gtm_brief` / `legal_change_request`)
- `status`
- `requested_by`
- `created_at`

### 4.5 artifacts
- `id`
- `artifact_request_id`
- `decision_packet_id`
- `artifact_type`
- `version`
- `content_md`
- `content_json`
- `status`
- `created_at`

### 4.6 approvals
- `id`
- `decision_packet_id`
- `approval_type`
- `reason`
- `approver`
- `status`
- `approved_at`

### 4.7 legal_triggers
- `id`
- `decision_packet_id`
- `trigger_type`
- `status`
- `notes`
- `created_at`

---

## 5. Next.js 画面
- `/threads/new`
- `/threads/[id]`
- `/decision-packets/[id]`
- `/decision-packets/[id]/review`
- `/artifacts/[id]`
- `/approvals`
- `/handoffs/legal`

---

## 6. 一番重要な設計原則
1. Decision Packet は **会話ログではなく、会社の正規データ**。
2. LangGraph は **それを作るワークフロー**。
3. Supabase は **その履歴と版管理を残す場所**。
4. Next.js は **人間が確認・承認する画面**。

---

## 7. 最初の実装順
1. `DecisionPacket` スキーマを定義
2. `decision_packets` テーブルを作成
3. `thread` / `thread_messages` を作成
4. LangGraph の `constitution_check` まで実装
5. `persist_decision_packet` を実装
6. `generate_prd` を最初の artifact として実装
7. 次に `build_plan` と `gtm_brief`
8. `legal_trigger` を追加
