import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDigest } from "@/lib/anthropic/digest";
import { sendSlackDM, buildDigestDMPayload } from "@/lib/slack/dm";
import type { WeeklySignalInput } from "@/lib/anthropic/prompts";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min for Vercel Pro

/**
 * Weekly digest cron job.
 * Generates coaching digests from person_weekly_metrics for each person,
 * stores in ai.coaching_runs + public.weekly_digests,
 * and optionally sends Slack DMs.
 * Protected by CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Calculate the start of last week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - dayOfWeek - 6);
  const weekStart = lastMonday.toISOString().split("T")[0];

  // Get active taxonomy for signal labels
  const { data: taxonomy } = await db
    .schema("ai")
    .from("taxonomy_versions")
    .select("id, signal_definitions")
    .eq("is_active", true)
    .single();

  if (!taxonomy) {
    return NextResponse.json({ error: "no active taxonomy" }, { status: 400 });
  }

  const signalDefs = taxonomy.signal_definitions as Record<
    string,
    { label: string }
  >;

  // Get person weekly metrics for last week
  const { data: metrics } = await db
    .schema("analytics")
    .from("person_weekly_metrics")
    .select("id, org_id, person_id, metrics, message_count, prev_week_metrics")
    .eq("week_start", weekStart);

  if (!metrics || metrics.length === 0) {
    return NextResponse.json({ message: "no metrics for digest", weekStart });
  }

  // Fetch people names
  const personIds = [...new Set(metrics.map((m) => m.person_id))];
  const { data: people } = await db
    .from("people")
    .select("id, display_name")
    .in("id", personIds);

  const nameMap = new Map(
    (people ?? []).map((p) => [p.id, p.display_name]),
  );

  // Build per-person input
  const byPerson = new Map<
    string,
    {
      org_id: string;
      person_id: string;
      person_name: string;
      signals: WeeklySignalInput[];
      totalMessages: number;
    }
  >();

  for (const row of metrics) {
    const personName = nameMap.get(row.person_id) ?? "不明";
    const metricsData = row.metrics as Record<
      string,
      { avg: number; count: number }
    >;
    const prevMetrics = row.prev_week_metrics as Record<
      string,
      { avg: number }
    > | null;

    const signals: WeeklySignalInput[] = Object.entries(metricsData).map(
      ([key, val]) => {
        let trend: "up" | "down" | "stable" = "stable";
        if (prevMetrics?.[key]) {
          const delta = val.avg - prevMetrics[key].avg;
          if (delta > 0.05) trend = "up";
          else if (delta < -0.05) trend = "down";
        }

        return {
          signal_key: key,
          signal_label: signalDefs[key]?.label ?? key,
          avg_value: val.avg,
          message_count: val.count,
          trend,
        };
      },
    );

    byPerson.set(row.person_id, {
      org_id: row.org_id,
      person_id: row.person_id,
      person_name: personName,
      signals,
      totalMessages: row.message_count,
    });
  }

  // Generate digests for each person
  let generated = 0;
  let dmsSent = 0;

  for (const entry of byPerson.values()) {
    // Create coaching_run as "running"
    const { data: run } = await db
      .schema("ai")
      .from("coaching_runs")
      .insert({
        org_id: entry.org_id,
        person_id: entry.person_id,
        model_version_id: "00000000-0000-0000-0000-000000000000", // placeholder, updated on completion
        week_start: weekStart,
        status: "running",
        input_summary: JSON.parse(JSON.stringify({ signals: entry.signals })),
      })
      .select("id")
      .single();

    if (!run) continue;

    try {
      const { digest, modelVersionId, latencyMs } = await generateDigest(
        entry.person_name,
        weekStart,
        entry.signals,
        entry.totalMessages,
      );

      // Update coaching_run to completed
      await db
        .schema("ai")
        .from("coaching_runs")
        .update({
          model_version_id: modelVersionId,
          status: "completed",
          output_markdown: digest.markdown,
          highlights: JSON.parse(JSON.stringify(digest.highlights)),
          latency_ms: latencyMs,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);

      // Upsert user-facing weekly digest
      await db.from("weekly_digests").upsert(
        {
          org_id: entry.org_id,
          person_id: entry.person_id,
          week_start: weekStart,
          coaching_run_id: run.id,
          digest_markdown: digest.markdown,
          highlights: JSON.parse(JSON.stringify(digest.highlights)),
        },
        { onConflict: "org_id,person_id,week_start" },
      );

      generated++;

      // Send Slack DM (best effort)
      try {
        const sent = await trySendDigestDM(
          db,
          entry.person_id,
          entry.person_name,
          weekStart,
          digest.markdown,
          appUrl,
        );
        if (sent) dmsSent++;
      } catch (dmErr) {
        console.error(`DM send failed for ${entry.person_id}:`, dmErr);
      }
    } catch (err) {
      // Mark coaching_run as failed
      await db
        .schema("ai")
        .from("coaching_runs")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq("id", run.id);

      console.error(
        `Failed to generate digest for ${entry.person_id}:`,
        err,
      );
    }
  }

  return NextResponse.json({
    message: "weekly digest complete",
    weekStart,
    generated,
    dmsSent,
    total: byPerson.size,
  });
}

/**
 * Send a digest DM to the person's linked Slack account.
 * Returns true if sent successfully.
 */
async function trySendDigestDM(
  db: ReturnType<typeof createAdminClient>,
  personId: string,
  personName: string,
  weekStart: string,
  digestMarkdown: string,
  appUrl: string,
): Promise<boolean> {
  // Find the person's Slack identity
  const { data: link } = await db
    .from("identity_links")
    .select("provider_user_id, provider_team_id")
    .eq("person_id", personId)
    .eq("provider", "slack")
    .single();

  if (!link) return false;

  // Find the bot token for this team
  const { data: installation } = await db
    .schema("integrations")
    .from("installations")
    .select("bot_token")
    .eq("provider_team_id", link.provider_team_id)
    .single();

  if (!installation) return false;

  const { text, blocks } = buildDigestDMPayload(
    personName,
    weekStart,
    digestMarkdown,
    `${appUrl}/dashboard/digests`,
  );

  await sendSlackDM(installation.bot_token, link.provider_user_id, text, {
    blocks,
  });

  return true;
}
