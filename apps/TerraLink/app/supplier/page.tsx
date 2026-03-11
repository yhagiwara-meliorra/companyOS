import { redirect } from "next/navigation";
import {
  getSupplierContext,
  getSupplierWorkspaces,
} from "@/lib/auth/supplier-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, FileCheck, Network, Shield } from "lucide-react";

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

export default async function SupplierDashboardPage() {
  const ctx = await getSupplierContext();
  if (!ctx) redirect("/login");

  const admin = createAdminClient();

  // Fetch supplier data
  const [sitesResult, evidenceResult, buyerWorkspaces] = await Promise.all([
    admin
      .from("organization_sites")
      .select("id, site_id, sites ( id, site_name, site_type, verification_status )")
      .eq("organization_id", ctx.organization.id),
    admin
      .from("evidence_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null),
    getSupplierWorkspaces(ctx.organization.id),
  ]);

  const sites = (sitesResult.data ?? []).map((os) => {
    const site = os.sites as unknown as {
      id: string;
      site_name: string;
      site_type: string;
      verification_status: string;
    };
    return site;
  });

  const siteCount = sites.length;
  const evidenceCount = evidenceResult.count ?? 0;
  const buyerCount = buyerWorkspaces.length;
  const verifiedSites = sites.filter(
    (s) => s?.verification_status === "verified"
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="サプライヤーダッシュボード"
        description={`${ctx.organization.display_name} のサプライヤーポータル`}
      />

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="サイト"
          value={siteCount}
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          label="証憑ファイル"
          value={evidenceCount}
          icon={<FileCheck className="h-5 w-5" />}
        />
        <StatCard
          label="取引先ワークスペース"
          value={buyerCount}
          icon={<Network className="h-5 w-5" />}
        />
        <StatCard
          label="検証済みサイト"
          value={verifiedSites}
          trend={
            siteCount > 0
              ? `${Math.round((verifiedSites / siteCount) * 100)}%`
              : undefined
          }
          icon={<Shield className="h-5 w-5" />}
        />
      </div>

      {/* Buyer Workspaces */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="h-4 w-4" />
            取引先ワークスペース
          </CardTitle>
          <CardDescription>
            あなたの組織をサプライヤーとして登録しているバイヤー
          </CardDescription>
        </CardHeader>
        <CardContent>
          {buyerWorkspaces.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              まだどのワークスペースにも招待されていません。
            </p>
          ) : (
            <div className="space-y-2">
              {buyerWorkspaces.map((bw) => (
                <div
                  key={bw.workspaceOrgId}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{bw.workspaceName}</p>
                    <p className="text-xs text-muted-foreground">
                      Tier {bw.tier ?? 1} · {bw.relationshipRole}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${VERIFICATION_COLOR[bw.verificationStatus] ?? ""}`}
                  >
                    {VERIFICATION_LABEL[bw.verificationStatus] ??
                      bw.verificationStatus}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site Status */}
      {sites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4" />
              サイト検証状態
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sites
                .filter((s) => s != null)
                .map((site) => (
                  <div
                    key={site.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {site.site_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {site.site_type}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`ml-2 text-[10px] ${VERIFICATION_COLOR[site.verification_status] ?? ""}`}
                    >
                      {VERIFICATION_LABEL[site.verification_status] ??
                        site.verification_status}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
