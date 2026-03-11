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
import { SUPPLY_STATUS_LABELS } from "@/lib/labels";

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
      status,
      verification_status,
      buyer:organizations!supply_relationships_buyer_org_id_fkey (
        id,
        display_name,
        org_type,
        country_code
      ),
      supplier:organizations!supply_relationships_supplier_org_id_fkey (
        id,
        display_name,
        org_type,
        country_code
      )
    `
    )
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Get supply edges
  const { data: edges } = await admin
    .from("supply_edges")
    .select(
      `
      id,
      transport_mode,
      verification_status,
      from_site:sites!supply_edges_from_site_id_fkey (
        id,
        name,
        country_code
      ),
      to_site:sites!supply_edges_to_site_id_fkey (
        id,
        name,
        country_code
      ),
      supply_relationships (
        id,
        buyer:organizations!supply_relationships_buyer_org_id_fkey (
          display_name
        ),
        supplier:organizations!supply_relationships_supplier_org_id_fkey (
          display_name
        )
      )
    `
    )
    .not("supply_relationships", "is", null);

  // Get available orgs for the add form
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

  const rels = relationships ?? [];
  const supplyEdges = edges ?? [];

  // Compute tier distribution
  const tierCounts: Record<number, number> = {};
  rels.forEach((r) => {
    const t = r.tier ?? 0;
    tierCounts[t] = (tierCounts[t] || 0) + 1;
  });

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

      {/* Network Graph Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">サプライネットワーク</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/20">
            {rels.length > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-4 p-6">
                {rels.slice(0, 8).map((rel) => {
                  const buyer = rel.buyer as unknown as {
                    display_name: string;
                  } | null;
                  const supplier = rel.supplier as unknown as {
                    display_name: string;
                  } | null;
                  return (
                    <div
                      key={rel.id}
                      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs shadow-sm"
                    >
                      <span className="font-medium">
                        {buyer?.display_name ?? "?"}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {supplier?.display_name ?? "?"}
                      </span>
                      <TierBadge tier={rel.tier} />
                    </div>
                  );
                })}
                {rels.length > 8 && (
                  <span className="text-xs text-muted-foreground">
                    他{rels.length - 8}件
                  </span>
                )}
              </div>
            ) : (
              <div className="text-center">
                <Network className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  サプライ関係を追加するとネットワークグラフが表示されます
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Relationship Form */}
      {orgs.length >= 2 && (
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
                  <TableHead>バイヤー</TableHead>
                  <TableHead />
                  <TableHead>サプライヤー</TableHead>
                  <TableHead>ティア</TableHead>
                  <TableHead>検証状態</TableHead>
                  <TableHead>ステータス</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rels.map((rel) => {
                  const buyer = rel.buyer as unknown as {
                    id: string;
                    display_name: string;
                    country_code: string | null;
                  } | null;
                  const supplier = rel.supplier as unknown as {
                    id: string;
                    display_name: string;
                    country_code: string | null;
                  } | null;
                  return (
                    <TableRow key={rel.id}>
                      <TableCell>
                        <span className="font-medium">
                          {buyer?.display_name ?? "Unknown"}
                        </span>
                        {buyer?.country_code && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({buyer.country_code})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {supplier?.display_name ?? "Unknown"}
                        </span>
                        {supplier?.country_code && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({supplier.country_code})
                          </span>
                        )}
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
                      <TableCell>
                        <Badge
                          variant={
                            rel.status === "active" ? "default" : "secondary"
                          }
                        >
                          {SUPPLY_STATUS_LABELS[rel.status] ?? rel.status}
                        </Badge>
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
