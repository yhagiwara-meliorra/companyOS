"use client";

import { useState, type ReactNode } from "react";

interface AnalyticsTabsProps {
  orgContent: ReactNode;
  toneContent: ReactNode;
}

const TABS = [
  { id: "org", label: "組織分析" },
  { id: "tone", label: "個人分析" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AnalyticsTabs({ orgContent, toneContent }: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("org");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-border-light">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "org" && orgContent}
      {activeTab === "tone" && toneContent}
    </div>
  );
}
