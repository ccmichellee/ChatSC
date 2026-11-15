import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, Compass, MapPinned, Sparkles, UsersRound } from "lucide-react";
import { useGetProfile, useGetRecommendations, getGetRecommendationsQueryKey, type CampusEvent } from "@workspace/api-client-react";
import { EventCard, EventDialog } from "@/components/events-ui";
import { CardSkeleton, ErrorState } from "@/components/bits";
import { isConflict } from "@/lib/campus";

export default function Home() {
  const { data: profile } = useGetProfile();
  const user = profile?.onboarded ? profile.user : "";
  const recs = useGetRecommendations({ user }, { query: { enabled: !!user, queryKey: getGetRecommendationsQueryKey({ user }) } });
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const blocks = profile?.availability ?? [];

  const browse = [
    { title: "Campus events", detail: "Talks, gatherings, and things happening soon.", href: "/events", icon: CalendarDays, action: "Browse events", style: "bg-foreground text-background" },
    { title: "Student clubs", detail: "Find communities built around what you care about.", href: "/clubs", icon: UsersRound, action: "Discover communities", style: "bg-accent text-accent-foreground" },
    { title: "Opportunities", detail: "Explore internships, programs, and next steps.", href: "/opportunities", icon: BriefcaseBusiness, action: "Explore opportunities", style: "bg-primary text-primary-foreground" },
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

          <div className="rise mx-auto w-full max-w-[440px]" style={{ animationDelay: "120ms" }}>
            <img
              src={`${import.meta.env.BASE_URL}chatsc-phone-example.png`}
              alt="Example ChatSC text conversation recommending a performing arts event based on a student's interests, then sharing the date, time, and location."
              width={383}
              height={652}
              fetchPriority="high"
              data-testid="image-text-conversation"
              className="h-auto w-full drop-shadow-[0_24px_30px_hsl(0_35%_12%/.2)]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl px-5 sm:mt-12 sm:px-8 lg:px-12" aria-label="How personalized text recommendations work" data-testid="section-text-recommendations">
        <div className="min-w-0 overflow-hidden rounded-[2rem] border border-card-border bg-card">
          <div className="relative min-w-0 bg-foreground p-6 text-background sm:p-9">
            <div className="home-rule absolute left-0 right-0 top-0 h-1" aria-hidden />
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-accent">How it works</p>
            <h2 className="mt-4 max-w-3xl break-words font-display text-2xl font-extrabold leading-tight sm:text-4xl" data-testid="heading-text-recommendations">Personalized recommendations, by text.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-background/75">Less searching. More opportunities that fit. Here’s how ChatSC turns scattered campus information into your next step.</p>
            <Link href={profile?.onboarded ? "/demo" : "/onboarding"} className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5">
              {profile?.onboarded ? "Preview a sample text" : "Start Onboarding"} <ArrowRight size={16} />
            </Link>
          </div>
          <ol className="grid min-w-0 gap-6 p-6 md:grid-cols-3 sm:p-9" aria-label="Steps to get personalized recommendations">
            {[
              ["Sign up on the website", "Start onboarding with your name, email, and mobile number. No need to text a keyword to get started."],
              ["Tell us what matters", "Share your interests and goals, add your schedule, and choose how often you want recommendations."],
              ["Get personalized texts", "ChatSC matches campus events, clubs, and opportunities to you, with the details and next steps you need to act."],
            ].map(([title, detail], index) => (
              <li key={title} className="min-w-0 border-b border-border pb-6 last:border-b-0 last:pb-0 md:border-b-0 md:pb-0" data-testid={`how-it-works-step-${index + 1}`}>
                <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{index + 1}</span>
                <h3 className="mt-4 font-display text-lg font-bold leading-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-7xl px-5 sm:px-8 lg:px-12" aria-label="Browse campus listings">
        <div className="grid gap-4 md:grid-cols-3">
          {browse.map(({ title, detail, href, icon: Icon, action, style }) => (
            <Link key={title} href={href} className={`group flex min-h-[250px] min-w-0 flex-col rounded-[1.8rem] p-7 transition-transform hover:-translate-y-1 sm:p-8 ${style}`} data-testid={`browse-${title.toLowerCase().replaceAll(" ", "-")}`}>
              <Icon size={24} aria-hidden="true" />
              <h2 className="mt-7 font-display text-2xl font-extrabold leading-tight">{title}</h2>
              <p className="mb-6 mt-2 text-sm leading-6 opacity-80">{detail}</p>
              <span className="mt-auto inline-flex items-center gap-2 text-sm font-bold">{action}<ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
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
