"use client";

import { useActionState } from "react";
import { inviteWorkspaceMember } from "@/lib/domain/workspace-actions";

export function InviteMemberForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(inviteWorkspaceMember, {});

  return (
    <form action={action} className="mt-3 max-w-md space-y-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          メールアドレス
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="colleague@example.com"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium">
          役割
        </label>
        <select
          id="role"
          name="role"
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="analyst">アナリスト</option>
          <option value="admin">管理者</option>
          <option value="reviewer">レビュアー</option>
          <option value="supplier_manager">サプライヤー管理</option>
          <option value="viewer">閲覧者</option>
        </select>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && (
        <p className="text-sm text-green-600">招待を送信しました！</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "送信中..." : "招待を送信"}
      </button>
    </form>
  );
}
