import { z } from "zod";
import type { StructuredStepParams } from "../../workflow/decision-workflow";

function extractRawUserInput(prompt: string) {
  const marker = "Raw user input:\n";
  const constitutionMarker = "\n\nConstitution:";
  const start = prompt.indexOf(marker);
  if (start === -1) return prompt.trim();
  const sliced = prompt.slice(start + marker.length);
  const end = sliced.indexOf(constitutionMarker);
  return (end === -1 ? sliced : sliced.slice(0, end)).trim();
}

function extractTitle(prompt: string) {
  const match = prompt.match(/Title: (.*)/);
  return (match?.[1] ?? "New initiative").trim();
}

export async function mockStructuredStep<TSchema extends z.ZodTypeAny>(
  params: StructuredStepParams<TSchema>,
): Promise<z.infer<TSchema>> {
  const raw = extractRawUserInput(params.user);
  const title = extractTitle(params.user);
  const short = raw.split(/[。\n]/).filter(Boolean)[0] ?? raw.slice(0, 120);

  const output = (() => {
    switch (params.section) {
      case "constitution_check":
        return {
          missionFit: `このテーマは「責任ある意思決定」を支援する方向で、会社の Mission と整合します。`,
          visionFit: `長期的には ${title} を通じて、意思決定の質を底上げする世界観に繋がります。`,
          solveFit: `${short} を、説明可能で検証可能なプロセスに変える点で Solve と一致します。`,
          desiredWorld: `重要な判断が属人的な勘ではなく、構造化された材料と対話によって行われる世界。`,
          socialImpact: `情報格差や判断格差の縮小に寄与し、ユーザー個人を強くします。`,
          whyNow: `生成AI・検索・ワークフロー自動化の実用化が同時に進み、実装コストが現実水準まで下がっているためです。`,
          nonGoals: ["完全自律で全判断を任せること", "監視や依存を強める設計"],
          principles: {
            explainableToNextGeneration: true,
            reducesExternalities: true,
            transparent: true,
            empowersIndividuals: true,
            scalableToLargeMarket: true,
          },
          misalignmentPoints: [],
          constitutionDecision: "pass",
        };
      case "problem_frame":
        return {
          targetCustomer: "B2Bの経営企画・新規事業・アライアンス責任者",
          targetUser: "CEO / 事業責任者 / プロダクト責任者",
          coreProblem: `${short} に関する重要な意思決定が、議論ログの散在と論点の未整理により遅く・粗くなること。`,
          currentAlternatives: ["NotionやDocsで議事メモを手で整理する", "コンサルやPMが手作業で要件化する", "その場の会話で都度決める"],
          painLevel: "high",
          urgency: "high",
          willingnessToPay: "medium",
          marketHypothesis: "複数サービスを作る前提のAIネイティブ会社ほど、CEO対話→要件化→実装化のOS需要が強い。",
          evidence: ["議論ログがそのままでは再利用できない", "承認ポイントが曖昧だと実装が迷走する"],
        };
      case "solution_frame":
        return {
          solutionConcept: `${title} を起点に、AI CEOの議論を Decision Packet に構造化し、PRD・Build Plan・GTM へ分岐する社内OSを作る。`,
          aiRole: ["論点整理", "憲法整合性レビュー", "MVP切り出し", "成果物ドラフト生成"],
          humanRole: ["承認境界の判断", "高リスク論点の最終決定", "実世界の責任の引受け"],
          workflowChange: "会話が議事録で終わらず、必ず packet と artifact に変換される。",
          whyAI: "長文の論点整理・比較・下書き生成に強く、人間の注意を重要判断へ集中できるため。",
          whyNotAI: ["最終責任のある承認", "法的にセンシティブな解釈", "10万円以上の費用変動判断"],
        };
      case "mvp_cut":
        return {
          inScopeFeatures: [
            "新規 thread 起票",
            "AI CEO 実行で Decision Packet 生成",
            "人間承認が必要な packet の review",
            "PRD / Build Plan / GTM brief の自動生成",
          ],
          outOfScopeFeatures: [
            "複数ワークスペースの細粒度権限制御",
            "外部顧客向け公開ポータル",
            "複雑な請求・課金機能",
          ],
          successCriteria: [
            "1回の議論から 1つの Decision Packet が必ず生成される",
            "承認が必要な変更が review キューに入る",
            "PRD / Build Plan / GTM の3種が5分以内に生成できる",
          ],
          initialCustomers: ["自社CEO", "自社プロダクト責任者", "将来の共同創業メンバー"],
          initialKPIs: ["thread→packet 変換率", "packet→artifact 生成率", "承認までの平均時間"],
        };
      case "build_direction":
        return {
          recommendedStack: {
            frontend: "Next.js App Router",
            backend: "Next.js Server Functions + Route Handlers",
            database: "Supabase Postgres",
            orchestration: "LangGraph",
            models: ["Claude (strategy / architecture)", "GPT (execution / artifact generation)"],
          },
          dataRequirements: [
            "threads",
            "thread_messages",
            "decision_packets",
            "approvals",
            "artifacts",
            "legal_change_requests",
          ],
          agentPlan: [
            "AI CEO: 経営判断と憲法整合性",
            "AI Architect: build plan とデータ設計",
            "AI Growth: GTM と営業文面",
            "AI Legal: 規約・ポリシー改訂の影響分析",
          ],
          humanApprovalPoints: [
            "10万円以上の費用変動",
            "CEO AIの設計変更",
            "外部公開文書の重要改訂",
          ],
        };
      case "gtm_frame":
        return {
          positioning: "AI CEO の議論を、会社の正規レコードと実行計画へ変換するオペレーティングシステム。",
          valueProposition: "議論をその場限りで終わらせず、PRD・Build Plan・GTM に自動変換することで意思決定速度と再現性を上げる。",
          targetIndustry: ["AI SaaS", "B2B SaaS", "新規事業部門"],
          buyerPersona: ["Founder / CEO", "Head of Product", "Chief of Staff"],
          pricingHypothesis: "初期は社内利用で検証し、外販時は月額 + 導入支援で価格設計する。",
          salesMotion: "まずは founder-led sales で、社内OSとしての価値を見せる。",
          marketingAssetsNeeded: ["1ページLP", "30秒ピッチ", "導入前後の比較図", "サンプルDecision Packet"],
        };
      case "risk_and_decision":
        return {
          legalRisks: ["個人情報や機密情報を AI に入力する運用の制御", "外部AIサービス利用条件との整合"],
          ethicalRisks: ["AIに判断を寄せすぎることによる責任の曖昧化"],
          marketRisks: ["単なる議事録ツールに見えるリスク", "対象顧客が広すぎると焦点がぼやけるリスク"],
          implementationRisks: ["interrupt の durable runtime を早期に入れないと review が不安定になる"],
          requiredContracts: ["利用規約", "プライバシーポリシー", "AIリーガル改訂フロー"],
          requiredPolicies: ["個人情報取扱規程", "開示等請求対応手順"],
          legalTriggerRequired: raw.includes("API") || raw.includes("個人情報") || raw.includes("新サービス"),
          estimatedCostImpactJPY: raw.includes("Claude") || raw.includes("GPT") ? 120000 : 50000,
          changesCeoAiDesign: raw.includes("CEO AI") || raw.includes("権限") || raw.includes("設計変更"),
          finalDecision: "go",
          decisionReason: `${title} は社内OSとして最初に作る価値が高く、以後のプロダクト開発速度を上げるため Go と判断します。`,
          nextActions: [
            "thread / packet / approval / artifact の最小フローを実装する",
            "Claude / GPT の責務分担を provider adapter に落とす",
            "最初の3本の artifact テンプレートを固定する",
          ],
          owners: ["CEO", "Product", "Tech"],
          dueDates: ["今週", "来週", "今月"],
        };
      default:
        return {};
    }
  })();

  return params.schema.parse(output);
}

