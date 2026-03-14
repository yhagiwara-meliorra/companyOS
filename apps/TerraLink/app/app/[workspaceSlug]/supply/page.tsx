import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { VerificationBadge } from "@/components/verification-badge";
import { TierBadge } from "@/components/tier-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Network, Plus, ArrowRight } from "lucide-react";
import { AddRelationshipForm } from "./add-relationship-form";
import { NetworkGraph } from "@/components/supply/network-graph";
import { RELATIONSHIP_TYPE_LABELS } from "@/lib/labels";
import { canEdit } from "@/lib/auth/roles";

export default async function SupplyPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Get supply relationships
  const { data: relationships } = await admin
    .from("supply_relationships")
    .select(
      `
      id,
      tier,
      relationship_type,
      verification_status,
      from_ws_org:workspace_organizations!supply_relationships_from_workspace_org_id_fkey (
        id,
        organizations (
          id,
          display_name,
          org_type,
          country_code
        )
      ),
      to_ws_org:workspace_organizations!supply_relationships_to_workspace_org_id_fkey (
        id,
        organizations (
          id,
          display_name,
          org_type,
          country_code
        )
      )
    `
    )
    .eq("workspace_id", ctx.workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Get supply edges
  const { data: edges } = await admin
    .from("supply_edges")
    .select(
      `
      id,
      flow_direction,
      verification_status,
      from_site:sites!supply_edges_from_site_id_fkey (
        id,
        site_name,
        country_code
      ),
      to_site:sites!supply_edges_to_site_id_fkey (
        id,
        site_name,
        country_code
      ),
      supply_relationships (
        id,
        from_ws_org:workspace_organizations!supply_relationships_from_workspace_org_id_fkey (
          organizations ( display_name )
        ),
        to_ws_org:workspace_organizations!supply_relationships_to_workspace_org_id_fkey (
          organizations ( display_name )
        )
      )
    `
    )
    .not("supply_relationships", "is", null);

  // Get available orgs for the add form
  const { data: orgLinks } = await admin
    .from("workspace_organizations")
    .select("id, organization_id, organizations(id, display_name)")
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "active");

  const orgs = (orgLinks ?? [])
    .map((l) => {
      const org = l.organizations as unknown as {
        id: string;
        display_name: string;
      };
      if (!org) return null;
      return { wsOrgId: l.id, name: org.display_name };
    })
    .filter(Boolean) as { wsOrgId: string; name: string }[];

  const rels = relationships ?? [];
  const supplyEdges = edges ?? [];
  const hasEditAccess = canEdit(ctx.membership.role);

  // Compute tier distribution
  const tierCounts: Record<number, number> = {};
  rels.forEach((r) => {
    const t = r.tier ?? 0;
    tierCounts[t] = (tierCounts[t] || 0) + 1;
  });

  // Build network graph data from supply relationships
  const nodeMap = new Map<
    string,
    { id: string; name: string; fromCount: number; toCount: number }
  >();

  rels.forEach((rel) => {
    const fromWsOrg = rel.from_ws_org as unknown as {
      id: string;
      organizations: { id: string; display_name: string } | null;
    } | null;
    const toWsOrg = rel.to_ws_org as unknown as {
      id: string;
      organizations: { id: string; display_name: string } | null;
    } | null;

    const fromOrgId = fromWsOrg?.organizations?.id;
    const fromOrgName = fromWsOrg?.organizations?.display_name;
    const toOrgId = toWsOrg?.organizations?.id;
    const toOrgName = toWsOrg?.organizations?.display_name;

    if (fromOrgId && fromOrgName) {
      const existing = nodeMap.get(fromOrgId);
      if (existing) {
        existing.fromCount += 1;
      } else {
        nodeMap.set(fromOrgId, {
          id: fromOrgId,
          name: fromOrgName,
          fromCount: 1,
          toCount: 0,
        });
      }
    }

    if (toOrgId && toOrgName) {
      const existing = nodeMap.get(toOrgId);
      if (existing) {
        existing.toCount += 1;
      } else {
        nodeMap.set(toOrgId, {
          id: toOrgId,
          name: toOrgName,
          fromCount: 0,
          toCount: 1,
        });
      }
    }
  });

  const graphNodes = Array.from(nodeMap.values()).map((n) => ({
    id: n.id,
    name: n.name,
    type:
      n.fromCount > 0 && n.toCount > 0
        ? ("both" as const)
        : n.fromCount > 0
          ? ("from" as const)
          : ("to" as const),
  }));

  const graphEdges = rels
    .map((rel) => {
      const fromWsOrg = rel.from_ws_org as unknown as {
        organizations: { id: string } | null;
      } | null;
      const toWsOrg = rel.to_ws_org as unknown as {
        organizations: { id: string } | null;
      } | null;
      const fromId = fromWsOrg?.organizations?.id;
      const toId = toWsOrg?.organizations?.id;
      if (!fromId || !toId) return null;
      return {
        from: fromId,
        to: toId,
        label:
          RELATIONSHIP_TYPE_LABELS[rel.relationship_type] ??
          rel.relationship_type,
      };
    })
    .filter(Boolean) as { from: string; to: string; label?: string }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="サプライチェーン"
        description="サプライチェーン関係と物資フローの可視化・管理"
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  取引関係
                </p>
                <p className="mt-1 text-3xl font-bold">{rels.length}</p>
              </div>
              <Network className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  供給エッジ
                </p>
                <p className="mt-1 text-3xl font-bold">{supplyEdges.length}</p>
              </div>
              <ArrowRight className="h-8 w-8 text-primary/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                ティア分布
              </p>
              <div className="mt-2 flex items-end gap-2">
                {Object.entries(tierCounts)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tier, count]) => (
                    <div key={tier} className="text-center">
                      <div
                        className="mx-auto w-8 rounded-t bg-primary/20"
                        style={{
                          height: `${Math.max(16, (count / Math.max(...Object.values(tierCounts))) * 48)}px`,
                        }}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        T{tier}
                      </p>
                      <p className="text-xs font-semibold">{count}</p>
                    </div>
                  ))}
                {Object.keys(tierCounts).length === 0 && (
                  <p className="text-sm text-muted-foreground">データなし</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ネットワークグラフ</CardTitle>
          <CardDescription>組織間の取引関係を可視化</CardDescription>
        </CardHeader>
        <CardContent>
          <NetworkGraph nodes={graphNodes} edges={graphEdges} />
        </CardContent>
      </Card>

      {/* Add Relationship Form */}
      {hasEditAccess && orgs.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              取引関係を追加
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AddRelationshipForm
              workspaceSlug={workspaceSlug}
              orgs={orgs}
            />
          </CardContent>
        </Card>
      )}

      {/* Relationships Table */}
      {rels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">サプライ関係一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>From 組織</TableHead>
                  <TableHead />
                  <TableHead>To 組織</TableHead>
                  <TableHead>関係タイプ</TableHead>
                  <TableHead>ティア</TableHead>
                  <TableHead>検証状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rels.map((rel) => {
                  const fromOrg = (rel.from_ws_org as unknown as {
                    organizations: {
                      id: string;
                      display_name: string;
                      country_code: string | null;
                    } | null;
                  } | null)?.organizations;
                  const toOrg = (rel.to_ws_org as unknown as {
                    organizations: {
                      id: string;
                      display_name: string;
                      country_code: string | null;
                    } | null;
                  } | null)?.organizations;
                  return (
                    <TableRow key={rel.id}>
                      <TableCell>
                        <span className="font-medium">
                          {fromOrg?.display_name ?? "Unknown"}
                        </span>
                        {fromOrg?.country_code && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({fromOrg.country_code})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {toOrg?.display_name ?? "Unknown"}
                        </span>
                        {toOrg?.country_code && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({toOrg.country_code})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {RELATIONSHIP_TYPE_LABELS[rel.relationship_type] ?? rel.relationship_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={rel.tier} />
                      </TableCell>
                      <TableCell>
                        <VerificationBadge
                          status={
                            rel.verification_status as
                              | "inferred"
                              | "declared"
                              | "verified"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
