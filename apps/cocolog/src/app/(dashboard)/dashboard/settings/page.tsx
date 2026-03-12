import { createServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisconnectButton } from "./disconnect-button";
import { AnalysisScopeSetting } from "./analysis-scope-setting";
import { TimezoneSetting } from "./timezone-setting";

const ERROR_MESSAGES: Record<string, string> = {
  slack_denied: "Slack連携が拒否されました。",
  slack_token_failed: "Slackトークンの取得に失敗しました。",
  no_org: "組織が見つかりません。先に組織を作成してください。",
  org_creation_failed: "組織の自動作成に失敗しました。",
  membership_failed: "メンバーシップの作成に失敗しました。",
  connection_failed: "Slack接続の保存に失敗しました。",
  install_failed: "Slackインストール情報の保存に失敗しました。",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; detail?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(name, slug, plan, settings)")
    .eq("profile_id", user!.id) as { data: { org_id: string; role: string; organizations: { name: string; slug: string; plan: string; settings: Record<string, unknown> } | null }[] | null };

  const membership = memberships?.[0];
  const org = membership?.organizations ?? null;
  const analysisScope = (org?.settings?.analysis_scope as string) ?? "members_only";
  const isOwnerOrAdmin =
    membership?.role === "owner" || membership?.role === "admin";

  // Fetch user timezone setting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userSettings } = (await (supabase as any)
    .from("user_settings")
    .select("timezone")
    .eq("profile_id", user!.id)
    .single()) as { data: { timezone: string } | null };
  const currentTimezone = userSettings?.timezone ?? "UTC";

  let slackInstalls: { installation_id: string; team_name: string; team_id: string }[] = [];
  if (membership?.org_id) {
    const { data } = await supabase
      .from("v_my_installations")
      .select("installation_id, team_name, team_id")
      .eq("org_id", membership.org_id)
      .eq("status", "active") as { data: { installation_id: string; team_name: string; team_id: string }[] | null };
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

      {params.success === "slack_connected" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Slackワークスペースが正常に接続されました。
        </div>
      )}
      {params.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{ERROR_MESSAGES[params.error] ?? `エラーが発生しました: ${params.error}`}</p>
          {params.detail && (
            <p className="mt-1 font-mono text-xs text-red-600">
              詳細: {params.detail}
            </p>
          )}
        </div>
      )}

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
            <div className="space-y-3">
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
                    <div className="flex items-center gap-2">
                      <Badge variant="success">接続済み</Badge>
                      {isOwnerOrAdmin && (
                        <DisconnectButton
                          installationId={install.installation_id}
                          teamName={install.team_name}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <a
                href="/api/slack/oauth/start"
                className="inline-block rounded-lg border border-border-light px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                再接続
              </a>
            </div>
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

      {/* Analysis scope setting */}
      {org && (
        <Card>
          <CardHeader>
            <CardTitle>分析設定</CardTitle>
          </CardHeader>
          <AnalysisScopeSetting currentScope={analysisScope} />
        </Card>
      )}

      {/* Timezone setting */}
      <Card>
        <CardHeader>
          <CardTitle>タイムゾーン</CardTitle>
        </CardHeader>
        <TimezoneSetting currentTimezone={currentTimezone} />
      </Card>
    </div>
  );
}
