"use client";

import { useState } from "react";
import { updateAnalysisScope } from "./actions";

interface AnalysisScopeSettingProps {
  currentScope: string;
}

const scopeLabels: Record<string, { title: string; description: string }> = {
  all: {
    title: "全員を分析",
    description: "Botが参加しているチャンネルの全メンバーのメッセージを分析します。",
  },
  members_only: {
    title: "登録メンバーのみ",
    description: "Cocologにサインアップ済みのメンバーのメッセージのみ分析します（自分だけの分析に最適）。",
  },
};

export function AnalysisScopeSetting({ currentScope }: AnalysisScopeSettingProps) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(currentScope);
  const [saving, setSaving] = useState(false);
  const [savedScope, setSavedScope] = useState(currentScope);

  async function handleSave() {
    setSaving(true);
    const formData = new FormData();
    formData.set("analysis_scope", selected);
    await updateAnalysisScope(formData);
    setSavedScope(selected);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setSelected(savedScope);
    setEditing(false);
  }

  const current = scopeLabels[savedScope] ?? scopeLabels.members_only;

  if (!editing) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          チャンネル内のどのメッセージを分析対象にするか設定します。
        </p>
        <div className="flex items-center justify-between rounded-lg border border-border-light p-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{current.title}</p>
            <p className="text-xs text-slate-500">{current.description}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md border border-border-light px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            変更
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        チャンネル内のどのメッセージを分析対象にするか設定します。
      </p>
      <div className="space-y-2">
        {Object.entries(scopeLabels).map(([value, label]) => (
          <label
            key={value}
            className="flex items-start gap-3 rounded-lg border border-border-light p-3 cursor-pointer hover:bg-slate-50"
          >
            <input
              type="radio"
              name="analysis_scope"
              value={value}
              checked={selected === value}
              onChange={() => setSelected(value)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-slate-900">{label.title}</p>
              <p className="text-xs text-slate-500">{label.description}</p>
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
