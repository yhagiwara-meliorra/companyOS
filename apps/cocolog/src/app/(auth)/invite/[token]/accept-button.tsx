"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AcceptButtonProps {
  token: string;
  orgName: string;
  isLoggedIn: boolean;
}

export function AcceptButton({ token, orgName, isLoggedIn }: AcceptButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    if (isLoggedIn) {
      // Already logged in — call accept API directly
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setLoading(false);
      } else {
        window.location.href = "/dashboard";
      }
    } else {
      // Not logged in — redirect to Slack OIDC with next=/invite/TOKEN
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "slack_oidc",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/invite/${token}`,
        },
      });
      if (authError || !data?.url) {
        setError("ログインに失敗しました。もう一度お試しください。");
        setLoading(false);
      }
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleAccept}
        disabled={loading}
        className="w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
      >
        {loading
          ? "処理中..."
          : isLoggedIn
            ? `${orgName}に参加する`
            : "Slackでログインして参加"}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
