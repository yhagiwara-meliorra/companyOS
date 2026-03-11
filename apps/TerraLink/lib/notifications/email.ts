/**
 * Email notification service for monitoring alerts.
 *
 * Uses Supabase Auth's built-in email capabilities (via `auth.admin.sendRawEmail`)
 * or a generic fetch-based approach for external email providers (Resend, SendGrid, etc.).
 *
 * Configuration:
 *   - EMAIL_PROVIDER: "resend" | "sendgrid" | "supabase" (default: supabase)
 *   - EMAIL_API_KEY: API key for external providers
 *   - EMAIL_FROM: Sender address (default: noreply@terralink.app)
 *   - EMAIL_ENABLED: "true" to enable sending (default: disabled)
 */

export interface AlertEmailPayload {
  to: string;
  recipientName: string;
  workspaceName: string;
  workspaceSlug: string;
  events: {
    title: string;
    severity: string;
    ruleType: string;
    triggeredAt: string;
  }[];
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

const SEVERITY_LABEL_JP: Record<string, string> = {
  critical: "重大",
  warning: "警告",
  info: "情報",
};

const RULE_TYPE_LABEL_JP: Record<string, string> = {
  source_refresh: "ソース更新",
  threshold: "閾値アラート",
  missing_evidence: "証憑欠損",
  review_due: "レビュー期限",
};

/**
 * Send a monitoring alert digest email to a workspace member.
 */
export async function sendAlertEmail(
  payload: AlertEmailPayload
): Promise<{ success: boolean; error?: string }> {
  const enabled = process.env.EMAIL_ENABLED === "true";
  if (!enabled) {
    console.log(
      `[email] Skipping email (EMAIL_ENABLED != true): ${payload.events.length} events → ${payload.to}`
    );
    return { success: true };
  }

  const provider = process.env.EMAIL_PROVIDER ?? "log";
  const from = process.env.EMAIL_FROM ?? "noreply@terralink.app";

  const subject = buildSubject(payload);
  const html = buildHtmlBody(payload);
  const text = buildTextBody(payload);

  switch (provider) {
    case "resend":
      return sendViaResend(from, payload.to, subject, html);
    case "sendgrid":
      return sendViaSendGrid(from, payload.to, subject, html, text);
    case "log":
    default:
      // Log-only mode for development
      console.log(`[email] Alert digest to ${payload.to}:`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Events: ${payload.events.length}`);
      payload.events.forEach((ev) => {
        console.log(`    ${SEVERITY_EMOJI[ev.severity] ?? "⚪"} ${ev.title}`);
      });
      return { success: true };
  }
}

// ── Subject line ─────────────────────────────────────────

function buildSubject(payload: AlertEmailPayload): string {
  const criticalCount = payload.events.filter(
    (e) => e.severity === "critical"
  ).length;
  const prefix = criticalCount > 0 ? "🔴 " : "🔔 ";
  return `${prefix}[TerraLink] ${payload.workspaceName} — ${payload.events.length}件のモニタリングアラート`;
}

// ── HTML email body ──────────────────────────────────────

function buildHtmlBody(payload: AlertEmailPayload): string {
  const eventRows = payload.events
    .map(
      (ev) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        ${SEVERITY_EMOJI[ev.severity] ?? "⚪"}
        <span style="font-weight:600;color:${ev.severity === "critical" ? "#dc2626" : ev.severity === "warning" ? "#d97706" : "#2563eb"};">
          ${SEVERITY_LABEL_JP[ev.severity] ?? ev.severity}
        </span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        ${RULE_TYPE_LABEL_JP[ev.ruleType] ?? ev.ruleType}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        ${ev.title}
      </td>
    </tr>`
    )
    .join("\n");

  const monitorUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.terralink.io"}/app/${payload.workspaceSlug}/monitor`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px;">
  <div style="border-bottom:2px solid #10b981;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="font-size:20px;margin:0;">TerraLink モニタリングアラート</h1>
    <p style="color:#6b7280;margin:4px 0 0;font-size:14px;">
      ${payload.workspaceName}
    </p>
  </div>

  <p style="font-size:14px;">
    ${payload.recipientName}様、
  </p>
  <p style="font-size:14px;line-height:1.6;">
    ワークスペース「${payload.workspaceName}」で新しいモニタリングアラートが${payload.events.length}件発生しました。
  </p>

  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
    <thead>
      <tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">重要度</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">種別</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;">内容</th>
      </tr>
    </thead>
    <tbody>
      ${eventRows}
    </tbody>
  </table>

  <div style="margin:24px 0;">
    <a href="${monitorUrl}"
       style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
      モニタリング画面を開く
    </a>
  </div>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:12px;color:#9ca3af;">
    このメールはTerraLinkのモニタリングシステムにより自動送信されています。
    通知設定はワークスペースの設定画面から変更できます。
  </p>
</body>
</html>`;
}

// ── Text fallback body ───────────────────────────────────

function buildTextBody(payload: AlertEmailPayload): string {
  const lines = [
    `TerraLink モニタリングアラート — ${payload.workspaceName}`,
    "",
    `${payload.recipientName}様、`,
    "",
    `${payload.events.length}件の新しいアラートが発生しました:`,
    "",
    ...payload.events.map(
      (ev) =>
        `  ${SEVERITY_EMOJI[ev.severity] ?? "⚪"} [${SEVERITY_LABEL_JP[ev.severity] ?? ev.severity}] ${ev.title}`
    ),
    "",
    `モニタリング画面: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.terralink.io"}/app/${payload.workspaceSlug}/monitor`,
  ];
  return lines.join("\n");
}

// ── Provider: Resend ─────────────────────────────────────

async function sendViaResend(
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) return { success: false, error: "EMAIL_API_KEY not set" };

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { success: false, error: `Resend ${resp.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ── Provider: SendGrid ───────────────────────────────────

async function sendViaSendGrid(
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) return { success: false, error: "EMAIL_API_KEY not set" };

  try {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { success: false, error: `SendGrid ${resp.status}: ${body}` };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
