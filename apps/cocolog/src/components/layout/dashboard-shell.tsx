"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { ContentHeader } from "./content-header";

interface DashboardShellProps {
  displayName: string;
  avatarUrl: string | null;
  children: ReactNode;
}

export function DashboardShell({
  displayName,
  avatarUrl,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col md:ml-60">
        <ContentHeader
          displayName={displayName}
          avatarUrl={avatarUrl}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
