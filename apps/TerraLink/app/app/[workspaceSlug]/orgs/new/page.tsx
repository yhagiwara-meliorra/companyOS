import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { PageHeader } from "@/components/page-header";
import { OrgForm } from "../org-form";

export default async function NewOrgPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="組織を追加"
        description="新しい組織を作成し、ワークスペースにリンクします。"
      />
      <div className="max-w-2xl">
        <OrgForm workspaceSlug={workspaceSlug} />
      </div>
    </div>
  );
}
