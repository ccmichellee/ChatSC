import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useGetEvents, useGetProfile, useGetRecommendations, useGetSummary, useRefreshEvents, getGetRecommendationsQueryKey, getGetEventsQueryKey, getGetSummaryQueryKey, type CampusEvent } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { EventCard, EventDialog } from "@/components/events-ui";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/bits";
import { isConflict, timeAgo } from "@/lib/campus";
import { upcomingEvents } from "@/lib/upcoming-events";
import { TojiSection } from "@/components/toji";

export default function Home() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile } = useGetProfile();
  const user = profile?.onboarded ? profile.user : "";
  const events = useGetEvents();
  const summary = useGetSummary();
  const recs = useGetRecommendations({ user }, { query: { enabled: !!user, queryKey: getGetRecommendationsQueryKey({ user }) } });
  const refresh = useRefreshEvents();
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const blocks = profile?.availability ?? [];
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", tick); };
  }, []);
  const next4 = useMemo(() => upcomingEvents(events.data ?? [], now), [events.data, now]);

  const doRefresh = () => refresh.mutate(undefined, {
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: ["/api/recommendations"] });
      toast({ title: "Feed refreshed", description: r.message || `${r.count} events loaded.` });
    },
    onError: () => toast({ title: "Refresh failed", description: "Please try again in a moment.", variant: "destructive" }),
  });

  const s = summary.data;
  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 pt-8 md:pt-14 grid md:grid-cols-[1.15fr_1fr] gap-8 items-center">
        <div className="rise">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{profile?.name ? `Hey ${profile.name}, ` : ""}Your between-classes guide</p>
          <h1 className="font-display text-[2.4rem] leading-[1.02] md:text-6xl font-extrabold tracking-tight mt-3 text-balance" data-testid="text-hero">
            Find clubs, events, and opportunities that fit your interests <span className="relative inline-block"><span className="relative z-10">and your class schedule</span><span className="absolute left-0 right-0 bottom-1 h-3 md:h-4 bg-accent -z-0 rounded-sm" aria-hidden /></span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-lg">Got 50 minutes before your next lecture? ChatSC knows what is happening on campus and when you are actually free.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/onboarding" data-testid="button-get-started" className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-semibold hover:-translate-y-0.5 transition-transform shadow-[0_10px_24px_-10px_hsl(0_100%_30%/0.6)]">
              {profile?.onboarded ? "Update my preferences" : "Get started"} <ArrowRight size={18} />
            </Link>
            <Link href="/events" data-testid="link-browse" className="inline-flex items-center gap-2 rounded-full border-2 border-foreground px-6 py-3 font-semibold hover:bg-foreground hover:text-background transition-colors">Browse events</Link>
          </div>
        </div>
        <div className="rise relative" style={{ animationDelay: "120ms" }}>
          <div className="absolute -inset-3 bg-accent rounded-[2.5rem] rotate-2" aria-hidden />
          <img src={`${import.meta.env.BASE_URL}usc-bovard.jpg`} alt="Real photograph of Bovard Auditorium at the University of Southern California" width={1536} height={1024} fetchPriority="high" className="relative rounded-[2rem] w-full aspect-[4/3] object-cover object-[50%_45%] border-4 border-card" />
          <div className="absolute -bottom-4 -left-3 bg-card rounded-2xl border border-card-border px-4 py-2 shadow-lg stamp">
            <p className="font-mono text-[10px] uppercase text-muted-foreground">Feed</p>
            <p className="text-sm font-semibold">{s ? timeAgo(s.last_updated) : "loading..."}</p>
          </div>
          <p className="relative mt-6 text-[10px] text-muted-foreground text-right">
            Photo: <a className="underline" href="https://commons.wikimedia.org/wiki/File:USC_Bovard_Auditorium.jpg" target="_blank" rel="noreferrer">Brion Vibber / Wikimedia Commons</a>
            {" · "}<a className="underline" href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a> · Cropped to fit
          </p>
        </div>
      </section>

      <TojiSection />

      <section aria-label="Campus at a glance" className="max-w-6xl mx-auto px-4 mt-14 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["Events", s?.events, "/events"], ["Clubs", s?.clubs, "/clubs"], ["Opportunities", s?.opportunities, "/opportunities"], ["With free food", s?.free_food, "/events"]].map(([label, n, href]) => (
          <Link key={label as string} href={href as string} className="rounded-3xl bg-card border border-card-border p-4 hover:-translate-y-1 transition-transform" data-testid={`stat-${(label as string).toLowerCase().replace(/ /g, "-")}`}>
            <p className="font-display text-4xl font-extrabold text-primary">{summary.isLoading ? <span className="inline-block w-10 h-8 bg-muted rounded animate-pulse" /> : (n as number | undefined) ?? "–"}</p>
            <p className="text-sm text-muted-foreground mt-1">{label as string}</p>
          </Link>
        ))}
        {s?.sample_data && <p className="col-span-full font-mono text-[11px] text-muted-foreground">Some listings are sample data, clearly labeled Sample.</p>}
      </section>

      {user && (
        <section className="mt-14 bg-primary text-primary-foreground py-10">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-end justify-between gap-4">
              <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Picked for you</p><h2 className="font-display text-3xl font-extrabold mt-1">Recommended around your classes</h2></div>
            </div>
            <div className="mt-6 flex gap-4 overflow-x-auto no-scrollbar snap-x pb-2 text-foreground">
              {recs.isLoading && <div className="flex gap-4 [&>*]:w-72 [&>*]:shrink-0"><CardSkeleton n={3} /></div>}
              {recs.isError && <div className="w-full"><ErrorState what="recommendations" onRetry={() => recs.refetch()} /></div>}
              {recs.data?.length === 0 && <p className="text-primary-foreground/80">No matches yet. Try adding more interests in your preferences.</p>}
              {recs.data?.map((e) => <div key={e.id} className="w-72 md:w-80 shrink-0 snap-start"><EventCard ev={e} conflict={isConflict(e, blocks)} onOpen={() => setOpen(e)} /></div>)}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-4 mt-14">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div><p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Coming up</p><h2 className="font-display text-3xl font-extrabold mt-1">Next 4 events</h2></div>
          <button onClick={doRefresh} disabled={refresh.isPending} data-testid="button-refresh" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold disabled:opacity-60">
            <RefreshCw size={14} className={refresh.isPending ? "animate-spin" : ""} />{refresh.isPending ? "Refreshing" : "Refresh feed"}
          </button>
        </div>
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {events.isLoading && <CardSkeleton n={4} />}
          {events.isError && <ErrorState what="events" onRetry={() => events.refetch()} />}
          {events.data && next4.length === 0 && <EmptyState title="Nothing scheduled ahead" body="No upcoming events with confirmed times right now. Check the full list or refresh the feed." action={<Link href="/events" className="text-primary font-semibold underline">See all events</Link>} />}
          {next4.map((e) => <EventCard key={e.id} ev={e} conflict={isConflict(e, blocks)} onOpen={() => setOpen(e)} />)}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 mt-14 grid md:grid-cols-3 gap-4">
        <Link href="/map" className="md:col-span-2 rounded-3xl bg-foreground text-background p-7 hover:-translate-y-1 transition-transform">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Walk it</p>
          <p className="font-display text-3xl font-extrabold mt-2">See what's a five-minute walk from your next class.</p>
          <span className="inline-flex items-center gap-1 mt-4 font-semibold">Open the map <ArrowRight size={16} /></span>
        </Link>
        <Link href="/calendar" className="rounded-3xl bg-accent text-accent-foreground p-7 hover:-translate-y-1 transition-transform">
          <p className="font-mono text-xs uppercase tracking-[0.2em]">Plan it</p>
          <p className="font-display text-2xl font-extrabold mt-2">Layer events over your class week.</p>
          <span className="inline-flex items-center gap-1 mt-4 font-semibold">Calendar <ArrowRight size={16} /></span>
        </Link>
      </section>
      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? isConflict(open, blocks) : false} />
    </div>
  );
}
