import { END } from "@langchain/langgraph";

export function afterApprovalRouter(state: { runStatus: "running" | "waiting_human" | "completed" | "failed" }) {
  if (state.runStatus === "failed") {
    return END;
  }
  return "persistDecisionPacket" as const;
}

