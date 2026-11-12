"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import TelegramLinkBanner from "@/components/TelegramLinkBanner";
import FinanceIcon, { type FinanceIconName } from "@/components/FinanceIcon";

const NAV_ITEMS: { href: string; label: string; icon: FinanceIconName }[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  {
    href: "/dashboard/transactions",
    label: "Transactions",
    icon: "transactions",
  },
  { href: "/dashboard/wallets", label: "Wallets", icon: "wallet" },
  { href: "/dashboard/categories", label: "Categories", icon: "categories" },
  { href: "/dashboard/reports", label: "Reports", icon: "reports" },
];

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [user, isLoading, router]);

  if (isLoading)
    return (
      <div className="workspace-loading" role="status">
        Opening your workspace…
      </div>
    );
  if (!user) return null;
  const activePage =
    NAV_ITEMS.find(
      (item) => item.href !== "/dashboard" && pathname.startsWith(item.href),
    )?.label ?? "Overview";

  return (
    <div className="finance-app">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="app-sidebar">
        <Link href="/dashboard" className="app-brand">
          <span className="brand-mark">
            <FinanceIcon name="reports" />
          </span>
          <span>
            Finance
            <span className="brand-subtitle">A little more clarity.</span>
          </span>
        </Link>
        <p className="sidebar-caption">YOUR WORKSPACE</p>
        <nav className="app-navigation" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`app-nav-link ${active ? "is-active" : ""}`}
              >
                <FinanceIcon name={item.icon} />
                {item.label}
                {active && <span className="nav-active-dot" />}
              </Link>
            );
          })}
        </nav>
        <details className="telegram-settings">
          <summary>
            <span
              className={`connection-dot ${user.telegramId ? "is-connected" : ""}`}
            />
            <span className="telegram-name">Telegram</span>
            <span className="telegram-state">
              {user.telegramId ? "Connected" : "Not linked"}
            </span>
            <span className="telegram-chevron" aria-hidden="true">
              ⌄
            </span>
          </summary>
          <div>
            <TelegramLinkBanner />
          </div>
        </details>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <FinanceIcon name="spark" />
            <p>
              Small habits.
              <br />
              <strong>Bigger possibilities.</strong>
            </p>
            <span>
              Make space for what matters by knowing where your money goes.
            </span>
          </div>
          <button
            className="app-signout"
            onClick={() => {
              logout();
              router.push("/login");
              router.refresh();
            }}
          >
            <FinanceIcon name="logout" />
            Sign out
          </button>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-topbar">
          <div className="app-breadcrumb">
            Workspace <span>/</span> <strong>{activePage}</strong>
          </div>
          <div className="app-profile">
            <span className="currency-badge">
              IDR <span>Indonesian Rupiah</span>
            </span>
            <span className="profile-avatar">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </span>
            <span className="profile-name">{user.name || user.email}</span>
            <button
              className="mobile-signout"
              aria-label="Sign out"
              onClick={() => {
                logout();
                router.push("/login");
                router.refresh();
              }}
            >
              <FinanceIcon name="logout" />
            </button>
          </div>
        </header>
        <main id="main-content" className="app-main">
          {children}
          <footer className="app-footer">
            <span>Finance Tracker</span>
            <span>A clearer view. One transaction at a time.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
