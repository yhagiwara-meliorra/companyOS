"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, Settings, Users, LogOut } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";

interface ContentHeaderProps {
  displayName: string;
  avatarUrl: string | null;
  onMenuToggle: () => void;
}

export function ContentHeader({
  displayName,
  avatarUrl,
  onMenuToggle,
}: ContentHeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-light bg-surface-raised px-4 sm:px-6">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Spacer on desktop */}
      <div className="hidden md:block" />

      {/* Account dropdown */}
      <Dropdown
        trigger={
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
                {initials}
              </div>
            )}
            <span className="hidden text-sm font-medium text-slate-700 sm:block">
              {displayName}
            </span>
          </div>
        }
      >
        <DropdownItem href="/dashboard/settings">
          <Settings className="mr-2 h-4 w-4" />
          設定
        </DropdownItem>
        <DropdownItem href="/dashboard/members">
          <Users className="mr-2 h-4 w-4" />
          メンバー管理
        </DropdownItem>
        <div className="my-1 border-t border-border-light" />
        <DropdownItem onClick={handleSignOut} variant="danger">
          <LogOut className="mr-2 h-4 w-4" />
          ログアウト
        </DropdownItem>
      </Dropdown>
    </header>
  );
}
