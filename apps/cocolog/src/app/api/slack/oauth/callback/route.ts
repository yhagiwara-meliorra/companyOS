import { NextResponse, type NextRequest } from "next/server";
import { WebClient } from "@slack/web-api";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv, clientEnv } from "@/lib/env";

/**
 * Slack OAuth callback.
 * Exchanges code for token via @slack/web-api and stores installation.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = clientEnv().NEXT_PUBLIC_APP_URL;

  if (error || !code) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?error=slack_denied`,
    );
  }

  const env = serverEnv();

  // Exchange code for token using @slack/web-api
  const client = new WebClient();
  let oauthResult;
  try {
    oauthResult = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: `${appUrl}/api/slack/oauth/callback`,
    });
  } catch {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?error=slack_token_failed`,
    );
  }

  if (!oauthResult.ok || !oauthResult.team?.id) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?error=slack_token_failed`,
    );
  }

  // Get current user
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Store connection + installation using admin client (bypasses RLS)
  const db = createAdminClient();

  // Check existing membership; auto-create org if none exists
  const { data: existingMembership } = await db
    .from("memberships")
    .select("org_id")
    .eq("profile_id", user.id)
    .limit(1)
    .single();

  let orgId: string;

  if (existingMembership) {
    orgId = existingMembership.org_id;
  } else {
    // Auto-create organization from Slack team info
    const teamName = oauthResult.team!.name ?? "My Organization";
    const slug =
      teamName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `org-${Date.now()}`;

    const { data: newOrg, error: orgError } = await db
      .from("organizations")
      .insert({ name: teamName, slug: `${slug}-${Date.now()}` })
      .select("id")
      .single();

    if (orgError || !newOrg) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=org_creation_failed`,
      );
    }

    // Create owner membership
    const { error: memError } = await db
      .from("memberships")
      .insert({ org_id: newOrg.id, profile_id: user.id, role: "owner" });

    if (memError) {
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?error=membership_failed`,
      );
    }

    orgId = newOrg.id;
  }

  // Upsert provider-agnostic connection
  const { data: conn } = await db
    .schema("integrations")
    .from("connections")
    .upsert(
      {
        org_id: orgId,
        provider: "slack",
        status: "active",
        installed_by: user.id,
      },
      { onConflict: "org_id,provider" },
    )
    .select("id")
    .single();

  if (!conn) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?error=connection_failed`,
    );
  }

  // Upsert provider-specific installation details
  await db
    .schema("integrations")
    .from("installations")
    .upsert(
      {
        connection_id: conn.id,
        provider_team_id: oauthResult.team.id,
        team_name: oauthResult.team.name ?? "",
        bot_token: oauthResult.access_token ?? "",
        bot_user_id: oauthResult.bot_user_id ?? "",
        scopes: oauthResult.scope?.split(",") ?? [],
        token_type: oauthResult.token_type ?? "bot",
        raw_response: JSON.parse(JSON.stringify(oauthResult)),
        installed_at: new Date().toISOString(),
      },
      { onConflict: "provider_team_id" },
    );

  // Audit log
  await db.schema("audit").from("event_log").insert({
    org_id: orgId,
    actor_id: user.id,
    action: "slack.installed",
    resource_type: "integration",
    resource_id: conn.id,
    metadata: { team_id: oauthResult.team.id, team_name: oauthResult.team.name },
  });

  return NextResponse.redirect(
    `${appUrl}/dashboard/settings?success=slack_connected`,
  );
}
