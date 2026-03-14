import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Plus } from "lucide-react";
import { SiteCsvImportForm } from "./site-csv-import-form";
import { SITE_TYPE_LABELS } from "@/lib/labels";
import { canEdit } from "@/lib/auth/roles";
import { SiteMap } from "@/components/map";

export default async function SitesListPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();
  const { data: wsSites } = await admin
    .from("workspace_sites")
    .select(
      `
      id,
      scope_role,
      sites (
        id,
        site_name,
        site_type,
        country_code,
        region,
        latitude,
        longitude,
        area_ha,
        address_text
      )
    `
    )
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });

  // Also get org list for the CSV import form
  const { data: orgLinks } = await admin
    .from("workspace_organizations")
    .select("organization_id, organizations(id, display_name)")
    .eq("workspace_id", ctx.workspace.id)
    .eq("status", "active");

  const sites = wsSites ?? [];
  const orgs = (orgLinks ?? []).map((l) => {
    const org = l.organizations as unknown as {
      id: string;
      display_name: string;
    };
    return org;
  }).filter(Boolean);
  const hasEditAccess = canEdit(ctx.membership.role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="サイト"
        description="サプライチェーン全体の事業サイトを管理"
        actions={
          hasEditAccess ? (
            <div className="flex items-center gap-2">
              <SiteCsvImportForm workspaceSlug={workspaceSlug} orgs={orgs} />
              <Button asChild>
                <Link href={`/app/${workspaceSlug}/sites/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  サイトを追加
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {sites.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="サイトがありません"
          description="最初のサイトを追加して、サプライチェーンの地理マッピングを始めましょう。"
          action={
            hasEditAccess ? (
              <Button asChild>
                <Link href={`/app/${workspaceSlug}/sites/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  サイトを追加
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Site Map */}
          {(() => {
            const sitesWithCoords = sites
              .map((ws) => {
                const site = ws.sites as unknown as {
                  id: string;
                  site_name: string;
                  latitude: number | null;
                  longitude: number | null;
                };
                return site;
              })
              .filter(
                (s): s is { id: string; site_name: string; latitude: number; longitude: number } =>
                  s != null && s.latitude != null && s.longitude != null
              );
            return sitesWithCoords.length > 0 ? (
              <SiteMap
                sites={sitesWithCoords.map((s) => ({
                  id: s.id,
                  name: s.site_name,
                  lat: s.latitude,
                  lng: s.longitude,
                }))}
                className="h-[420px] w-full rounded-lg"
              />
            ) : (
              <div className="flex h-[420px] items-center justify-center rounded-xl border bg-muted">
                <div className="text-center">
                  <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    座標が設定されたサイトがありません
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Table */}
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[250px]">サイト名</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>国</TableHead>
                  <TableHead>地域</TableHead>
                  <TableHead>座標</TableHead>
                  <TableHead>面積 (ha)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((ws) => {
                  const site = ws.sites as unknown as {
                    id: string;
                    site_name: string;
                    site_type: string;
                    country_code: string | null;
                    region: string | null;
                    latitude: number | null;
                    longitude: number | null;
                    area_ha: number | null;
                    address_text: string | null;
                  };
                  if (!site) return null;
                  return (
                    <TableRow key={ws.id} className="group">
                      <TableCell>
                        <Link
                          href={`/app/${workspaceSlug}/sites/${site.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {site.site_name}
                        </Link>
                        {site.address_text && (
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {site.address_text}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {SITE_TYPE_LABELS[site.site_type] ?? site.site_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{site.country_code ?? "—"}</TableCell>
                      <TableCell>{site.region ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {site.latitude != null && site.longitude != null
                          ? `${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {site.area_ha != null
                          ? site.area_ha.toLocaleString("ja-JP")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
