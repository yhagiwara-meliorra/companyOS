import { createServerSupabaseClient } from "../../lib/supabase/server";
import type { ThreadType } from "../../domain/decision-packet.schema";

export interface CreateThreadInput {
  organizationId: string;
  createdBy?: string | null;
  title: string;
  threadType: ThreadType;
  rawUserInput: string;
  constitutionText: string;
}

export async function createThread(input: CreateThreadInput) {
  const supabase = await createServerSupabaseClient();
  const threadId = crypto.randomUUID();

  const { data: thread, error } = await supabase
    .from("threads")
    .insert({
      id: threadId,
      organization_id: input.organizationId,
      created_by: input.createdBy ?? null,
      thread_type: input.threadType,
      status: "open",
      title: input.title,
      raw_user_input: input.rawUserInput,
      constitution_snapshot: input.constitutionText,
      last_message_at: new Date().toISOString(),
      langgraph_thread_id: threadId,
    })
    .select("id, organization_id, title, thread_type, status, langgraph_thread_id, constitution_snapshot, raw_user_input, created_by, created_at")
    .single();

  if (error) throw error;

  const { error: messageError } = await supabase.from("thread_messages").insert({
    thread_id: threadId,
    role: "user",
    actor_name: "CEO",
    content: input.rawUserInput,
    metadata: { source: "thread_create" },
  });

  if (messageError) throw messageError;
  return thread;
}

export async function getThreadById(threadId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("id", threadId)
    .single();

  if (error) throw error;
  return data;
}

export async function getThreadMessages(threadId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("thread_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addAssistantMessage(threadId: string, content: string, actorName = "AI CEO") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("thread_messages").insert({
    thread_id: threadId,
    role: "assistant",
    actor_name: actorName,
    content,
    metadata: { source: "graph" },
  });
  if (error) throw error;
}

export async function setThreadStatus(threadId: string, status: "open" | "in_review" | "approved" | "rejected") {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("threads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", threadId);
  if (error) throw error;
}

export async function getLatestPacketForThread(threadId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("decision_packets")
    .select("id, status, summary, created_at, updated_at")
    .eq("thread_id", threadId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLatestGraphRun(threadId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("graph_runs")
    .select("*")
    .eq("thread_id", threadId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
