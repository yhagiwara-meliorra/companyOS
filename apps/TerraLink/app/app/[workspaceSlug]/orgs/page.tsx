import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { VerificationBadge } from "@/components/verification-badge";
import { TierBadge } from "@/components/tier-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Upload, ExternalLink } from "lucide-react";
import { OrgCsvImportForm } from "./org-csv-import-form";
import { ORG_TYPE_LABELS, ROLE_LABELS } from "@/lib/labels";

export default async function OrgsListPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();
  const { data: links } = await admin
    .from("workspace_organizations")
    .select(
      `
      id,
      relationship_role,
      tier,
      status,
      verification_status,
      organizations (
        id,
        legal_name,
        display_name,
        org_type,
        country_code,
        website
      )
    `
    )
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const orgs = links ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="組織"
        description="バイヤー・サプライヤー組織を管理"
        actions={
          <div className="flex items-center gap-2">
            <OrgCsvImportForm workspaceSlug={workspaceSlug} />
            <Button asChild>
              <Link href={`/app/${workspaceSlug}/orgs/new`}>
                <Plus className="mr-2 h-4 w-4" />
                組織を追加
              </Link>
            </Button>
          </div>
        }
      />

      {orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="組織がありません"
          description="最初の組織を追加して、サプライチェーンネットワークの構築を始めましょう。"
          action={
            <Button asChild>
              <Link href={`/app/${workspaceSlug}/orgs/new`}>
                <Plus className="mr-2 h-4 w-4" />
                組織を追加
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[280px]">組織名</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>役割</TableHead>
                <TableHead>ティア</TableHead>
                <TableHead>検証状態</TableHead>
                <TableHead>国</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((link) => {
                const org = link.organizations as unknown as {
                  id: string;
                  legal_name: string;
                  display_name: string;
                  org_type: string;
                  country_code: string | null;
                  website: string | null;
                };
                if (!org) return null;
                return (
                  <TableRow key={link.id} className="group">
                    <TableCell>
                      <Link
                        href={`/app/${workspaceSlug}/orgs/${org.id}`}
                        className="group/link flex flex-col"
                      >
                        <span className="font-medium group-hover/link:text-primary transition-colors">
                          {org.display_name}
                        </span>
                        {org.legal_name !== org.display_name && (
                          <span className="text-xs text-muted-foreground">
                            {org.legal_name}
                          </span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {ROLE_LABELS[link.relationship_role] ?? link.relationship_role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={link.tier} />
                    </TableCell>
                    <TableCell>
                      <VerificationBadge
                        status={
                          link.verification_status as
                            | "inferred"
                            | "declared"
                            | "verified"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {org.country_code && (
                        <span className="text-sm text-muted-foreground">
                          {org.country_code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {org.website && (
                        <a
                          href={org.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
