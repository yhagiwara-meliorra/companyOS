import { interrupt } from "@langchain/langgraph";
import type { DecisionPacket } from "../../../decision-schema/src/decision-packet.schema";

export type DecisionPacketReviewResume =
  | { approved: true; editedPacket?: DecisionPacket }
  | { approved: false; reason: string };

export function requestDecisionPacketReview(params: {
  threadId: string;
  title: string;
  packet: DecisionPacket;
  reasons: string[];
}): DecisionPacketReviewResume {
  return interrupt({
    kind: "decision_packet_review",
    threadId: params.threadId,
    title: params.title,
    packet: params.packet,
    reasons: params.reasons,
  }) as DecisionPacketReviewResume;
}

