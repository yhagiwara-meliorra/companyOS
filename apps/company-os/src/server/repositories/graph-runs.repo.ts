import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function createGraphRun(threadId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("graph_runs")
    .insert({ thread_id: threadId, run_status: "running" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function finishGraphRun(graphRunId: string, params: { status: "waiting_human" | "completed" | "failed"; errorMessage?: string | null; decisionPacketId?: string | null }) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("graph_runs")
    .update({
      run_status: params.status,
      decision_packet_id: params.decisionPacketId ?? null,
      error_message: params.errorMessage ?? null,
      ended_at: new Date().toISOString(),
    })
    .eq("id", graphRunId);
  if (error) throw error;
}
