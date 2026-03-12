import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .single() as { data: { display_name: string; avatar_url: string | null } | null };

  return (
    <DashboardShell
      displayName={profile?.display_name ?? user.email ?? "User"}
      avatarUrl={profile?.avatar_url ?? null}
    >
      {children}
    </DashboardShell>
  );
}
