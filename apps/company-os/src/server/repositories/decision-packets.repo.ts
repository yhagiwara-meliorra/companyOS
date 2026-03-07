import type { DecisionPacket } from "../../domain/decision-packet.schema";
import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function upsertDecisionPacket(packet: DecisionPacket, organizationId: string) {
  const supabase = await createServerSupabaseClient();

  const payload = {
    id: packet.metadata.id,
    thread_id: packet.metadata.threadId,
    organization_id: organizationId,
    version: packet.metadata.version,
    status: packet.metadata.status,
    title: packet.metadata.title,
    summary: packet.metadata.summary,
    packet_json: packet,
    constitution_decision: packet.constitutionFit.constitutionDecision,
    approval_required: packet.approval.approvalRequired,
    approval_reasons: packet.approval.approvalReasons,
    estimated_cost_impact_jpy: packet.approval.estimatedCostImpactJPY,
    changes_ceo_ai_design: packet.approval.changesCeoAiDesign,
    legal_trigger_required: packet.riskLegal.legalTriggerRequired,
    final_decision: packet.approval.finalDecision,
    created_by: packet.metadata.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("decision_packets")
    .upsert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getDecisionPacketById(packetId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("decision_packets")
    .select("*")
    .eq("id", packetId)
    .single();

  if (error) throw error;
  return data;
}

export async function listArtifactsForPacket(packetId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("id, artifact_type, title, status, created_at, updated_at")
    .eq("decision_packet_id", packetId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function setPacketStatus(packetId: string, status: "approved" | "rejected" | "review_required" | "draft") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("decision_packets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", packetId);
  if (error) throw error;
}
