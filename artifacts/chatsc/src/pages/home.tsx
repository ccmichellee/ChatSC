import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, Compass, MapPinned, Sparkles, UsersRound } from "lucide-react";
import { useGetProfile, useGetRecommendations, useGetSummary, getGetRecommendationsQueryKey, type CampusEvent } from "@workspace/api-client-react";
import { EventCard, EventDialog } from "@/components/events-ui";
import { CardSkeleton, ErrorState } from "@/components/bits";
import { isConflict } from "@/lib/campus";

export default function Home() {
  const { data: profile } = useGetProfile();
  const user = profile?.onboarded ? profile.user : "";
  const summary = useGetSummary();
  const recs = useGetRecommendations({ user }, { query: { enabled: !!user, queryKey: getGetRecommendationsQueryKey({ user }) } });
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const blocks = profile?.availability ?? [];

  const s = summary.data;
  const browse = [
    { title: "Campus events", detail: "Talks, gatherings, and things happening soon.", href: "/events", icon: CalendarDays, count: s?.events },
    { title: "Student clubs", detail: "Find communities built around what you care about.", href: "/clubs", icon: UsersRound, count: s?.clubs },
    { title: "Opportunities", detail: "Explore internships, programs, and next steps.", href: "/opportunities", icon: BriefcaseBusiness, count: s?.opportunities },
  ];

  return (
    <div className="pb-16">
      <section className="home-hero relative overflow-hidden">
        <div className="absolute left-0 top-0 h-full w-[5px] bg-primary" aria-hidden />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-14 pt-10 sm:px-8 md:min-h-[610px] md:grid-cols-[1.05fr_.95fr] md:gap-10 md:py-16 lg:px-12">
          <div className="rise relative z-10">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[.22em] text-primary">
              {profile?.onboarded && profile.name ? `For ${profile.name} · USC` : "A smarter way to find your place at USC"}
            </p>
            <h1 className="mt-5 max-w-3xl font-display text-[2.9rem] font-extrabold leading-[.99] tracking-[-.045em] text-balance sm:text-6xl lg:text-[4.55rem]" data-testid="text-hero">
              Campus has a lot going on.
              <span className="mt-2 block text-primary">Find what’s for you.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-foreground/75 sm:text-lg">
              ChatSC’s AI agent turns scattered USC events, clubs, internships, and programs into personalized, actionable recommendations—designed to text students the opportunities worth acting on.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/onboarding" data-testid="button-onboard" className="group inline-flex min-h-13 items-center justify-center gap-3 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-[0_12px_28px_-16px_hsl(0_100%_25%/.8)] transition-transform hover:-translate-y-0.5">
                {profile?.onboarded ? "Update my preferences" : "Start Onboarding"}
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/events" data-testid="link-browse" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-foreground/25 bg-card/45 px-6 py-3.5 font-semibold transition-colors hover:border-foreground hover:bg-card">
                Browse events <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="mt-7 flex max-w-lg items-start gap-3 border-l-2 border-accent pl-4 text-sm leading-6 text-muted-foreground">
              <Sparkles size={16} className="mt-1 shrink-0 text-primary" />
              <p>
                Sign up on the website to receive personalized campus recommendations by text.
              </p>
            </div>
          </div>

          <div className="rise relative mx-1 mb-4 md:mx-3" style={{ animationDelay: "120ms" }}>
            <div className="home-photo-frame relative">
              <img src={`${import.meta.env.BASE_URL}usc-bovard.jpg`} alt="Bovard Auditorium on the University of Southern California campus" width={1536} height={1024} fetchPriority="high" className="relative aspect-[4/3] w-full rounded-[1.6rem] border-[5px] border-card object-cover object-[50%_45%] shadow-[0_24px_60px_-35px_hsl(0_35%_12%/.7)]" />
              <div className="absolute left-4 top-4 rounded-full border border-card/80 bg-card/90 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.14em] text-primary backdrop-blur-sm">
                USC · Los Angeles
              </div>
              <div className="absolute -bottom-5 right-3 max-w-[250px] rounded-2xl border border-card-border bg-card px-4 py-3 shadow-xl sm:-right-5">
                <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">The ChatSC approach</p>
                <p className="mt-1 font-display text-lg font-bold leading-snug">One campus. Your own shortlist.</p>
              </div>
            </div>
            <p className="mt-8 text-right text-[10px] leading-4 text-muted-foreground">
              Photo: <a className="underline underline-offset-2" href="https://commons.wikimedia.org/wiki/File:USC_Bovard_Auditorium.jpg" target="_blank" rel="noreferrer">Brion Vibber / Wikimedia Commons</a>
              {" · "}<a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-5 sm:mt-12 sm:px-8 lg:px-12" aria-label="How personalized text recommendations work" data-testid="section-text-recommendations">
        <div className="grid overflow-hidden rounded-[2rem] border border-card-border bg-card md:grid-cols-[.8fr_1.2fr]">
          <div className="relative overflow-hidden bg-foreground p-7 text-background sm:p-9">
            <div className="home-rule absolute left-0 right-0 top-0 h-1" aria-hidden />
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">A useful kind of AI</p>
            <h2 className="mt-4 max-w-sm font-display text-3xl font-extrabold leading-tight sm:text-4xl">Personalized recommendations, by text.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-background/75">Sign up on the website and share what matters to you. ChatSC turns campus listings into relevant opportunities matched to your interests, goals, and schedule.</p>
            <Link href={profile?.onboarded ? "/demo" : "/onboarding"} className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5">
              {profile?.onboarded ? "Preview a sample text" : "Start Onboarding"} <ArrowRight size={16} />
            </Link>
            <div className="absolute -bottom-14 -right-10 h-44 w-44 rounded-full border border-background/15" aria-hidden />
            <div className="absolute -bottom-7 -right-3 h-28 w-28 rounded-full border border-background/15" aria-hidden />
          </div>
          <div className="home-index grid gap-0 p-6 sm:grid-cols-3 sm:p-8">
            {[
              ["Tell it what matters", "Add interests, goals, and the time you have available."],
              ["Get a focused shortlist", "Relevant events and recommendations are gathered from the campus listings."],
              ["Make your next move", "Open the source, plan your week, or explore what’s nearby."],
            ].map(([title, detail]) => (
              <div key={title} className="home-step border-b border-border py-5 first:pt-1 last:border-b-0 sm:border-b-0 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0 sm:last:pr-0">
                <h3 className="mt-3 font-display text-xl font-bold leading-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-7xl px-5 sm:px-8 lg:px-12" aria-label="Browse campus listings">
        <div className="grid grid-cols-1 divide-y divide-border rounded-2xl border border-border bg-card px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {browse.map(({ title, detail, href, icon: Icon, count }) => (
            <Link key={title} href={href} className="group flex items-center gap-4 py-5 sm:px-5 sm:first:pl-0 sm:last:pr-0" data-testid={`browse-${title.toLowerCase().replaceAll(" ", "-")}`}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/50 text-primary transition-colors group-hover:bg-accent"><Icon size={21} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-display text-lg font-bold">{title}<ArrowUpRight size={15} className="shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">{detail}</span>
              </span>
              <span className="font-mono text-sm text-muted-foreground">{summary.isLoading ? "…" : count ?? "–"}</span>
            </Link>
          ))}
        </div>
        {s?.sample_data && <p className="mt-2 text-[10px] text-muted-foreground">Some listings are sample data and marked accordingly.</p>}
      </section>

      {user && (
        <section className="mt-16 bg-primary py-10 text-primary-foreground sm:py-12">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">Your campus shortlist</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Picked around your interests</h2>
                <p className="mt-2 max-w-xl text-sm text-primary-foreground/75">Recommendations are based on your saved preferences and availability.</p>
              </div>
              <Link href="/onboarding" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4">Edit preferences <ArrowUpRight size={14} /></Link>
            </div>
            <div className="no-scrollbar mt-6 flex snap-x gap-4 overflow-x-auto pb-2 text-foreground">
              {recs.isLoading && <div className="flex gap-4 [&>*]:w-72 [&>*]:shrink-0"><CardSkeleton n={3} /></div>}
              {recs.isError && <div className="w-full"><ErrorState what="recommendations" onRetry={() => recs.refetch()} /></div>}
              {recs.data?.length === 0 && <div className="max-w-xl rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-5 text-sm text-primary-foreground/85">No recommendations yet. Add a few interests or adjust your availability to help ChatSC find a better fit.</div>}
              {recs.data?.map((e) => <div key={e.id} className="w-72 shrink-0 snap-start md:w-80"><EventCard ev={e} conflict={isConflict(e, blocks)} onOpen={() => setOpen(e)} /></div>)}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto mt-16 grid max-w-7xl gap-4 px-5 sm:px-8 md:grid-cols-3 lg:px-12">
        <Link href="/map" className="group relative overflow-hidden rounded-[1.8rem] bg-foreground p-7 text-background transition-transform hover:-translate-y-1 md:col-span-2 sm:p-9">
          <MapPinned size={22} className="text-accent" />
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[.2em] text-accent">Explore in place</p>
          <p className="mt-2 max-w-xl font-display text-3xl font-extrabold leading-tight sm:text-4xl">See what’s happening across campus.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Open campus map <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
          <Compass size={150} strokeWidth={0.5} className="absolute -bottom-9 -right-8 text-background/10" aria-hidden />
        </Link>
        <Link href="/calendar" className="group flex flex-col justify-between rounded-[1.8rem] bg-accent p-7 text-accent-foreground transition-transform hover:-translate-y-1 sm:p-8">
          <CalendarDays size={22} />
          <div>
            <p className="mt-7 font-mono text-[10px] uppercase tracking-[.2em]">Make a plan</p>
            <p className="mt-2 font-display text-2xl font-extrabold leading-tight">Bring campus events into your week.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">Open calendar <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></span>
          </div>
        </Link>
      </section>
      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? isConflict(open, blocks) : false} />
    </div>
  );
}
