import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Company Builder OS",
  description: "AI CEO driven operating system for company building",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <div className="brand-mark">AI</div>
              <div>
                <div className="brand-title">Company Builder OS</div>
                <div className="brand-subtitle">AI CEO Studio</div>
              </div>
            </div>

            <nav className="topnav" aria-label="Primary">
              <Link className="nav-link" href="/threads/new">新規スレッド</Link>
              <Link className="nav-link" href="/approvals">承認待ち</Link>
            </nav>
          </header>
          <main className="page-wrap">{children}</main>
        </div>
      </body>
    </html>
  );
}
