"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { label: "ダッシュボード", href: "/dashboard" },
  { label: "メンバー", href: "/dashboard/people" },
  { label: "ダイジェスト", href: "/dashboard/digests" },
  { label: "分析", href: "/dashboard/analytics" },
  { label: "設定", href: "/dashboard/settings" },
] as const;

interface TopNavProps {
  displayName: string;
}

export function TopNav({ displayName }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="border-b border-border-light bg-surface-raised">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-lg font-bold text-primary-600">
            Cocolog
          </Link>
          <nav className="flex gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{displayName}</span>
          <button
            onClick={handleSignOut}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
