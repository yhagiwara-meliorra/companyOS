import { z } from "zod";

export const PacketDecisionSchema = z.enum(["go", "hold", "reject"]);

export const ApprovalSchema = z.object({
  approvalRequired: z.boolean().default(false),
  approvalReasons: z.array(z.string()).default([]),
  estimatedCostImpactJPY: z.number().int().nonnegative().nullable().default(null),
  changesCeoAiDesign: z.boolean().default(false),
  finalDecision: PacketDecisionSchema,
  decisionReason: z.string().min(1),
});

export function shouldRequireHumanApproval(input: {
  estimatedCostImpactJPY: number | null;
  changesCeoAiDesign: boolean;
  legalTriggerRequired?: boolean;
}): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if ((input.estimatedCostImpactJPY ?? 0) >= 100_000) {
    reasons.push("支払い金額が10万円以上変わる可能性がある");
  }

  if (input.changesCeoAiDesign) {
    reasons.push("CEO AIの設計変更を含む");
  }

  if (input.legalTriggerRequired) {
    reasons.push("法務・ポリシー改訂フローへの連携が必要");
  }

  return {
    required: reasons.length > 0,
    reasons,
  };
}

