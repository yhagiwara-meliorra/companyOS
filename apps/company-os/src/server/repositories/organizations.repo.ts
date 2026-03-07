import { createServerSupabaseClient } from "../../lib/supabase/server";

export async function ensureDefaultOrganization() {
  const supabase = await createServerSupabaseClient();

  const { data: existing, error: selectError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: "Studio",
      slug: "studio",
    })
    .select("id, name, slug")
    .single();

  if (error) throw error;
  return data;
}
