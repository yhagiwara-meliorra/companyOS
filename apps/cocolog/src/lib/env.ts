import { z } from "zod";

// ── Server-only env vars (never exposed to browser) ─────────────────────────

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_OIDC_CLIENT_ID: z.string().min(1).optional(),
  SLACK_OIDC_CLIENT_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
});

// ── Public env vars (available in browser via NEXT_PUBLIC_ prefix) ──────────

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

// ── Lazy singletons (validated on first access, not at import time) ─────────

let _serverEnv: ServerEnv | null = null;
let _clientEnv: ClientEnv | null = null;

/** Validated server environment. Call only from server code. */
export function serverEnv(): ServerEnv {
  if (!_serverEnv) {
    _serverEnv = serverSchema.parse(process.env);
  }
  return _serverEnv;
}

/** Validated public environment. Safe to call anywhere. */
export function clientEnv(): ClientEnv {
  if (!_clientEnv) {
    _clientEnv = clientSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    });
  }
  return _clientEnv;
}
