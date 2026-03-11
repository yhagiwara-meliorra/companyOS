"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { createWorkspace } from "@/lib/domain/workspace-actions";
import type { Workspace } from "@/lib/auth/workspace-context";

type WorkspaceWithRole = Workspace & { role: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  analyst: "アナリスト",
  reviewer: "レビュアー",
  supplier_manager: "サプライヤー管理",
  viewer: "閲覧者",
};

export function WorkspaceSelector({
  workspaces,
}: {
  workspaces: WorkspaceWithRole[];
}) {
  const [showCreate, setShowCreate] = useState(workspaces.length === 0);
  const [state, action, pending] = useActionState(createWorkspace, {});

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">TerraLink</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ワークスペースを選択、または新規作成
        </p>
      </div>

      {/* Existing workspaces */}
      {workspaces.length > 0 && (
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <Link
              key={ws.id}
              href={`/app/${ws.slug}`}
              className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <div>
                <p className="font-medium">{ws.name}</p>
                <p className="text-xs text-muted-foreground">/{ws.slug}</p>
              </div>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                {ROLE_LABEL[ws.role] ?? ws.role}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Create workspace */}
      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full rounded-md border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          + 新しいワークスペースを作成
        </button>
      )}

      {showCreate && (
        <form action={action} className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">新しいワークスペース</h2>
          <div>
            <label htmlFor="name" className="block text-sm font-medium">
              名前
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="株式会社サンプル"
            />
          </div>
          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "作成中..." : "ワークスペースを作成"}
          </button>
        </form>
      )}
    </div>
  );
}
