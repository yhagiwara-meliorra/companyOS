import { InstallProvider } from "@slack/oauth";
import { serverEnv } from "@/lib/env";

let _provider: InstallProvider | null = null;

/**
 * Lazy singleton for @slack/oauth InstallProvider.
 * Used only for generating install URLs with signed state parameters.
 * Token exchange and storage are handled in the callback route.
 */
export function getInstallProvider(): InstallProvider {
  if (!_provider) {
    const env = serverEnv();
    _provider = new InstallProvider({
      clientId: env.SLACK_CLIENT_ID,
      clientSecret: env.SLACK_CLIENT_SECRET,
      stateSecret: env.SLACK_SIGNING_SECRET,
      installationStore: {
        storeInstallation: async () => {
          // no-op: handled in callback route where we have user context
        },
        fetchInstallation: async () => {
          throw new Error("not used");
        },
        deleteInstallation: async () => {
          // no-op
        },
      },
    });
  }
  return _provider;
}
