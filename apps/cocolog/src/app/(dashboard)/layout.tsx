import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/top-nav";

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
    .select("display_name")
    .eq("id", user.id)
    .single() as { data: { display_name: string } | null };

  return (
    <div className="min-h-screen bg-surface">
      <TopNav displayName={profile?.display_name ?? user.email ?? "User"} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
