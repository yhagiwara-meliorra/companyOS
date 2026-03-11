export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const Sentry = await import("@sentry/nextjs");
  if (typeof Sentry.captureRequestError === "function") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Sentry.captureRequestError as (...a: any[]) => void)(...args);
  }
};
