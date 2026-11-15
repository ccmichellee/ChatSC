import { useDeferredValue, useMemo, useState } from "react";
import { Clock, ExternalLink, Search } from "lucide-react";
import { useGetClubs, type Club } from "@workspace/api-client-react";
import { CardSkeleton, EmptyState, ErrorState, PageHead, SampleBadge, Tag } from "@/components/bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CLUB_CATEGORIES, clubCategory } from "@/lib/club-categories";

export default function Clubs() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<Club | null>(null);
  const dq = useDeferredValue(q);
  const params = useMemo(() => dq.trim() ? { q: dq.trim() } : undefined, [dq]);
  const clubs = useGetClubs(params);
  const filtered = (clubs.data ?? []).filter((c) => !category || clubCategory(c.category) === category);
  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead kicker="Clubs" title="Find your people">From a cappella to rocketry. Explore clubs and find your community.</PageHead>
      <div role="search" className="flex flex-col gap-3">
        <label className="relative max-w-xl">
          <span className="sr-only">Search clubs</span>
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clubs by name or mission" data-testid="input-club-search" className="h-11 w-full rounded-full bg-card border border-input pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </label>
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 [&>*]:shrink-0 [&>*]:whitespace-nowrap" aria-label="Categories">
          <Tag active={!category} onClick={() => setCategory("")}>All</Tag>
          {CLUB_CATEGORIES.map((c) => <Tag key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>{c}</Tag>)}
        </div>
      </div>
      <div className="mt-6 columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {clubs.isLoading && <CardSkeleton n={6} />}
        {clubs.isError && <ErrorState what="clubs" onRetry={() => clubs.refetch()} />}
        {!clubs.isLoading && !clubs.isError && filtered.length === 0 && <EmptyState title="No clubs found" body="Try a different word or category." />}
        {filtered.map((c, i) => (
          <article key={c.id} className={`rounded-3xl border p-5 transition-transform hover:-translate-y-1 ${i % 5 === 0 ? "bg-foreground text-background border-foreground" : "bg-card border-card-border"}`} data-testid={`card-club-${c.id}`}>
            <div className="flex items-center gap-2"><span className={`font-mono text-[11px] uppercase tracking-wider ${i % 5 === 0 ? "text-accent" : "text-primary"}`}>{clubCategory(c.category)}</span><SampleBadge show={c.sample_data} /></div>
            <h3 className="font-display text-xl font-bold mt-2">{c.name}</h3>
            <p className={`text-sm mt-2 truncate ${i % 5 === 0 ? "text-background/80" : "text-muted-foreground"}`}>{c.description.length > 100 ? `${c.description.slice(0, 97).trimEnd()}…` : c.description}</p>
            <button type="button" onClick={() => setOpen(c)} className="mt-4 text-sm font-semibold underline underline-offset-4" data-testid={`link-club-${c.id}`}>Learn more</button>
          </article>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="rounded-3xl bg-card max-w-lg max-h-[85vh] overflow-y-auto">
          {open && <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{open.name}</DialogTitle>
              <DialogDescription>{clubCategory(open.category)}</DialogDescription>
            </DialogHeader>
            <SampleBadge show={open.sample_data} />
            <p className="text-sm whitespace-pre-line leading-relaxed">{open.description || "No description provided."}</p>
            <p className="text-sm flex gap-2"><Clock size={15} className="shrink-0" />{open.meeting_times || "Meeting times not listed"}</p>
            <p className="text-xs text-muted-foreground">Original categories: {open.category}</p>
            {/^https?:\/\//.test(open.source_url) && <a href={open.source_url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline inline-flex gap-1 items-center">Visit club page <ExternalLink size={13} /></a>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
