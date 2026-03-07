# Output Contract

AI CEO の出力は必ず以下の `Decision Packet` を満たす。

## 1. Contract

```yaml
decision_packet:
  conclusion:
    decision: "Go | Hold | Reject"
    reason: "string"
    reversibility: "reversible | irreversible"

  constitution_fit:
    fit: "strong | medium | weak | reject"
    mission: "string"
    vision: "string"
    solve: "string"
    principles:
      next_generation_explainable: "pass | warn | fail"
      reduce_externality: "pass | warn | fail"
      transparency: "pass | warn | fail"
      empower_individual: "pass | warn | fail"
      scalability: "pass | warn | fail"
    non_fit_risk: ["string"]
    recommendation: "continue | conditional_continue | stop"

  problem_summary:
    target_user: "string"
    pain: "string"
    urgency: "low | medium | high"
    willingness_to_pay: "low | medium | high"
    current_alternative: "string"

  solution_policy:
    proposed_solution: "string"
    ai_role: "string"
    human_role: "string"
    not_doing: ["string"]

  business_model:
    payer: "string"
    value_metric: "string"
    pricing_hypothesis: "string"
    arr_scale_hypothesis: "string"
    unit_economics_note: "string"

  mvp:
    in_scope: ["string"]
    out_of_scope: ["string"]
    success_criteria: ["string"]
    initial_kpi: ["string"]

  implementation:
    architecture: "string"
    agent_design: "string"
    data_requirements: ["string"]
    human_approval_points: ["string"]

  legal_policy:
    required_contracts: ["string"]
    required_policies: ["string"]
    legal_ticket: "required | not_required"
    external_disclosure_change: "required | not_required"
    internal_ops_change: "required | not_required"

  risks:
    legal: ["string"]
    ethics: ["string"]
    implementation: ["string"]
    market: ["string"]
    operation: ["string"]
    release_blockers: ["string"]

  approvals:
    human_approval_required: true
    items: ["string"]
    approvers: ["CEO | Legal | TechLead | PrivacyOfficer"]
    reasons: ["string"]

  artifacts:
    required:
      - "decision_summary.md"
      - "next_actions.md"
      - "approval_items.md"
    conditional:
      - "prd_v0.md"
      - "mvp_scope.md"
      - "build_plan.md"
      - "gtm_brief.md"
      - "legal_change_request.md"
      - "risk_register.md"
      - "pricing_hypothesis.md"

  handoff:
    targets: ["PM | Architect | Growth | Legal"]
    instructions: ["string"]

  next_actions:
    - owner: "string"
      action: "string"
      due_date: "YYYY-MM-DD"
      log_destination: "string"
```

## 2. Validation Rules

1. `decision` は `Go | Hold | Reject` のみ許可。
2. `constitution_fit.fit = reject` の場合、`decision = Reject` にする。
3. 人間承認条件に該当する場合、`approvals.human_approval_required` を `true` にする。
4. `legal_ticket = required` の場合、`handoff.targets` に `Legal` を含める。
5. `next_actions` は最低1件必須。

