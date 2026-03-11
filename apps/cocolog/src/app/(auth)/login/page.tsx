"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();

  async function handleSlackLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "slack_oidc",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm rounded-xl bg-surface-raised p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Cocolog</h1>
          <p className="mt-2 text-sm text-slate-500">
            AIコミュニケーションコーチング
          </p>
        </div>
        <button
          onClick={handleSlackLogin}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#4A154B] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#611f69] focus:outline-none focus:ring-2 focus:ring-[#4A154B] focus:ring-offset-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 123 123"
            fill="none"
          >
            <path
              d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 1 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z"
              fill="#E01E5A"
            />
            <path
              d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 1 1 0 25.8H12.9a12.9 12.9 0 0 1 0-25.8h32.3z"
              fill="#36C5F0"
            />
            <path
              d="M97.2 45.2a12.9 12.9 0 1 1 12.9 12.9H97.2V45.2zm-6.5 0a12.9 12.9 0 1 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z"
              fill="#2EB67D"
            />
            <path
              d="M77.8 97.2a12.9 12.9 0 1 1-12.9 12.9V97.2h12.9zm0-6.5a12.9 12.9 0 1 1 0-25.8h32.3a12.9 12.9 0 0 1 0 25.8H77.8z"
              fill="#ECB22E"
            />
          </svg>
          Slackでログイン
        </button>
      </div>
    </div>
  );
}
