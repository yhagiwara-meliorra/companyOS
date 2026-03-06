import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function createPendingApproval(params: {
  organizationId: string;
  threadId: string;
  decisionPacketId: string;
  reasons: string[];
  requestedBy?: string | null;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("approvals")
    .select("*")
    .eq("decision_packet_id", params.decisionPacketId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("approvals")
    .insert({
      organization_id: params.organizationId,
      thread_id: params.threadId,
      decision_packet_id: params.decisionPacketId,
      reasons: params.reasons,
      requested_by: params.requestedBy ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getApprovalByPacketId(packetId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("*")
    .eq("decision_packet_id", packetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listPendingApprovals() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("id, decision_packet_id, thread_id, reasons, requested_by, created_at, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function completeApproval(params: {
  approvalId: string;
  status: "approved" | "rejected";
  reviewComment?: string | null;
  editedPacketJson?: unknown;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("approvals")
    .update({
      status: params.status,
      review_comment: params.reviewComment ?? null,
      edited_packet_json: params.editedPacketJson ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", params.approvalId);

  if (error) throw error;
}
