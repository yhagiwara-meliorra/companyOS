"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  MapPin,
  FileCheck,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/supplier", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/supplier/profile", label: "プロファイル", icon: Building2 },
  { href: "/supplier/sites", label: "サイト", icon: MapPin },
  { href: "/supplier/evidence", label: "証憑", icon: FileCheck },
];

const ROLE_LABEL: Record<string, string> = {
  org_owner: "オーナー",
  org_admin: "管理者",
  contributor: "コントリビューター",
  viewer: "閲覧者",
};

type Props = {
  organization: {
    id: string;
    display_name: string;
    legal_name: string;
    org_type: string;
  };
  membership: {
    id: string;
    role: string;
  };
  children: React.ReactNode;
};

export function SupplierShell({ organization, membership, children }: Props) {
  const pathname = usePathname();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/supplier" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-primary">
              TerraLink
            </span>
            <span className="text-[10px] text-muted-foreground">
              サプライヤーポータル
            </span>
          </Link>
        </div>

        {/* Organization info */}
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold truncate">
            {organization.display_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {ROLE_LABEL[membership.role] ?? membership.role}
          </p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/supplier"
                ? pathname === "/supplier"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="border-t p-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                ログアウト
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">ログアウト</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
