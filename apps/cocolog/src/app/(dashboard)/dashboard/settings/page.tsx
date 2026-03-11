import { createServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SettingsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name, slug, plan)")
    .eq("profile_id", user!.id) as { data: { org_id: string; role: string; organizations: { name: string; slug: string; plan: string } | null }[] | null };

  const membership = memberships?.[0];
  const org = membership?.organizations ?? null;

  let slackInstalls: { installation_id: string; team_name: string; team_id: string }[] = [];
  if (membership?.org_id) {
    const { data } = await supabase
      .from("v_my_installations")
      .select("installation_id, team_name, team_id")
      .eq("org_id", membership.org_id) as { data: { installation_id: string; team_name: string; team_id: string }[] | null };
    slackInstalls = data ?? [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">設定</h1>
        <p className="mt-1 text-sm text-slate-500">
          組織と連携の管理。
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>組織</CardTitle>
          </CardHeader>
          {org ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">名前</dt>
                <dd className="font-medium text-slate-900">{org.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">スラッグ</dt>
                <dd className="font-mono text-slate-600">{org.slug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">プラン</dt>
                <dd>
                  <Badge variant="primary">{org.plan}</Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">あなたの役割</dt>
                <dd>
                  <Badge variant={membership!.role === "owner" ? "warning" : "default"}>
                    {membership!.role}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-400">組織が見つかりません。</p>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slack連携</CardTitle>
          </CardHeader>
          {slackInstalls.length > 0 ? (
            <ul className="space-y-3">
              {slackInstalls.map((install) => (
                <li
                  key={install.installation_id}
                  className="flex items-center justify-between rounded-lg border border-border-light px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {install.team_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      チームID: {install.team_id}
                    </p>
                  </div>
                  <Badge variant="success">接続済み</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center">
              <p className="text-sm text-slate-400">
                Slackワークスペースが接続されていません。
              </p>
              <a
                href="/api/slack/oauth/start"
                className="mt-3 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Slackを接続
              </a>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
