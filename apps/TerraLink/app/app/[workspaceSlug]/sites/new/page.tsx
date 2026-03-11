import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { SiteForm } from "../site-form";

export default async function NewSitePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();
  const { data: orgLinks } = await admin
    .from("workspace_organizations")
    .select("organization_id, organizations(id, display_name)")
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "active");

  const orgs = (orgLinks ?? [])
    .map((l) => {
      const org = l.organizations as unknown as {
        id: string;
        display_name: string;
      };
      return org;
    })
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title="サイトを追加"
        description="新しい事業サイトを登録し、組織にリンクします。"
      />
      <div className="max-w-2xl">
        <SiteForm workspaceSlug={workspaceSlug} orgs={orgs} />
      </div>
    </div>
  );
}
