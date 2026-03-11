import { NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";

export const runtime = "nodejs";

/**
 * POST /api/ingestion/trigger
 *
 * Triggers the Supabase Edge Function `ingest-source` either directly
 * via HTTP invocation or by enqueuing a pgmq message.
 *
 * Body: { dataSourceId: string, workspaceId?: string, mode?: "direct" | "queue" }
 *
 * - "queue" (default): Uses the enqueue_ingestion RPC to add a message
 *   to pgmq. The Edge Function polls or is triggered by a webhook.
 * - "direct": Invokes the Edge Function synchronously via HTTP.
 */
export async function POST(request: Request) {
  // 1. Authenticate user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  const body = await request.json().catch(() => null);
  if (!body?.dataSourceId) {
    return NextResponse.json(
      { error: "dataSourceId is required" },
      { status: 400 }
    );
  }

  const { dataSourceId, workspaceId, mode = "queue" } = body as {
    dataSourceId: string;
    workspaceId?: string;
    mode?: "direct" | "queue";
  };

  const admin = createAdminClient();

  // 3a. Queue mode — use enqueue_ingestion RPC
  if (mode === "queue") {
    const { data, error } = await admin.rpc("enqueue_ingestion", {
      p_data_source_id: dataSourceId,
      p_workspace_id: workspaceId ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      mode: "queue",
      runId: data,
    });
  }

  // 3b. Direct mode — invoke Supabase Edge Function via HTTP
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase config missing" },
      { status: 500 }
    );
  }

  const fnUrl = `${supabaseUrl}/functions/v1/ingest-source`;

  try {
    const resp = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        data_source_id: dataSourceId,
        workspace_id: workspaceId ?? null,
      }),
    });

    const result = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(
        { error: result.error ?? "Edge Function error", detail: result },
        { status: resp.status }
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "direct",
      result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
