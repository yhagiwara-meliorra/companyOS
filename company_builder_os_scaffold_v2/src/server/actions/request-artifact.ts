"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DecisionPacketSchema, type ArtifactType } from "../../domain/decision-packet.schema";
import { createArtifactRequestAndGenerate } from "../repositories/artifacts.repo";
import { getDecisionPacketById } from "../repositories/decision-packets.repo";
import { getThreadById } from "../repositories/threads.repo";

const RequestArtifactSchema = z.object({
  packetId: z.string().uuid(),
  artifactType: z.enum(["prd", "build_plan", "gtm_brief", "legal_change_request", "pricing_memo"]),
});

export async function requestArtifactAction(formData: FormData) {
  const parsed = RequestArtifactSchema.parse({
    packetId: formData.get("packetId"),
    artifactType: formData.get("artifactType") as ArtifactType,
  });

  const packetRow = await getDecisionPacketById(parsed.packetId);
  const thread = await getThreadById(packetRow.thread_id);
  const packet = DecisionPacketSchema.parse(packetRow.packet_json);

  const artifact = await createArtifactRequestAndGenerate({
    organizationId: thread.organization_id,
    threadId: thread.id,
    packetId: parsed.packetId,
    artifactType: parsed.artifactType,
    packet,
  });

  redirect(`/artifacts/${artifact.id}`);
}
