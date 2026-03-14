import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { canEdit } from "@/lib/auth/roles";
import { CreateDdsForm } from "./create-dds-form";

export default async function CreateDdsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();
  if (!canEdit(ctx.membership.role)) notFound();

  const admin = createAdminClient();

  // Fetch organizations for operator dropdown
  const { data: orgs } = await admin
    .from("workspace_organizations")
    .select(
      `
      id,
      organization:organizations (id, display_name, legal_name)
    `
    )
    .eq("workspace_id", ctx.workspace.id);

  const orgOptions = (orgs ?? [])
    .filter((o) => o.organization)
    .map((o) => {
      const org = o.organization as unknown as {
        id: string;
        display_name: string;
        legal_name: string | null;
      };
      return { orgId: org.id, name: org.display_name };
    });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">新規 DDS 作成</h1>
        <p className="text-sm text-muted-foreground">
          デューデリジェンスステートメントを作成します
        </p>
      </div>

      <CreateDdsForm workspaceSlug={workspaceSlug} orgs={orgOptions} />
    </div>
  );
}
