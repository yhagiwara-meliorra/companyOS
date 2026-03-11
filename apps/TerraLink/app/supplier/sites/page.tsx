import { redirect } from "next/navigation";
import { getSupplierContext } from "@/lib/auth/supplier-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
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
import { MapPin } from "lucide-react";
import { SupplierSiteForm } from "./supplier-site-form";

const VERIFICATION_LABEL: Record<string, string> = {
  inferred: "推定",
  declared: "自己申告",
  verified: "検証済み",
};

const VERIFICATION_COLOR: Record<string, string> = {
  inferred:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  declared: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  verified:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

const SITE_TYPE_LABEL: Record<string, string> = {
  farm: "農場",
  plantation: "プランテーション",
  factory: "工場",
  warehouse: "倉庫",
  port: "港湾",
  mine: "鉱山",
  office: "オフィス",
  other: "その他",
};

export default async function SupplierSitesPage() {
  const ctx = await getSupplierContext();
  if (!ctx) redirect("/login");

  const admin = createAdminClient();

  const { data: orgSites } = await admin
    .from("organization_sites")
    .select(
      "id, ownership_role, is_primary, sites ( id, site_name, site_type, country_code, region, latitude, longitude, verification_status, created_at )"
    )
    .eq("organization_id", ctx.organization.id);

  type SiteRow = {
    id: string;
    site_name: string;
    site_type: string;
    country_code: string | null;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    verification_status: string;
    created_at: string;
  };

  const sites = (orgSites ?? []).map((os) => {
    const site = os.sites as unknown as SiteRow;
    return {
      ...site,
      ownershipRole: os.ownership_role,
      isPrimary: os.is_primary,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="サイト管理"
        description="組織が運営するサイトを登録・管理"
      />

      {/* Add Site Form */}
      <SupplierSiteForm />

      {/* Site List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            登録サイト
          </CardTitle>
          <CardDescription>
            {sites.length}件のサイトが登録されています
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              サイトがまだ登録されていません。上のフォームからサイトを追加してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>サイト名</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>国</TableHead>
                  <TableHead>地域</TableHead>
                  <TableHead>座標</TableHead>
                  <TableHead>検証状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {site.site_name}
                        {site.isPrimary && (
                          <Badge variant="secondary" className="text-[9px]">
                            主要
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {SITE_TYPE_LABEL[site.site_type] ?? site.site_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {site.country_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {site.region ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {site.latitude != null && site.longitude != null
                        ? `${site.latitude.toFixed(2)}, ${site.longitude.toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${VERIFICATION_COLOR[site.verification_status] ?? ""}`}
                      >
                        {VERIFICATION_LABEL[site.verification_status] ??
                          site.verification_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
