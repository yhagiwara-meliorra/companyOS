"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { z } from "zod/v4";

export type ActionState = { error?: string; success?: boolean };

// ── Schemas ─────────────────────────────────────────────────

const AssessmentSchema = z.object({
  assessmentCycle: z.string().min(1, "Assessment cycle is required"),
  methodVersion: z.string().min(1, "Method version is required"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});

const DependencySchema = z.object({
  assessmentScopeId: z.string().uuid(),
  natureTopicId: z.string().uuid(),
  dependencyLevel: z.enum(["low", "medium", "high", "unknown"]).default("unknown"),
  rationale: z.string().optional(),
  sourceType: z.enum(["template", "manual", "model", "external_source"]).default("manual"),
});

const ImpactSchema = z.object({
  assessmentScopeId: z.string().uuid(),
  natureTopicId: z.string().uuid(),
  impactDirection: z.enum(["negative", "positive", "mixed", "unknown"]).default("unknown"),
  impactLevel: z.enum(["low", "medium", "high", "unknown"]).default("unknown"),
  rationale: z.string().optional(),
  sourceType: z.enum(["template", "manual", "model", "external_source"]).default("manual"),
});

const RiskSchema = z.object({
  assessmentScopeId: z.string().uuid(),
  riskType: z.enum(["physical", "transition", "systemic", "reputational", "legal", "market"]),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
});

const RiskScoreSchema = z.object({
  riskId: z.string().uuid(),
  severity: z.number().min(0).max(10),
  likelihood: z.number().min(0).max(10),
  velocity: z.number().min(0).max(10).optional(),
  detectability: z.number().min(0).max(10).optional(),
});

const DisclosureSchema = z.object({
  assessmentId: z.string().uuid(),
  framework: z.enum(["tnfd", "csrd", "internal"]),
  sectionKey: z.string().min(1, "Section key is required"),
  contentMd: z.string().default(""),
});

const MonitoringRuleSchema = z.object({
  targetType: z.enum(["site", "organization", "material", "relationship"]),
  targetId: z.string().uuid(),
  ruleType: z.enum(["source_refresh", "threshold", "missing_evidence", "review_due"]),
  config: z.record(z.string(), z.unknown()).default({}),
});

// ── Helpers ─────────────────────────────────────────────────

async function resolveWorkspace(slug: string) {
  const admin = createAdminClient();
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  return ws;
}

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ── Assessment CRUD ─────────────────────────────────────────

export async function createAssessment(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState & { assessmentId?: string }> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const ws = await resolveWorkspace(workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  const parsed = AssessmentSchema.safeParse({
    assessmentCycle: formData.get("assessmentCycle"),
    methodVersion: formData.get("methodVersion"),
    status: formData.get("status") || "draft",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assessments")
    .insert({
      workspace_id: ws.id,
      assessment_cycle: parsed.data.assessmentCycle,
      method_version: parsed.data.methodVersion,
      status: parsed.data.status,
      started_at: new Date().toISOString().slice(0, 10),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true, assessmentId: data.id };
}

export async function updateAssessmentStatus(
  workspaceSlug: string,
  assessmentId: string,
  status: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "archived") {
    updates.closed_at = new Date().toISOString().slice(0, 10);
  }

  const { error } = await admin
    .from("assessments")
    .update(updates)
    .eq("id", assessmentId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Assessment Scopes ───────────────────────────────────────

export async function addAssessmentScope(
  workspaceSlug: string,
  assessmentId: string,
  scopeType: string,
  targetId: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const payload: Record<string, unknown> = {
    assessment_id: assessmentId,
    scope_type: scopeType,
  };

  // Map scope_type to the correct FK column
  switch (scopeType) {
    case "organization":
      payload.workspace_organization_id = targetId;
      break;
    case "site":
      payload.workspace_site_id = targetId;
      break;
    case "material":
      payload.material_id = targetId;
      break;
    case "relationship":
      payload.relationship_id = targetId;
      break;
    default:
      return { error: "Invalid scope type" };
  }

  const { error } = await admin.from("assessment_scopes").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Dependencies ────────────────────────────────────────────

export async function addDependency(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const parsed = DependencySchema.safeParse({
    assessmentScopeId: formData.get("assessmentScopeId"),
    natureTopicId: formData.get("natureTopicId"),
    dependencyLevel: formData.get("dependencyLevel") || "unknown",
    rationale: formData.get("rationale") || undefined,
    sourceType: formData.get("sourceType") || "manual",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("dependencies").insert({
    assessment_scope_id: parsed.data.assessmentScopeId,
    nature_topic_id: parsed.data.natureTopicId,
    dependency_level: parsed.data.dependencyLevel,
    rationale: parsed.data.rationale
      ? { text: parsed.data.rationale }
      : {},
    source_type: parsed.data.sourceType,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

export async function updateDependencyLevel(
  workspaceSlug: string,
  dependencyId: string,
  level: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("dependencies")
    .update({ dependency_level: level })
    .eq("id", dependencyId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Impacts ─────────────────────────────────────────────────

export async function addImpact(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const parsed = ImpactSchema.safeParse({
    assessmentScopeId: formData.get("assessmentScopeId"),
    natureTopicId: formData.get("natureTopicId"),
    impactDirection: formData.get("impactDirection") || "unknown",
    impactLevel: formData.get("impactLevel") || "unknown",
    rationale: formData.get("rationale") || undefined,
    sourceType: formData.get("sourceType") || "manual",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("impacts").insert({
    assessment_scope_id: parsed.data.assessmentScopeId,
    nature_topic_id: parsed.data.natureTopicId,
    impact_direction: parsed.data.impactDirection,
    impact_level: parsed.data.impactLevel,
    rationale: parsed.data.rationale
      ? { text: parsed.data.rationale }
      : {},
    source_type: parsed.data.sourceType,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

export async function updateImpactLevel(
  workspaceSlug: string,
  impactId: string,
  level: string,
  direction: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("impacts")
    .update({ impact_level: level, impact_direction: direction })
    .eq("id", impactId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Risk Register ───────────────────────────────────────────

export async function addRisk(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState & { riskId?: string }> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const parsed = RiskSchema.safeParse({
    assessmentScopeId: formData.get("assessmentScopeId"),
    riskType: formData.get("riskType"),
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("risk_register")
    .insert({
      assessment_scope_id: parsed.data.assessmentScopeId,
      risk_type: parsed.data.riskType,
      title: parsed.data.title,
      description: parsed.data.description,
      owner_user_id: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true, riskId: data.id };
}

export async function updateRiskStatus(
  workspaceSlug: string,
  riskId: string,
  status: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("risk_register")
    .update({ status })
    .eq("id", riskId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Risk Scores ─────────────────────────────────────────────

export async function scoreRisk(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const parsed = RiskScoreSchema.safeParse({
    riskId: formData.get("riskId"),
    severity: Number(formData.get("severity")),
    likelihood: Number(formData.get("likelihood")),
    velocity: formData.get("velocity") ? Number(formData.get("velocity")) : undefined,
    detectability: formData.get("detectability")
      ? Number(formData.get("detectability"))
      : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("risk_scores").insert({
    risk_id: parsed.data.riskId,
    severity: parsed.data.severity,
    likelihood: parsed.data.likelihood,
    velocity: parsed.data.velocity ?? null,
    detectability: parsed.data.detectability ?? null,
    score_components: {
      severity: parsed.data.severity,
      likelihood: parsed.data.likelihood,
      velocity: parsed.data.velocity,
      detectability: parsed.data.detectability,
    },
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Disclosures ─────────────────────────────────────────────

export async function createDisclosure(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const ws = await resolveWorkspace(workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  const parsed = DisclosureSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    framework: formData.get("framework"),
    sectionKey: formData.get("sectionKey"),
    contentMd: formData.get("contentMd") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("disclosures").insert({
    workspace_id: ws.id,
    assessment_id: parsed.data.assessmentId,
    framework: parsed.data.framework,
    section_key: parsed.data.sectionKey,
    content_md: parsed.data.contentMd,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

export async function updateDisclosure(
  workspaceSlug: string,
  disclosureId: string,
  contentMd: string,
  status?: string
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const updates: Record<string, unknown> = { content_md: contentMd };
  if (status) updates.status = status;

  const { error } = await admin
    .from("disclosures")
    .update(updates)
    .eq("id", disclosureId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Monitoring Rules ────────────────────────────────────────

export async function createMonitoringRule(
  workspaceSlug: string,
  formData: FormData
): Promise<ActionState> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const ws = await resolveWorkspace(workspaceSlug);
  if (!ws) return { error: "Workspace not found" };

  const parsed = MonitoringRuleSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    ruleType: formData.get("ruleType"),
    config: {},
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("monitoring_rules").insert({
    workspace_id: ws.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    rule_type: parsed.data.ruleType,
    config: parsed.data.config,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true };
}

// ── Apply Manufacturing Templates ───────────────────────────
// Applies pre-defined dependency/impact hypotheses for manufacturing.
// Structured as a function that can later be replaced by DB-backed templates.

type ManufacturingTemplate = {
  topicKey: string;
  dependency: "low" | "medium" | "high";
  impactDirection: "negative" | "positive" | "mixed";
  impactLevel: "low" | "medium" | "high";
};

const MANUFACTURING_TEMPLATES: ManufacturingTemplate[] = [
  { topicKey: "water_extraction", dependency: "high", impactDirection: "negative", impactLevel: "high" },
  { topicKey: "water_pollution", dependency: "medium", impactDirection: "negative", impactLevel: "high" },
  { topicKey: "land_use_change", dependency: "medium", impactDirection: "negative", impactLevel: "medium" },
  { topicKey: "ghg_emissions", dependency: "high", impactDirection: "negative", impactLevel: "high" },
  { topicKey: "air_pollution", dependency: "low", impactDirection: "negative", impactLevel: "medium" },
  { topicKey: "solid_waste", dependency: "low", impactDirection: "negative", impactLevel: "medium" },
  { topicKey: "chemical_contamination", dependency: "medium", impactDirection: "negative", impactLevel: "high" },
  { topicKey: "species_decline", dependency: "low", impactDirection: "negative", impactLevel: "medium" },
  { topicKey: "soil_degradation", dependency: "medium", impactDirection: "negative", impactLevel: "medium" },
  { topicKey: "carbon_sequestration", dependency: "medium", impactDirection: "negative", impactLevel: "medium" },
];

export async function applyManufacturingTemplate(
  workspaceSlug: string,
  assessmentScopeId: string
): Promise<ActionState & { count?: number }> {
  const user = await requireAuth();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Fetch nature_topics to map keys to IDs
  const { data: topics } = await admin
    .from("nature_topics")
    .select("id, topic_key");

  if (!topics || topics.length === 0) {
    return { error: "No nature topics found. Run seed migration first." };
  }

  const topicMap = new Map(topics.map((t) => [t.topic_key, t.id]));
  let inserted = 0;

  for (const tmpl of MANUFACTURING_TEMPLATES) {
    const topicId = topicMap.get(tmpl.topicKey);
    if (!topicId) continue;

    // Insert dependency
    await admin.from("dependencies").insert({
      assessment_scope_id: assessmentScopeId,
      nature_topic_id: topicId,
      dependency_level: tmpl.dependency,
      rationale: { text: `Manufacturing template: ${tmpl.topicKey}` },
      source_type: "template",
    });

    // Insert impact
    await admin.from("impacts").insert({
      assessment_scope_id: assessmentScopeId,
      nature_topic_id: topicId,
      impact_direction: tmpl.impactDirection,
      impact_level: tmpl.impactLevel,
      rationale: { text: `Manufacturing template: ${tmpl.topicKey}` },
      source_type: "template",
    });

    inserted++;
  }

  revalidatePath(`/app/${workspaceSlug}/leap`);
  return { success: true, count: inserted };
}
