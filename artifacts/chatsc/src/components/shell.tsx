import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useGetProfile } from "@workspace/api-client-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/map", label: "Map" },
  { href: "/calendar", label: "Calendar" },
  { href: "/clubs", label: "Clubs" },
  { href: "/opportunities", label: "Opportunities" },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { data: profile } = useGetProfile();
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] bg-accent text-accent-foreground px-4 py-2 rounded-full font-semibold">Skip to content</a>
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-logo">
            <span className="grid place-items-center w-8 h-8 rounded-xl bg-primary text-primary-foreground font-display font-extrabold">C</span>
            <span className="font-display text-xl font-extrabold tracking-tight">Chat<span className="text-primary">SC</span></span>
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 ml-6">
            {links.map((l) => <NavLink key={l.href} {...l} active={loc === l.href} />)}
          </nav>
          <Link href="/onboarding" data-testid="link-onboarding"
            className="ml-auto rounded-full px-4 py-1.5 text-sm font-semibold bg-primary text-primary-foreground hover:-translate-y-0.5 transition-transform">
            {profile?.onboarded ? "Preferences" : "Get started"}
          </Link>
        </div>
        <nav aria-label="Primary mobile" className="md:hidden flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2">
          {links.map((l) => <NavLink key={l.href} {...l} active={loc === l.href} />)}
        </nav>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-muted-foreground flex flex-col md:flex-row gap-2 justify-between">
          <p><span className="font-display font-bold text-foreground">ChatSC</span> is an independent student guide, not an official USC service.</p>
          <p className="font-mono text-xs">All times shown in Los Angeles time. Items marked Sample are fictional.</p>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} data-testid={`link-nav-${label.toLowerCase()}`}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-foreground text-background" : "hover:bg-secondary"}`}>
      {label}
    </Link>
  );
}
