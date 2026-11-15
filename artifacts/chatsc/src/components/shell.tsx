import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useResetPersonalization } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { AccessibilityWidget } from "@/components/accessibility-widget";

const links = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/map", label: "Map" },
  { href: "/calendar", label: "Calendar" },
  { href: "/clubs", label: "Discover" },
  { href: "/opportunities", label: "Opportunities" },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const queryClient = useQueryClient();
  const reset = useResetPersonalization();
  const { toast } = useToast();
  const resetView = () => reset.mutate(undefined, {
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      window.location.assign(import.meta.env.BASE_URL);
    },
    onError: () => toast({
      title: "Couldn't reset personalization",
      description: "Nothing was changed in your view. Please try again.",
      variant: "destructive",
    }),
  });
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] bg-accent text-accent-foreground px-4 py-2 rounded-full font-semibold">Skip to content</a>
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-logo">
            <img src={`${import.meta.env.BASE_URL}usc-logo.webp`} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" />
            <span className="font-display text-xl font-extrabold tracking-tight text-[#990000]">Chat<span className="text-[#FFCC00]">SC</span></span>
          </Link>
          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 ml-6">
            {links.map((l) => <NavLink key={l.href} {...l} active={loc === l.href} />)}
          </nav>
          <Link href="/onboarding" data-testid="link-onboard"
            className="ml-auto rounded-full px-4 py-1.5 text-sm font-semibold bg-primary text-primary-foreground hover:-translate-y-0.5 transition-transform">
            Onboard
          </Link>
        </div>
        <nav aria-label="Primary mobile" className="md:hidden flex gap-1 overflow-x-auto no-scrollbar px-3 pb-2">
          {links.map((l) => <NavLink key={l.href} {...l} active={loc === l.href} />)}
        </nav>
      </header>
      <main id="main" className="min-w-0 flex-1">{children}</main>
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-muted-foreground flex flex-col md:flex-row gap-2 justify-between">
          <p><span className="font-display font-bold text-[#990000]">Chat<span className="text-[#FFCC00]">SC</span></span> is an independent student guide, not an official USC service.</p>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <Link href="/privacy" className="underline" data-testid="link-privacy">Privacy (draft)</Link>
            <Link href="/terms" className="underline" data-testid="link-terms">Terms (draft)</Link>
            <button type="button" onClick={resetView} disabled={reset.isPending} data-testid="button-reset-personalization" title="Clear this browser's personalization without deleting saved profiles" className="min-h-8 text-left underline underline-offset-2 hover:text-primary disabled:cursor-wait disabled:opacity-60">
              {reset.isPending ? "Resetting…" : "Reset personalization"}
            </button>
          </div>
          <p className="font-mono text-xs">All times shown in Los Angeles time. Items marked Sample are fictional.</p>
        </div>
      </footer>
      <AccessibilityWidget />
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
