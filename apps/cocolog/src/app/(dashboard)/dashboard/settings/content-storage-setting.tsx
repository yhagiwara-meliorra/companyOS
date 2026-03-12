"use client";

import { useState, useTransition } from "react";
import { updateContentStorage } from "./actions";

interface ContentStorageSettingProps {
  currentValue: boolean;
  isOwnerOrAdmin: boolean;
}

export function ContentStorageSetting({
  currentValue,
  isOwnerOrAdmin,
}: ContentStorageSettingProps) {
  const [enabled, setEnabled] = useState(currentValue);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    if (!isOwnerOrAdmin) return;
    const newValue = !enabled;
    setEnabled(newValue);

    const formData = new FormData();
    formData.set("store_message_content", newValue ? "true" : "false");
    startTransition(() => {
      updateContentStorage(formData);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">
            メッセージ本文を保存する
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            有効にすると、アクティビティフィードでコメント内容を確認できます。
            無効の場合、スコアと分類のみ保存されます。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!isOwnerOrAdmin || isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            enabled ? "bg-primary-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      {!isOwnerOrAdmin && (
        <p className="text-xs text-slate-400">
          この設定はオーナーまたは管理者のみ変更できます。
        </p>
      )}
      {isPending && (
        <p className="text-xs text-slate-400">保存中...</p>
      )}
    </div>
  );
}
