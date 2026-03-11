import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { VerificationBadge } from "@/components/verification-badge";
import { TierBadge } from "@/components/tier-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Pencil,
  Globe,
  Building2,
} from "lucide-react";
import { OrgForm } from "../org-form";
import { ORG_TYPE_LABELS, ROLE_LABELS, SITE_TYPE_LABELS, SITE_ROLE_LABELS } from "@/lib/labels";

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; orgId: string }>;
}) {
  const { workspaceSlug, orgId } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Get org details
  const { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();
  if (!org) notFound();

  // Get workspace link
  const { data: link } = await admin
    .from("workspace_organizations")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .eq("organization_id", orgId)
    .single();

  // Get linked sites
  const { data: orgSites } = await admin
    .from("organization_sites")
    .select(
      `
      id,
      role,
      sites (
        id,
        name,
        site_type,
        country_code,
        lat,
        lng
      )
    `
    )
    .eq("organization_id", orgId);

  // Get supply relationships where this org is buyer or supplier
  const { data: asSupplier } = await admin
    .from("supply_relationships")
    .select(
      `
      id,
      tier,
      status,
      verification_status,
      buyer:organizations!supply_relationships_buyer_org_id_fkey (
        id,
        display_name
      )
    `
    )
    .eq("supplier_org_id", orgId)
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "active");

  const { data: asBuyer } = await admin
    .from("supply_relationships")
    .select(
      `
      id,
      tier,
      status,
      verification_status,
      supplier:organizations!supply_relationships_supplier_org_id_fkey (
        id,
        display_name
      )
    `
    )
    .eq("buyer_org_id", orgId)
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "active");

  const sites = orgSites ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={org.display_name}
        description={
          org.legal_name !== org.display_name ? org.legal_name : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {link && (
              <>
                <VerificationBadge
                  status={
                    link.verification_status as
                      | "inferred"
                      | "declared"
                      | "verified"
                  }
                />
                <TierBadge tier={link.tier} />
              </>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/app/${workspaceSlug}/orgs`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                戻る
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Info Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">詳細</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">種別</span>
              <Badge variant="secondary">
                {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
              </Badge>
            </div>
            {link && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">役割</span>
                <Badge variant="outline">
                  {ROLE_LABELS[link.relationship_role] ?? link.relationship_role}
                </Badge>
              </div>
            )}
            {org.country_code && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">国</span>
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {org.country_code}
                </span>
              </div>
            )}
            {org.website && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ウェブサイト</span>
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  開く
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <OrgForm
            workspaceSlug={workspaceSlug}
            org={{
              id: org.id,
              legal_name: org.legal_name,
              display_name: org.display_name,
              org_type: org.org_type,
              country_code: org.country_code,
              website: org.website,
            }}
          />
        </div>
      </div>

      <Separator />

      {/* Sites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            関連サイト
          </CardTitle>
          <CardDescription>
            この組織に関連するサイト
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              この組織にサイトがリンクされていません。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>役割</TableHead>
                  <TableHead>国</TableHead>
                  <TableHead>座標</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((os) => {
                  const site = os.sites as unknown as {
                    id: string;
                    name: string;
                    site_type: string;
                    country_code: string | null;
                    lat: number | null;
                    lng: number | null;
                  };
                  if (!site) return null;
                  return (
                    <TableRow key={os.id}>
                      <TableCell>
                        <Link
                          href={`/app/${workspaceSlug}/sites/${site.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {site.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {SITE_TYPE_LABELS[site.site_type] ?? site.site_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{SITE_ROLE_LABELS[os.role] ?? os.role}</TableCell>
                      <TableCell>{site.country_code}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {site.lat != null && site.lng != null
                          ? `${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Supply Relationships */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            サプライ関係
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(asBuyer?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">サプライヤー</p>
              <div className="space-y-1">
                {asBuyer!.map((rel) => {
                  const supplier = rel.supplier as unknown as {
                    id: string;
                    display_name: string;
                  } | null;
                  return (
                    <div
                      key={rel.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="flex-1 font-medium">
                        {supplier?.display_name ?? "不明"}
                      </span>
                      <TierBadge tier={rel.tier} />
                      <VerificationBadge
                        status={
                          rel.verification_status as
                            | "inferred"
                            | "declared"
                            | "verified"
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(asSupplier?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">バイヤー</p>
              <div className="space-y-1">
                {asSupplier!.map((rel) => {
                  const buyer = rel.buyer as unknown as {
                    id: string;
                    display_name: string;
                  } | null;
                  return (
                    <div
                      key={rel.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="flex-1 font-medium">
                        {buyer?.display_name ?? "不明"}
                      </span>
                      <TierBadge tier={rel.tier} />
                      <VerificationBadge
                        status={
                          rel.verification_status as
                            | "inferred"
                            | "declared"
                            | "verified"
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {(asBuyer?.length ?? 0) === 0 && (asSupplier?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">
              この組織にサプライ関係がリンクされていません。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
