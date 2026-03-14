import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { sendAlertEmail, type AlertEmailPayload } from "@/lib/notifications/email";
import { ADMIN_ROLES } from "@/lib/auth/roles";

// Vercel Cron calls this endpoint on schedule.
// Authorization: CRON_SECRET header must match env var.

export const runtime = "nodejs";
export const maxDuration = 60; // allow up to 60s for batch processing

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results = {
    staleEvidence: 0,
    sourceRefresh: 0,
    riskRecompute: 0,
    benchmarkChange: 0,
    eudrRiskReview: 0,
    errors: [] as string[],
  };

  // ────────────────────────────────────────────────────────
  // 1. Stale Evidence Check
  // Rules with rule_type = 'missing_evidence'
  // Finds evidence items not updated in 90+ days
  // ────────────────────────────────────────────────────────
  try {
    const { data: evidenceRules } = await admin
      .from("monitoring_rules")
      .select("*")
      .eq("rule_type", "missing_evidence")
      .eq("is_active", true);

    for (const rule of evidenceRules ?? []) {
      const staleDays = (rule.config as Record<string, number>)?.stale_days ?? 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - staleDays);

      // Check if target has any non-deleted evidence updated after cutoff
      const { data: freshEvidence } = await admin
        .from("evidence_items")
        .select("id")
        .eq("workspace_id", rule.workspace_id)
        .is("deleted_at", null)
        .gte("updated_at", cutoff.toISOString())
        .limit(1);

      if (!freshEvidence || freshEvidence.length === 0) {
        // Check if we already have an open event for this rule
        const { data: existing } = await admin
          .from("monitoring_events")
          .select("id")
          .eq("monitoring_rule_id", rule.id)
          .eq("status", "open")
          .limit(1);

        if (!existing || existing.length === 0) {
          await admin.from("monitoring_events").insert({
            monitoring_rule_id: rule.id,
            status: "open",
            severity: "warning",
            title: `Evidence stale: no updates in ${staleDays} days`,
            payload: {
              target_type: rule.target_type,
              target_id: rule.target_id,
              stale_days: staleDays,
              checked_at: new Date().toISOString(),
            },
          });
          results.staleEvidence++;
        }
      }

      // Update last_run_at
      await admin
        .from("monitoring_rules")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", rule.id);
    }
  } catch (e) {
    results.errors.push(`staleEvidence: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ────────────────────────────────────────────────────────
  // 2. Source Refresh Check
  // Rules with rule_type = 'source_refresh'
  // Checks source_versions.loaded_at for data freshness
  // (data_sources is a global table; target_id references a data_source_id)
  // ────────────────────────────────────────────────────────
  try {
    const { data: refreshRules } = await admin
      .from("monitoring_rules")
      .select("*")
      .eq("rule_type", "source_refresh")
      .eq("is_active", true);

    for (const rule of refreshRules ?? []) {
      const maxAgeDays = (rule.config as Record<string, number>)?.max_age_days ?? 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - maxAgeDays);

      // target_id references a data_source_id
      const dataSourceId = rule.target_id;
      if (!dataSourceId) continue;

      // Get the data source name
      const { data: dataSource } = await admin
        .from("data_sources")
        .select("id, source_name")
        .eq("id", dataSourceId)
        .single();

      if (!dataSource) continue;

      // Check freshness via the latest source_versions.loaded_at
      const { data: latestVersion } = await admin
        .from("source_versions")
        .select("loaded_at")
        .eq("data_source_id", dataSourceId)
        .order("loaded_at", { ascending: false })
        .limit(1);

      const lastLoaded = latestVersion?.[0]?.loaded_at;
      const isStale = !lastLoaded || new Date(lastLoaded) < cutoff;

      if (isStale) {
        // Check if we already have an open event
        const { data: existing } = await admin
          .from("monitoring_events")
          .select("id")
          .eq("monitoring_rule_id", rule.id)
          .eq("status", "open")
          .limit(1);

        if (!existing || existing.length === 0) {
          await admin.from("monitoring_events").insert({
            monitoring_rule_id: rule.id,
            status: "open",
            severity: "info",
            title: `Data source "${dataSource.source_name}" needs refresh`,
            payload: {
              data_source_id: dataSource.id,
              source_name: dataSource.source_name,
              last_loaded_at: lastLoaded ?? null,
              max_age_days: maxAgeDays,
              checked_at: new Date().toISOString(),
            },
          });
          results.sourceRefresh++;
        }
      }

      await admin
        .from("monitoring_rules")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", rule.id);
    }
  } catch (e) {
    results.errors.push(`sourceRefresh: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ────────────────────────────────────────────────────────
  // 3. Risk Recompute Check
  // Rules with rule_type = 'review_due'
  // Flags risks that haven't been scored recently
  // ────────────────────────────────────────────────────────
  try {
    const { data: reviewRules } = await admin
      .from("monitoring_rules")
      .select("*")
      .eq("rule_type", "review_due")
      .eq("is_active", true);

    for (const rule of reviewRules ?? []) {
      const reviewDays = (rule.config as Record<string, number>)?.review_days ?? 60;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - reviewDays);

      // Find risks in this workspace that haven't been scored since cutoff
      const { data: risks } = await admin
        .from("risk_register")
        .select(`
          id, title,
          assessment_scopes!inner (
            assessments!inner (
              workspace_id
            )
          )
        `)
        .eq("status", "open");

      const workspaceRisks = (risks ?? []).filter((r) => {
        const scope = r.assessment_scopes as unknown as {
          assessments: { workspace_id: string };
        };
        return scope?.assessments?.workspace_id === rule.workspace_id;
      });

      for (const risk of workspaceRisks) {
        // Get latest score
        const { data: latestScore } = await admin
          .from("risk_scores")
          .select("scored_at")
          .eq("risk_id", risk.id)
          .order("scored_at", { ascending: false })
          .limit(1);

        const lastScored = latestScore?.[0]?.scored_at;
        const needsReview =
          !lastScored || new Date(lastScored) < cutoff;

        if (needsReview) {
          const { data: existing } = await admin
            .from("monitoring_events")
            .select("id")
            .eq("monitoring_rule_id", rule.id)
            .eq("status", "open")
            .limit(1);

          if (!existing || existing.length === 0) {
            await admin.from("monitoring_events").insert({
              monitoring_rule_id: rule.id,
              status: "open",
              severity: lastScored ? "info" : "warning",
              title: `Risk "${risk.title}" needs review`,
              payload: {
                risk_id: risk.id,
                risk_title: risk.title,
                last_scored: lastScored ?? null,
                review_days: reviewDays,
                checked_at: new Date().toISOString(),
              },
            });
            results.riskRecompute++;
          }
        }
      }

      await admin
        .from("monitoring_rules")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", rule.id);
    }
  } catch (e) {
    results.errors.push(`riskRecompute: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ────────────────────────────────────────────────────────
  // 4. Threshold Alerts
  // Rules with rule_type = 'threshold'
  // Checks risk scores against configured thresholds
  // ────────────────────────────────────────────────────────
  try {
    const { data: thresholdRules } = await admin
      .from("monitoring_rules")
      .select("*")
      .eq("rule_type", "threshold")
      .eq("is_active", true);

    for (const rule of thresholdRules ?? []) {
      const threshold = (rule.config as Record<string, number>)?.threshold ?? 50;

      // Find risks with scores above threshold
      const { data: highScores } = await admin
        .from("risk_scores")
        .select(`
          id, final_score, risk_id,
          risk_register!inner (
            title,
            assessment_scopes!inner (
              assessments!inner (
                workspace_id
              )
            )
          )
        `)
        .gte("final_score", threshold);

      const workspaceScores = (highScores ?? []).filter((s) => {
        const risk = s.risk_register as unknown as {
          assessment_scopes: {
            assessments: { workspace_id: string };
          };
        };
        return risk?.assessment_scopes?.assessments?.workspace_id === rule.workspace_id;
      });

      for (const score of workspaceScores) {
        const riskInfo = score.risk_register as unknown as { title: string };

        const { data: existing } = await admin
          .from("monitoring_events")
          .select("id")
          .eq("monitoring_rule_id", rule.id)
          .eq("status", "open")
          .limit(1);

        if (!existing || existing.length === 0) {
          await admin.from("monitoring_events").insert({
            monitoring_rule_id: rule.id,
            status: "open",
            severity: score.final_score >= 75 ? "critical" : "warning",
            title: `Risk "${riskInfo.title}" exceeds threshold (${score.final_score.toFixed(1)} ≥ ${threshold})`,
            payload: {
              risk_id: score.risk_id,
              final_score: score.final_score,
              threshold,
              checked_at: new Date().toISOString(),
            },
          });
        }
      }

      await admin
        .from("monitoring_rules")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", rule.id);
    }
  } catch (e) {
    results.errors.push(`threshold: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ────────────────────────────────────────────────────────
  // 5. EUDR Country Benchmark Change Detection
  // Rules with rule_type = 'benchmark_change'
  // Checks if eudr_country_benchmarks have been updated
  // since the rule's last_run_at.
  // ────────────────────────────────────────────────────────
  try {
    const { data: benchmarkRules } = await admin
      .from("monitoring_rules")
      .select("*")
      .eq("rule_type", "benchmark_change")
      .eq("is_active", true);

    for (const rule of benchmarkRules ?? []) {
      // Config may specify watched country codes or commodity types
      const config = rule.config as Record<string, unknown>;
      const watchCountries = config.country_codes as string[] | undefined;

      // Check for benchmarks updated since last run
      const lastRun = rule.last_run_at ?? rule.created_at;
      let query = admin
        .from("eudr_country_benchmarks")
        .select("id, country_code, country_name, risk_tier, updated_at")
        .gte("updated_at", lastRun);

      if (watchCountries && watchCountries.length > 0) {
        query = query.in("country_code", watchCountries);
      }

      const { data: changedBenchmarks } = await query;

      if (changedBenchmarks && changedBenchmarks.length > 0) {
        // Check for existing open event
        const { data: existing } = await admin
          .from("monitoring_events")
          .select("id")
          .eq("monitoring_rule_id", rule.id)
          .eq("status", "open")
          .limit(1);

        if (!existing || existing.length === 0) {
          const countries = changedBenchmarks
            .map((b) => `${b.country_name} (${b.country_code}: ${b.risk_tier})`)
            .join(", ");

          await admin.from("monitoring_events").insert({
            monitoring_rule_id: rule.id,
            status: "open",
            severity: changedBenchmarks.some((b) => b.risk_tier === "high")
              ? "critical"
              : "warning",
            title: `EUDR 国ベンチマーク変更: ${changedBenchmarks.length}件`,
            payload: {
              changed_countries: changedBenchmarks.map((b) => ({
                country_code: b.country_code,
                country_name: b.country_name,
                new_risk_tier: b.risk_tier,
                updated_at: b.updated_at,
              })),
              summary: countries,
              checked_at: new Date().toISOString(),
            },
          });
          results.benchmarkChange++;
        }
      }

      await admin
        .from("monitoring_rules")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", rule.id);
    }
  } catch (e) {
    results.errors.push(
      `benchmarkChange: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // ────────────────────────────────────────────────────────
  // 6. EUDR Risk Assessment Review
  // Rules with rule_type = 'eudr_risk_review'
  // Flags EUDR risk assessments not updated in N days
  // ────────────────────────────────────────────────────────
  try {
    const { data: eudrReviewRules } = await admin
      .from("monitoring_rules")
      .select("*")
      .eq("rule_type", "eudr_risk_review")
      .eq("is_active", true);

    for (const rule of eudrReviewRules ?? []) {
      const reviewDays =
        (rule.config as Record<string, number>)?.review_days ?? 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - reviewDays);

      // Find EUDR risk assessments in this workspace that are stale
      const { data: staleAssessments } = await admin
        .from("eudr_risk_assessments")
        .select(
          "id, dds_id, overall_result, assessed_at, eudr_dds_statements!inner ( internal_reference )"
        )
        .eq("workspace_id", rule.workspace_id)
        .or(`assessed_at.is.null,assessed_at.lt.${cutoff.toISOString()}`);

      for (const assessment of staleAssessments ?? []) {
        const dds = assessment.eudr_dds_statements as unknown as {
          internal_reference: string;
        };

        const { data: existing } = await admin
          .from("monitoring_events")
          .select("id")
          .eq("monitoring_rule_id", rule.id)
          .eq("status", "open")
          .limit(1);

        if (!existing || existing.length === 0) {
          await admin.from("monitoring_events").insert({
            monitoring_rule_id: rule.id,
            status: "open",
            severity:
              assessment.overall_result === "non_negligible"
                ? "critical"
                : "warning",
            title: `EUDR リスク評価 "${dds.internal_reference}" 要レビュー`,
            payload: {
              assessment_id: assessment.id,
              dds_id: assessment.dds_id,
              internal_reference: dds.internal_reference,
              overall_result: assessment.overall_result,
              last_assessed: assessment.assessed_at,
              review_days: reviewDays,
              checked_at: new Date().toISOString(),
            },
          });
          results.eudrRiskReview++;
        }
      }

      await admin
        .from("monitoring_rules")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", rule.id);
    }
  } catch (e) {
    results.errors.push(
      `eudrRiskReview: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // ────────────────────────────────────────────────────────
  // 7. Email Notification Digest
  // If any new events were created, send digest emails to
  // workspace members with admin/owner roles.
  // ────────────────────────────────────────────────────────
  const totalNewEvents =
    results.staleEvidence +
    results.sourceRefresh +
    results.riskRecompute +
    results.benchmarkChange +
    results.eudrRiskReview;
  let emailsSent = 0;

  if (totalNewEvents > 0) {
    try {
      // Get newly created open events (created in this run)
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentEvents } = await admin
        .from("monitoring_events")
        .select(
          "id, title, severity, created_at, monitoring_rule_id, monitoring_rules ( workspace_id, rule_type )"
        )
        .eq("status", "open")
        .gte("created_at", fiveMinAgo);

      // Group events by workspace
      const eventsByWorkspace = new Map<
        string,
        { title: string; severity: string; ruleType: string; triggeredAt: string }[]
      >();

      for (const ev of recentEvents ?? []) {
        const rule = ev.monitoring_rules as unknown as {
          workspace_id: string;
          rule_type: string;
        };
        if (!rule?.workspace_id) continue;

        const list = eventsByWorkspace.get(rule.workspace_id) ?? [];
        list.push({
          title: ev.title,
          severity: ev.severity,
          ruleType: rule.rule_type,
          triggeredAt: ev.created_at,
        });
        eventsByWorkspace.set(rule.workspace_id, list);
      }

      // Send digest to each workspace's admins/owners
      for (const [workspaceId, events] of eventsByWorkspace) {
        // Get workspace info
        const { data: ws } = await admin
          .from("workspaces")
          .select("name, slug")
          .eq("id", workspaceId)
          .single();

        if (!ws) continue;

        // Get admin/owner members
        const { data: members } = await admin
          .from("workspace_members")
          .select("user_id, role, profiles ( full_name )")
          .eq("workspace_id", workspaceId)
          .in("role", [...ADMIN_ROLES])
          .eq("status", "active");

        for (const member of members ?? []) {
          // Get user email from auth
          const { data: authUser } = await admin.auth.admin.getUserById(
            member.user_id
          );
          if (!authUser?.user?.email) continue;

          const profile = member.profiles as unknown as {
            full_name: string | null;
          };

          const payload: AlertEmailPayload = {
            to: authUser.user.email,
            recipientName: profile?.full_name ?? "ユーザー",
            workspaceName: ws.name,
            workspaceSlug: ws.slug,
            events,
          };

          const emailResult = await sendAlertEmail(payload);
          if (emailResult.success) emailsSent++;
          if (emailResult.error) {
            results.errors.push(`email: ${emailResult.error}`);
          }
        }
      }
    } catch (e) {
      results.errors.push(
        `emailDigest: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
    emailsSent,
  });
}
