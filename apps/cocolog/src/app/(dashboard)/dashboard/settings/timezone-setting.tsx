"use client";

import { useState, useEffect } from "react";
import { updateTimezone } from "./actions";

interface TimezoneSettingProps {
  currentTimezone: string;
}

export function TimezoneSetting({ currentTimezone }: TimezoneSettingProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detectedTz, setDetectedTz] = useState<string | null>(null);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDetectedTz(tz);
    } catch {
      // Fallback — browser doesn't support Intl
    }
  }, []);

  const needsUpdate = detectedTz && detectedTz !== currentTimezone;

  async function handleAutoDetect() {
    if (!detectedTz) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("timezone", detectedTz);
    await updateTimezone(formData);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleManualChange(tz: string) {
    setSaving(true);
    const formData = new FormData();
    formData.set("timezone", tz);
    await updateTimezone(formData);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // Common timezone options
  const timezones = [
    { value: "Asia/Tokyo", label: "日本標準時 (JST)" },
    { value: "America/New_York", label: "米国東部 (EST/EDT)" },
    { value: "America/Chicago", label: "米国中部 (CST/CDT)" },
    { value: "America/Denver", label: "米国山岳 (MST/MDT)" },
    { value: "America/Los_Angeles", label: "米国太平洋 (PST/PDT)" },
    { value: "Europe/London", label: "英国 (GMT/BST)" },
    { value: "Europe/Paris", label: "中央ヨーロッパ (CET/CEST)" },
    { value: "Asia/Shanghai", label: "中国標準時 (CST)" },
    { value: "Asia/Kolkata", label: "インド標準時 (IST)" },
    { value: "Australia/Sydney", label: "オーストラリア東部 (AEST/AEDT)" },
    { value: "Pacific/Auckland", label: "ニュージーランド (NZST/NZDT)" },
    { value: "UTC", label: "UTC" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-700">
            現在: <span className="font-medium">{currentTimezone}</span>
          </p>
          {detectedTz && (
            <p className="mt-0.5 text-xs text-slate-500">
              ブラウザ検出: {detectedTz}
            </p>
          )}
        </div>
        {needsUpdate && (
          <button
            type="button"
            onClick={handleAutoDetect}
            disabled={saving}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "自動検出に合わせる"}
          </button>
        )}
        {saved && (
          <span className="text-xs font-medium text-emerald-600">
            保存しました
          </span>
        )}
      </div>

      <div>
        <label htmlFor="timezone-select" className="block text-xs font-medium text-slate-500 mb-1">
          手動で選択
        </label>
        <select
          id="timezone-select"
          value={currentTimezone}
          onChange={(e) => handleManualChange(e.target.value)}
          disabled={saving}
          className="w-full rounded-md border border-border-light bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label} ({tz.value})
            </option>
          ))}
          {/* If current timezone isn't in the list, show it */}
          {!timezones.some((tz) => tz.value === currentTimezone) && (
            <option value={currentTimezone}>{currentTimezone}</option>
          )}
        </select>
      </div>
    </div>
  );
}
