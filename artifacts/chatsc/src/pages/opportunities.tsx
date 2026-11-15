import { useMemo, useState } from "react";
import { Building2, CalendarClock, MapPin } from "lucide-react";
import { useGetOpportunities, type Opportunity } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CardSkeleton, EmptyState, ErrorState, PageHead, SampleBadge, Tag } from "@/components/bits";
import { fmtDay } from "@/lib/campus";
import { OrganizationLogo } from "@/components/organization-logo";

const WEEK = 7 * 864e5;
export default function Opportunities() {
  const opps = useGetOpportunities();
  const [type, setType] = useState("");
  const [apply, setApply] = useState<Opportunity | null>(null);
  const types = useMemo(() => Array.from(new Set((opps.data ?? []).map((o) => o.type))).sort(), [opps.data]);
  const list = useMemo(() => (opps.data ?? []).filter((o) => !type || o.type === type).sort((a, b) => {
    if (!a.deadline) return 1; if (!b.deadline) return -1;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  }), [opps.data, type]);
  const now = Date.now();
  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead kicker="Opportunities" title="Jobs, research, and things worth applying to" />
      <div className="flex flex-wrap gap-2" aria-label="Type filter">
        <Tag active={!type} onClick={() => setType("")}>All types</Tag>
        {types.map((t) => <Tag key={t} active={type === t} onClick={() => setType(type === t ? "" : t)}>{t}</Tag>)}
        <span className="ml-auto font-mono text-xs text-muted-foreground self-center">Sorted by deadline</span>
      </div>
      <div className="mt-6 space-y-3">
        {opps.isLoading && <CardSkeleton n={4} />}
        {opps.isError && <ErrorState what="opportunities" onRetry={() => opps.refetch()} />}
        {opps.data && list.length === 0 && <EmptyState title="Nothing here yet" body="No opportunities of this type right now." />}
        {list.map((o) => {
          const t = o.deadline ? new Date(o.deadline).getTime() : NaN;
          const soon = !isNaN(t) && t >= now - 864e5 && t - now <= WEEK;
          return (
            <article key={o.id} className={`rounded-3xl border p-5 grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_auto] gap-4 items-center transition-transform hover:-translate-y-0.5 ${soon ? "bg-accent/20 border-accent border-2" : "bg-card border-card-border"}`} data-testid={`card-opp-${o.id}`}>
              <div className="self-start"><OrganizationLogo organization={o.organization} /></div>
              <div className="min-w-0 break-words">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] uppercase tracking-wider text-primary">{o.type}</span><SampleBadge show={o.sample_data} />{soon && <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[10px] font-bold uppercase">Due within 7 days</span>}</div>
                <h3 className="font-display text-xl font-bold mt-1">{o.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{o.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                  <span className="flex items-center gap-1"><Building2 size={14} className="text-primary" />{o.organization}</span>
                  <span className="flex items-center gap-1"><MapPin size={14} className="text-primary" />{o.location}</span>
                  <span className="flex items-center gap-1"><CalendarClock size={14} className="text-primary" />{o.deadline ? `Due ${fmtDay(o.deadline)}` : "Rolling deadline"}</span>
                </div>
              </div>
              <button onClick={() => setApply(o)} data-testid={`button-apply-${o.id}`} className="col-span-2 md:col-span-1 rounded-full bg-primary text-primary-foreground px-5 py-2.5 font-semibold hover:-translate-y-0.5 transition-transform">Apply</button>
            </article>
          );
        })}
      </div>
      <Dialog open={!!apply} onOpenChange={(o) => !o && setApply(null)}>
        <DialogContent className="rounded-3xl bg-card">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold">This is a demo listing</DialogTitle>
            <DialogDescription>"{apply?.title}" at {apply?.organization} is fictional sample data.</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed">No real application exists and nothing will be submitted. In a live version of ChatSC, this button would take you to the organization's official application page.</p>
          <button onClick={() => setApply(null)} className="rounded-full bg-primary text-primary-foreground px-5 py-2.5 font-semibold" data-testid="button-close-apply">Got it</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
