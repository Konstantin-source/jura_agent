"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Files, Home, MessageSquareText, Settings } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { useRuntimeConfig } from "@/components/runtime-provider";

const navItems = [
  { href: "/", label: "Start", icon: Home },
  { href: "/lernen", label: "Lernen", icon: BookOpenText },
  { href: "/chats", label: "Chats", icon: MessageSquareText },
  { href: "/dokumente", label: "Dokumente", icon: Files },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

function NavLink({ href, label, icon: Icon, mobile = false }: (typeof navItems)[number] & { mobile?: boolean }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`${mobile ? "mobile-nav-link" : "side-nav-link"} ${active ? "is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={mobile ? 20 : 19} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const runtime = useRuntimeConfig();
  const isAuthPage = pathname === "/login" || pathname === "/setup";
  if (isAuthPage) return <>{children}</>;

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark />
        </div>
        <nav className="side-nav" aria-label="Hauptnavigation">
          <p className="nav-eyebrow">Lernbereich</p>
          {navItems.slice(0, 4).map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
          <p className="nav-eyebrow nav-eyebrow-spaced">Konto</p>
          <NavLink {...navItems[4]} />
        </nav>
        <div className="sidebar-foot">
          <div className="semester-card">
            <span className="semester-dot" aria-hidden="true" />
            <div>
              <strong>3. Semester</strong>
              <span>Köln · Wintersemester</span>
            </div>
          </div>
          <p>Nur zum Lernen · keine Rechtsberatung</p>
        </div>
      </aside>

      <div className="app-column">
        <header className="mobile-header">
          <BrandMark />
          {runtime.mode === "demo" && <span className="demo-pill">Demo</span>}
        </header>
        <main className="app-main">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile Hauptnavigation">
        {navItems.slice(0, 4).map((item) => (
          <NavLink key={item.href} {...item} mobile />
        ))}
      </nav>
    </div>
  );
}
