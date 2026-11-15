import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, CalendarClock, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { getGetRecommendationsQueryKey, useGetProfile, useGetRecommendations } from "@workspace/api-client-react";
import { CardSkeleton, ErrorState } from "@/components/bits";
import { fmtWhen } from "@/lib/campus";

const frequencyLabel: Record<string, string> = {
  daily: "daily",
  "twice-weekly": "twice a week",
  weekly: "weekly",
};

export default function MessageDemo() {
  const [, navigate] = useLocation();
  const profile = useGetProfile();
  const user = profile.data?.onboarded ? profile.data.user : "";
  const recommendations = useGetRecommendations(
    { user },
    { query: { enabled: !!user, queryKey: getGetRecommendationsQueryKey({ user }) } },
  );

  useEffect(() => {
    if (profile.isSuccess && !profile.data?.onboarded) navigate("/onboarding");
  }, [navigate, profile.data?.onboarded, profile.isSuccess]);

  if (profile.isLoading) {
    return <main className="mx-auto max-w-5xl px-4 py-12"><CardSkeleton n={2} /></main>;
  }
  if (profile.isError) {
    return <main className="mx-auto max-w-5xl px-4 py-12"><ErrorState what="your profile" onRetry={() => profile.refetch()} /></main>;
  }
  if (!profile.data?.onboarded) {
    return <main className="mx-auto max-w-5xl px-4 py-12"><CardSkeleton n={2} /></main>;
  }

  const student = profile.data;
  const recommendation = recommendations.data?.[0];
  const interest = student.interests?.[0] ?? student.goals?.[0] ?? "campus opportunities";
  const name = student.name?.trim() || "Trojan";
  const frequency = frequencyLabel[student.frequency] ?? "weekly";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12" data-testid="imessage-demo">
      <Link href="/" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
        <ArrowLeft size={16} aria-hidden="true" /> Back to campus
      </Link>

      <div className="mt-7 grid items-center gap-10 md:grid-cols-[1fr_0.85fr] md:gap-14">
        <section className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-primary">
            <MessageCircle size={13} aria-hidden="true" /> iMessage demo
          </p>
          <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.02] tracking-tight text-balance sm:text-5xl">
            Your campus guide starts the conversation.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            You signed up on the website. Now see how ChatSC could open with a message shaped around what you want to find.
          </p>
          <div className="mt-6 inline-flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
            <Sparkles size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
            <p>This is an on-screen demo. It does not send a real message to your phone.</p>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/opportunities" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5">
              Explore opportunities <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/onboarding" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-secondary">
              Edit my preferences
            </Link>
          </div>
        </section>

        <section aria-label="Sample iMessage conversation" className="mx-auto w-full max-w-[380px]">
          <div className="overflow-hidden rounded-[2.7rem] border-[8px] border-[#222] bg-[#f2f2f7] shadow-[0_30px_70px_-30px_rgba(38,24,20,.55)]">
            <div className="flex h-9 items-center justify-between bg-[#f8f8fa] px-6 text-[10px] font-bold text-[#242424]" aria-hidden="true">
              <span>9:41</span>
              <span className="tracking-[.15em]">●●● ▰</span>
            </div>
            <header className="flex items-center gap-3 border-b border-[#dedee3] bg-[#f8f8fa] px-4 pb-3 pt-1">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary font-display text-lg font-extrabold text-primary-foreground">C</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#242424]">ChatSC</p>
                <p className="text-[11px] text-[#727277]">Campus guide</p>
              </div>
              <span className="rounded-full bg-[#e5e5ea] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wide text-[#65656a]">Demo</span>
            </header>

            <div className="flex min-h-[390px] flex-col gap-4 p-4 sm:min-h-[430px]">
              <p className="text-center font-mono text-[9px] uppercase tracking-[.12em] text-[#8b8b91]">Your first message</p>
              {recommendations.isError && (
                <div className="rounded-xl bg-white p-3 text-xs text-[#5f5f65]">
                  I’ve got your interests and goals. I’m ready to help you find campus opportunities that fit.
                </div>
              )}
              {recommendations.isLoading && <div role="status" aria-label="ChatSC is preparing your demo message" className="flex gap-1 self-start rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm"><span className="sr-only">ChatSC is preparing your demo message.</span><span className="h-2 w-2 animate-pulse rounded-full bg-[#a3a3aa]" /><span className="h-2 w-2 animate-pulse rounded-full bg-[#a3a3aa] [animation-delay:120ms]" /><span className="h-2 w-2 animate-pulse rounded-full bg-[#a3a3aa] [animation-delay:240ms]" /></div>}
              {!recommendations.isLoading && !recommendations.isError && (
                <div className="max-w-[94%] animate-in fade-in slide-in-from-bottom-2 rounded-[1.35rem] rounded-bl-md bg-white p-4 text-[13px] leading-[1.45] text-[#232328] shadow-sm">
                  <p>Hey {name}! I’m keeping an eye out for {interest.toLowerCase()} opportunities. Here’s one that may fit:</p>
                  {recommendation ? (
                    <div className="mt-3 rounded-xl border border-[#e5e5ea] bg-[#f8f8fa] p-3">
                      <p className="font-semibold leading-snug">{recommendation.title}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#67676d]"><CalendarClock size={12} aria-hidden="true" />{fmtWhen(recommendation.start) ?? "Upcoming"}</p>
                      {recommendation.location && <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#67676d]"><MapPin size={12} aria-hidden="true" />{recommendation.location}</p>}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-[#e5e5ea] bg-[#f8f8fa] p-3 text-[#57575d]">
                      I’ll use your interests, goals, and schedule to shape a focused shortlist as campus listings come in.
                    </p>
                  )}
                  <p className="mt-3 text-[#67676d]">I’ll keep the recommendations {frequency} and focused on what matters to you.</p>
                </div>
              )}
              <p className="mt-auto text-center text-[10px] text-[#85858c]">Demo conversation · nothing sent</p>
            </div>
            <div className="flex items-center gap-2 border-t border-[#dedee3] bg-[#f8f8fa] p-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e2e2e8] text-[#77777d]" aria-hidden="true">+</span>
              <div className="h-8 flex-1 rounded-full border border-[#d4d4da] bg-white px-3 py-1.5 text-[11px] text-[#aaaab0]">iMessage</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
