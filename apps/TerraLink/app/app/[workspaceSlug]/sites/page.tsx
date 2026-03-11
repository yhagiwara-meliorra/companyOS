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
      visibility,
      sites (
        id,
        name,
        site_type,
        country_code,
        region_admin1,
        lat,
        lng,
        area_ha,
        address
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="サイト"
        description="サプライチェーン全体の事業サイトを管理"
        actions={
          <div className="flex items-center gap-2">
            <SiteCsvImportForm workspaceSlug={workspaceSlug} orgs={orgs} />
            <Button asChild>
              <Link href={`/app/${workspaceSlug}/sites/new`}>
                <Plus className="mr-2 h-4 w-4" />
                サイトを追加
              </Link>
            </Button>
          </div>
        }
      />

      {sites.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" />}
          title="サイトがありません"
          description="最初のサイトを追加して、サプライチェーンの地理マッピングを始めましょう。"
          action={
            <Button asChild>
              <Link href={`/app/${workspaceSlug}/sites/new`}>
                <Plus className="mr-2 h-4 w-4" />
                サイトを追加
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Mini Map placeholder */}
          <div className="relative h-64 overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950/30 dark:to-sky-950/30">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  地図表示 •{" "}
                  {sites.filter((s) => {
                    const site = s.sites as unknown as { lat: number | null };
                    return site?.lat != null;
                  }).length}{" "}
                  件のサイトに座標あり
                </p>
              </div>
            </div>
            {/* Plot dots for sites with coordinates */}
            {sites.map((ws) => {
              const site = ws.sites as unknown as {
                id: string;
                name: string;
                lat: number | null;
                lng: number | null;
              };
              if (!site?.lat || !site?.lng) return null;
              // Normalize to 0-100% position on map
              const x = ((site.lng + 180) / 360) * 100;
              const y = ((90 - site.lat) / 180) * 100;
              return (
                <div
                  key={site.id}
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-md shadow-primary/30"
                  style={{ left: `${x}%`, top: `${y}%` }}
                  title={site.name}
                />
              );
            })}
          </div>

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
                    name: string;
                    site_type: string;
                    country_code: string | null;
                    region_admin1: string | null;
                    lat: number | null;
                    lng: number | null;
                    area_ha: number | null;
                    address: string | null;
                  };
                  if (!site) return null;
                  return (
                    <TableRow key={ws.id} className="group">
                      <TableCell>
                        <Link
                          href={`/app/${workspaceSlug}/sites/${site.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {site.name}
                        </Link>
                        {site.address && (
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {site.address}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {SITE_TYPE_LABELS[site.site_type] ?? site.site_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{site.country_code ?? "—"}</TableCell>
                      <TableCell>{site.region_admin1 ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {site.lat != null && site.lng != null
                          ? `${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {site.area_ha != null
                          ? site.area_ha.toLocaleString()
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
