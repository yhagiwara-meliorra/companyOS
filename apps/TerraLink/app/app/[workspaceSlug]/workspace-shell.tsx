"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/auth/supabase-browser";
import type { Workspace, WorkspaceMember } from "@/lib/auth/workspace-context";
import {
  LayoutDashboard,
  Building2,
  MapPin,
  Network,
  Leaf,
  FileCheck,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
  Globe,
  Database,
  TreePine,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { label: "ダッシュボード", href: "", icon: LayoutDashboard },
  { label: "組織", href: "/orgs", icon: Building2 },
  { label: "サイト", href: "/sites", icon: MapPin },
  { label: "サプライチェーン", href: "/supply", icon: Network },
  { label: "データソース", href: "/sources", icon: Database },
  { label: "LEAP", href: "/leap", icon: Leaf },
  { label: "EUDR", href: "/eudr", icon: TreePine },
  { label: "証憑", href: "/evidence", icon: FileCheck },
  { label: "モニタリング", href: "/monitor", icon: Activity },
];

const BOTTOM_ITEMS = [
  { label: "設定", href: "/settings", icon: Settings },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "オーナー",
  admin: "管理者",
  analyst: "アナリスト",
  reviewer: "レビュアー",
  supplier_manager: "サプライヤー管理",
  viewer: "閲覧者",
};

export function WorkspaceShell({
  workspace,
  membership,
  children,
}: {
  workspace: Workspace;
  membership: WorkspaceMember;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/app/${workspace.slug}`;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function isActive(href: string) {
    const fullHref = `${base}${href}`;
    return href === ""
      ? pathname === base || pathname === `${base}/`
      : pathname.startsWith(fullHref);
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <aside className="flex w-[260px] flex-col border-r bg-muted/30">
          {/* Brand */}
          <div className="flex h-14 items-center gap-3 border-b px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">TerraLink</span>
              <span className="text-[10px] leading-tight text-muted-foreground">
                生物多様性リスク管理
              </span>
            </div>
          </div>

          {/* Workspace Switcher */}
          <Link
            href="/app"
            className="mx-3 mt-3 flex items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                {workspace.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate font-medium">{workspace.name}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>

          {/* Main Nav */}
          <nav className="mt-4 flex-1 space-y-0.5 px-3">
            <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-muted-foreground">
              プラットフォーム
            </p>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={`${base}${item.href}`}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active
                        ? "text-primary"
                        : "text-muted-foreground/70 group-hover:text-foreground"
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="px-3 pb-3">
            <Separator className="mb-2" />
            {BOTTOM_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={`${base}${item.href}`}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}

            {/* User / Sign Out */}
            <div className="mt-2 flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-secondary text-[10px] font-medium">
                  {membership.role.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium">
                  {ROLE_LABEL[membership.role] ?? membership.role}
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">ログアウト</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
