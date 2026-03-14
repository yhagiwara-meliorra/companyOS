import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Building2, Globe, Ruler } from "lucide-react";
import { SiteForm } from "../site-form";
import { SITE_TYPE_LABELS, ORG_TYPE_LABELS, OWNERSHIP_ROLE_LABELS } from "@/lib/labels";
import { canEdit } from "@/lib/auth/roles";
import { SiteMap } from "@/components/map";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; siteId: string }>;
}) {
  const { workspaceSlug, siteId } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Verify site belongs to this workspace
  const { data: wsLink } = await admin
    .from("workspace_sites")
    .select("id")
    .eq("workspace_id", ctx.workspace.id)
    .eq("site_id", siteId)
    .single();
  if (!wsLink) notFound();

  const { data: site } = await admin
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .single();
  if (!site) notFound();

  // Get org links
  const { data: orgSites } = await admin
    .from("organization_sites")
    .select(
      `
      id,
      ownership_role,
      organizations (
        id,
        display_name,
        org_type
      )
    `
    )
    .eq("site_id", siteId);

  // Get orgs for edit form
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

  const linkedOrgs = orgSites ?? [];
  const hasEditAccess = canEdit(ctx.membership.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title={site.site_name}
        description={site.address_text ?? undefined}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/app/${workspaceSlug}/sites`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              戻る
            </Link>
          </Button>
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
                {SITE_TYPE_LABELS[site.site_type] ?? site.site_type}
              </Badge>
            </div>
            {site.country_code && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">国</span>
                <span className="flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  {site.country_code}
                </span>
              </div>
            )}
            {site.region && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">地域</span>
                <span>{site.region}</span>
              </div>
            )}
            {site.latitude != null && site.longitude != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">座標</span>
                <span className="flex items-center gap-1 text-xs">
                  <MapPin className="h-3 w-3" />
                  {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                </span>
              </div>
            )}
            {site.area_ha != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">面積</span>
                <span className="flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                  {site.area_ha.toLocaleString("ja-JP")} ha
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Map */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            {site.latitude != null && site.longitude != null ? (
              <SiteMap
                sites={[
                  {
                    id: site.id,
                    name: site.site_name,
                    lat: site.latitude,
                    lng: site.longitude,
                  },
                ]}
                center={[site.latitude, site.longitude]}
                zoom={10}
                className="h-48 w-full rounded-lg"
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">
                  座標が未設定です — 緯度・経度を追加すると地図に表示されます
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Linked Organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            関連組織
          </CardTitle>
          <CardDescription>
            このサイトで事業を行う組織
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedOrgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              このサイトに組織がリンクされていません。
            </p>
          ) : (
            <div className="space-y-2">
              {linkedOrgs.map((os) => {
                const org = os.organizations as unknown as {
                  id: string;
                  display_name: string;
                  org_type: string;
                } | null;
                if (!org) return null;
                return (
                  <div
                    key={os.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <Link
                      href={`/app/${workspaceSlug}/orgs/${org.id}`}
                      className="flex-1 font-medium hover:text-primary"
                    >
                      {org.display_name}
                    </Link>
                    <Badge variant="secondary">
                      {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {OWNERSHIP_ROLE_LABELS[os.ownership_role] ?? os.ownership_role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Edit Form */}
      {hasEditAccess && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">サイトを編集</h3>
          <div className="max-w-2xl">
            <SiteForm
              workspaceSlug={workspaceSlug}
              orgs={orgs}
              site={{
                id: site.id,
                name: site.site_name,
                site_type: site.site_type,
                country_code: site.country_code,
                region_admin1: site.region,
                lat: site.latitude,
                lng: site.longitude,
                area_ha: site.area_ha,
                address: site.address_text,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
