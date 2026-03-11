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
