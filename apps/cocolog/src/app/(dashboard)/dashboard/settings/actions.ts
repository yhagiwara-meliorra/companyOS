"use server";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function updateAnalysisScope(formData: FormData) {
  const scope = formData.get("analysis_scope") as string;
  if (scope !== "all" && scope !== "members_only") return;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Verify user is owner/admin of their org
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string; role: string } | null };

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) return;

  // Update org settings (merge with existing)
  const db = createAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("settings")
    .eq("id", membership.org_id)
    .single();

  const currentSettings = (org?.settings as Record<string, unknown>) ?? {};

  await db
    .from("organizations")
    .update({ settings: { ...currentSettings, analysis_scope: scope } })
    .eq("id", membership.org_id);

  revalidatePath("/dashboard/settings");
}

export async function updateTimezone(formData: FormData) {
  const timezone = formData.get("timezone") as string;
  if (!timezone) return;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("user_settings")
    .update({ timezone })
    .eq("profile_id", user.id);

  revalidatePath("/dashboard/settings");
}

export async function updateContentStorage(formData: FormData) {
  const value = formData.get("store_message_content") as string;
  const enabled = value === "true";

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Verify user is owner/admin of their org
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string; role: string } | null };

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) return;

  // Update org settings (merge with existing)
  const db = createAdminClient();
  const { data: org } = await db
    .from("organizations")
    .select("settings")
    .eq("id", membership.org_id)
    .single();

  const currentSettings = (org?.settings as Record<string, unknown>) ?? {};

  await db
    .from("organizations")
    .update({ settings: { ...currentSettings, store_message_content: enabled } })
    .eq("id", membership.org_id);

  revalidatePath("/dashboard/settings");
}

export async function disconnectSlack(formData: FormData) {
  const installationId = formData.get("installation_id") as string;
  if (!installationId) return;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Verify user is owner/admin of their org
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("profile_id", user.id)
    .single() as { data: { org_id: string; role: string } | null };

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) return;

  const db = createAdminClient();

  // Look up installation to get connection_id
  const { data: installation } = await db
    .schema("integrations")
    .from("installations")
    .select("id, connection_id, provider_team_id")
    .eq("id", installationId)
    .single();

  if (!installation) return;

  // Verify connection belongs to user's org
  const { data: connection } = await db
    .schema("integrations")
    .from("connections")
    .select("id, org_id")
    .eq("id", installation.connection_id)
    .single();

  if (!connection || connection.org_id !== membership.org_id) return;

  // Revoke connection + installation
  await db
    .schema("integrations")
    .from("connections")
    .update({ status: "revoked" })
    .eq("id", connection.id);

  await db
    .schema("integrations")
    .from("installations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", installationId);

  // Audit log (best-effort)
  await db
    .schema("audit")
    .from("event_log")
    .insert({
      org_id: membership.org_id,
      actor_id: user.id,
      action: "slack.disconnected",
      resource_type: "integration",
      resource_id: connection.id,
      metadata: { team_id: installation.provider_team_id },
    })
    .then(
      () => {},
      (err) => console.error("Audit log failed:", err),
    );

  revalidatePath("/dashboard/settings");
}
