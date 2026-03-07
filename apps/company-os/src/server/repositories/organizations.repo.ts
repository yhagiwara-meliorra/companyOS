import { createServerSupabaseClient } from "../../lib/supabase/server";
import { createServiceRoleSupabaseClient } from "../../lib/supabase/admin";

export async function ensureDefaultOrganization() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required. Sign in before creating a thread.");
  }

  const { data: existing, error: selectError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const admin = createServiceRoleSupabaseClient();
  const { data: existingMembership, error: membershipSelectError } = await admin
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipSelectError) throw membershipSelectError;

  if (existingMembership?.organization_id) {
    const { data: orgByMembership, error: orgSelectError } = await admin
      .from("organizations")
      .select("id, name, slug")
      .eq("id", existingMembership.organization_id)
      .single();

    if (orgSelectError) throw orgSelectError;
    return orgByMembership;
  }

  const slugBase = user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "studio";
  const orgSlug = `${slugBase}-${user.id.slice(0, 8)}`;

  const { data, error } = await admin
    .from("organizations")
    .insert({
      name: "Studio",
      slug: orgSlug,
      created_by: user.id,
    })
    .select("id, name, slug")
    .single();

  if (error) throw error;

  const { error: membershipInsertError } = await admin.from("memberships").insert({
    organization_id: data.id,
    user_id: user.id,
    role: "owner",
  });

  if (membershipInsertError) throw membershipInsertError;
  return data;
}
