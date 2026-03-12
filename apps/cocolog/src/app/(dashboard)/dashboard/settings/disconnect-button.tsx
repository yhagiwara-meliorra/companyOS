"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectSlack } from "./actions";

interface DisconnectButtonProps {
  installationId: string;
  teamName: string;
}

export function DisconnectButton({ installationId, teamName }: DisconnectButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    setLoading(true);
    const formData = new FormData();
    formData.set("installation_id", installationId);
    await disconnectSlack(formData);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-600">
          {teamName}を解除しますか？
        </span>
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={loading}
          className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "解除中..." : "解除する"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-md border border-border-light px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          キャンセル
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
    >
      解除
    </button>
  );
}
