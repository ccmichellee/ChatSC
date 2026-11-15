import type { ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export function SampleBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return <span className="inline-flex items-center rounded-full border border-dashed border-primary/60 text-primary px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider" data-testid="badge-sample">Sample</span>;
}

export function Tag({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  const cls = `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`;
  if (onClick) return <button type="button" aria-pressed={!!active} onClick={onClick} className={`${cls} hover:-translate-y-0.5`}>{children}</button>;
  return <span className={cls}>{children}</span>;
}

export function PageHead({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="rise pt-8 pb-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{kicker}</p>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mt-2 text-balance">{title}</h1>
      {children && <div className="mt-3 text-muted-foreground max-w-2xl">{children}</div>}
    </div>
  );
}

export function CardSkeleton({ n = 3 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-3xl bg-card border border-card-border p-5 space-y-3 animate-pulse" aria-hidden>
          <div className="h-3 w-24 bg-muted rounded-full" />
          <div className="h-5 w-3/4 bg-muted rounded-full" />
          <div className="h-3 w-1/2 bg-muted rounded-full" />
          <div className="flex gap-2"><div className="h-5 w-14 bg-muted rounded-full" /><div className="h-5 w-16 bg-muted rounded-full" /></div>
        </div>
      ))}
    </>
  );
}

export function ErrorState({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="col-span-full rounded-3xl border border-destructive/30 bg-card p-8 text-center">
      <AlertTriangle className="mx-auto text-destructive" />
      <p className="font-display text-xl font-bold mt-2">Couldn't load {what}.</p>
      <p className="text-sm text-muted-foreground mt-1">The campus feed might be waking up. Give it another go.</p>
      <button onClick={onRetry} data-testid="button-retry" className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"><RotateCw size={14} /> Try again</button>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="col-span-full rounded-3xl border-2 border-dashed border-border p-10 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/40 grid place-items-center font-display text-2xl font-extrabold text-primary stamp">?</div>
      <p className="font-display text-xl font-bold mt-3">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
