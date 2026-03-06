"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { runDecisionPacketForThread } from "../orchestrators/decision-graph.runtime";

const RunSchema = z.object({
  threadId: z.string().uuid(),
});

export async function runDecisionPacketAction(formData: FormData) {
  const parsed = RunSchema.parse({
    threadId: formData.get("threadId"),
  });

  const result = await runDecisionPacketForThread(parsed.threadId);

  if (result.status === "review_required") {
    redirect(`/decision-packets/${result.packetId}/review`);
  }

  redirect(`/decision-packets/${result.packetId}`);
}
