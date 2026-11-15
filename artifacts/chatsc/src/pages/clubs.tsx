import { useDeferredValue, useMemo, useState } from "react";
import { Clock, ExternalLink, Search } from "lucide-react";
import { useGetClubs } from "@workspace/api-client-react";
import { CardSkeleton, EmptyState, ErrorState, PageHead, SampleBadge, Tag } from "@/components/bits";

export default function Clubs() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const dq = useDeferredValue(q);
  const params = useMemo(() => { const p: { q?: string; category?: string } = {}; if (dq.trim()) p.q = dq.trim(); if (category) p.category = category; return Object.keys(p).length ? p : undefined; }, [dq, category]);
  const all = useGetClubs();
  const clubs = useGetClubs(params);
  const cats = useMemo(() => Array.from(new Set((all.data ?? []).map((c) => c.category))).filter(Boolean).sort(), [all.data]);
  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead kicker="Clubs" title="Find your people">From a cappella to rocketry. Every club lists when it meets, so you can see if it fits.</PageHead>
      <div role="search" className="flex flex-col gap-3">
        <label className="relative max-w-xl">
          <span className="sr-only">Search clubs</span>
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clubs by name or mission" data-testid="input-club-search" className="h-11 w-full rounded-full bg-card border border-input pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Categories">
          <Tag active={!category} onClick={() => setCategory("")}>All</Tag>
          {cats.map((c) => <Tag key={c} active={category === c} onClick={() => setCategory(category === c ? "" : c)}>{c}</Tag>)}
        </div>
      </div>
      <div className="mt-6 columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {clubs.isLoading && <CardSkeleton n={6} />}
        {clubs.isError && <ErrorState what="clubs" onRetry={() => clubs.refetch()} />}
        {clubs.data?.length === 0 && <EmptyState title="No clubs found" body="Try a different word or category." />}
        {clubs.data?.map((c, i) => (
          <article key={c.id} className={`rounded-3xl border p-5 transition-transform hover:-translate-y-1 ${i % 5 === 0 ? "bg-foreground text-background border-foreground" : "bg-card border-card-border"}`} data-testid={`card-club-${c.id}`}>
            <div className="flex items-center gap-2"><span className={`font-mono text-[11px] uppercase tracking-wider ${i % 5 === 0 ? "text-accent" : "text-primary"}`}>{c.category}</span><SampleBadge show={c.sample_data} /></div>
            <h3 className="font-display text-xl font-bold mt-2">{c.name}</h3>
            <p className={`text-sm mt-2 leading-relaxed ${i % 5 === 0 ? "text-background/80" : "text-muted-foreground"}`}>{c.description}</p>
            <p className="text-sm mt-3 flex gap-2 items-start"><Clock size={15} className="mt-0.5 shrink-0" />{c.meeting_times || "Meeting times not listed"}</p>
            {c.source_url && <a href={c.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4" data-testid={`link-club-${c.id}`}>Visit club page <ExternalLink size={13} /></a>}
          </article>
        ))}
      </div>
    </div>
  );
}
