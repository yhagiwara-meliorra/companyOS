import { NextResponse } from "next/server";
import { getInstallProvider } from "@/lib/slack/install-provider";
import { clientEnv } from "@/lib/env";

/**
 * Redirect to Slack OAuth install flow.
 * Uses @slack/oauth InstallProvider for signed state parameter.
 */
export async function GET() {
  const provider = getInstallProvider();
  const appUrl = clientEnv().NEXT_PUBLIC_APP_URL;

  const url = await provider.generateInstallUrl({
    scopes: [
      "channels:history",
      "channels:read",
      "groups:history",
      "groups:read",
      "im:history",
      "im:read",
      "mpim:history",
      "mpim:read",
      "chat:write",
      "users:read",
      "users:read.email",
      "commands",
    ],
    redirectUri: `${appUrl}/api/slack/oauth/callback`,
  });

  return NextResponse.redirect(url);
}
