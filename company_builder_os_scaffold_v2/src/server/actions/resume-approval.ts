"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { completeApproval } from "../repositories/approvals.repo";
import { setPacketStatus } from "../repositories/decision-packets.repo";
import { resumeDecisionPacketReview } from "../orchestrators/decision-graph.runtime";

const ResumeSchema = z.object({
  packetId: z.string().uuid(),
  approvalId: z.string().uuid(),
  reviewAction: z.enum(["approve", "reject", "edit"]),
  reviewComment: z.string().optional().nullable(),
  editedPacketJson: z.string().optional().nullable(),
});

export async function resumeApprovalAction(formData: FormData) {
  const parsed = ResumeSchema.parse({
    packetId: formData.get("packetId"),
    approvalId: formData.get("approvalId"),
    reviewAction: formData.get("reviewAction"),
    reviewComment: formData.get("reviewComment"),
    editedPacketJson: formData.get("editedPacketJson"),
  });

  const result = await resumeDecisionPacketReview(parsed);

  await completeApproval({
    approvalId: parsed.approvalId,
    status: parsed.reviewAction === "reject" ? "rejected" : "approved",
    reviewComment: parsed.reviewComment,
    editedPacketJson: parsed.reviewAction === "edit" && parsed.editedPacketJson
      ? JSON.parse(parsed.editedPacketJson)
      : undefined,
  });

  await setPacketStatus(parsed.packetId, result.status === "rejected" ? "rejected" : "approved");

  redirect(`/decision-packets/${result.packetId}`);
}
