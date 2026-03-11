import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyMessage } from "@/lib/anthropic/classify";
import { createSlackWebClient } from "@/lib/slack/client";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min for Vercel Pro

/**
 * Analyze pending messages that have a message_ref but no message_analysis.
 * Re-fetches message text from Slack via conversations.history,
 * classifies it, then stores the analysis.
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const BATCH_SIZE = 20;

  // Get recent message_refs
  const { data: recentRefs } = await db
    .schema("integrations")
    .from("message_refs")
    .select("id, connection_id, provider_message_id, provider_channel_id")
    .not("content_hash", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!recentRefs || recentRefs.length === 0) {
    return NextResponse.json({ message: "no pending analyses", analyzed: 0 });
  }

  // Check which ones already have analyses
  const refIds = recentRefs.map((r) => r.id);
  const { data: analyzed } = await db
    .schema("ai")
    .from("message_analyses")
    .select("message_ref_id")
    .in("message_ref_id", refIds);

  const analyzedSet = new Set((analyzed ?? []).map((a) => a.message_ref_id));
  const unanalyzedRefs = recentRefs
    .filter((r) => !analyzedSet.has(r.id))
    .slice(0, BATCH_SIZE);

  if (unanalyzedRefs.length === 0) {
    return NextResponse.json({ message: "no pending analyses", analyzed: 0 });
  }

  // Group by connection to batch Slack API calls
  const byConnection = new Map<string, typeof unanalyzedRefs>();
  for (const ref of unanalyzedRefs) {
    const list = byConnection.get(ref.connection_id) ?? [];
    list.push(ref);
    byConnection.set(ref.connection_id, list);
  }

  let analyzedCount = 0;
  let failed = 0;

  for (const [connectionId, connectionRefs] of byConnection) {
    // Get bot token for this connection
    const { data: installation } = await db
      .schema("integrations")
      .from("installations")
      .select("bot_token")
      .eq("connection_id", connectionId)
      .single();

    if (!installation) continue;

    const slack = createSlackWebClient(installation.bot_token);

    for (const ref of connectionRefs) {
      try {
        // Re-fetch message text from Slack
        const historyResult = await slack.conversations.history({
          channel: ref.provider_channel_id,
          latest: ref.provider_message_id,
          inclusive: true,
          limit: 1,
        });

        const message = historyResult.messages?.[0];
        if (!message?.text) {
          console.warn(`No text found for ref ${ref.id}`);
          failed++;
          continue;
        }

        // Classify (text is transient)
        await classifyMessage(message.text, ref.id);
        analyzedCount++;
      } catch (err) {
        console.error(`Failed to analyze ref ${ref.id}:`, err);
        failed++;
      }
    }
  }

  return NextResponse.json({
    message: "analyze-pending complete",
    analyzed: analyzedCount,
    failed,
    total: unanalyzedRefs.length,
  });
}
