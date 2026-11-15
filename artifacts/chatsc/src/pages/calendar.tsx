import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import luxonPlugin from "@fullcalendar/luxon3";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Clock3, ExternalLink, MapPin, Sparkles, Users, Save, ListChecks, CalendarClock } from "lucide-react";
import { useGetEvents, useGetProfile, useGetRecommendations, useSaveOnboarding, getGetEventsQueryKey, getGetProfileQueryKey, getGetRecommendationsQueryKey, type CampusEvent, type ClassBlock, type StudentInputFrequency } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ClassBlockEditor } from "@/components/class-blocks";
import { EventDialog } from "@/components/events-ui";
import { ErrorState, PageHead } from "@/components/bits";
import { TZ, blockOverlaps, conflictsWith, isConflict, laDateKey, fmtWhen } from "@/lib/campus";
import { calendarEvent, displayWindow, fmtRange, campusDay, hasEventTime } from "@/lib/calendar-events";

const PALETTE: Record<string, [string, string]> = {
  Technology: ["#dce8f4", "#42688a"], Career: ["#dcebe1", "#477353"],
  "Arts & culture": ["#ece3f0", "#80658b"], Community: ["#f2e8d7", "#9a7749"],
  Wellness: ["#dcebe7", "#4f776b"], "Campus life": ["#f2e2df", "#9a5148"],
};

type CalendarMode = "recommendations" | "all";

function eventDay(event: CampusEvent): string | null {
  if (event.start) return campusDay(event.start);
  const match = event.date_str.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match?.[1] ?? null;
}

function formatDay(day: string) {
  const date = new Date(`${day}T12:00:00`);
  const today = laDateKey();
  if (day === today) return "Today";
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (day === tomorrow.toLocaleDateString("en-CA")) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function displayTime(event: CampusEvent) {
  if (!event.start) return "Time to be announced";
  if (!event.start.includes("T") || /T00:00(?::00)?(?:Z|[+-]\d{2}:\d{2})?$/.test(event.start) && !/\d{1,2}:\d{2}/.test(event.date_str)) return "Time to be announced";
  return fmtWhen(event.start) ?? event.date_str;
}

function isUpcoming(event: CampusEvent, today: string) {
  const day = eventDay(event);
  if (!day || day < today) return false;
  if (day > today || !event.start || !hasEventTime(event)) return true;
  const startTime = new Date(event.start).getTime();
  return Number.isNaN(startTime) || startTime >= Date.now();
}

export default function CalendarPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const events = useGetEvents();
  const profile = useGetProfile();
  const recommendations = useGetRecommendations();
  const save = useSaveOnboarding();
  const [blocks, setBlocks] = useState<ClassBlock[]>([]);
  const [mode, setMode] = useState<CalendarMode>("recommendations");
  const [showGrid, setShowGrid] = useState(false);
  const [hideConflicts, setHideConflicts] = useState(false);
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const [view, setView] = useState("timeGrid3Day");
  const [rangeTitle, setRangeTitle] = useState("");
  const calRef = useRef<FullCalendar>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (profile.data && !initialized.current) {
      initialized.current = true;
      setBlocks(profile.data.availability ?? []);
    }
  }, [profile.data]);

  const nowKey = laDateKey();
  const allUpcoming = useMemo(() => (events.data ?? [])
    .filter((ev) => isUpcoming(ev, nowKey))
    .sort((a, b) => (eventDay(a) ?? "").localeCompare(eventDay(b) ?? "")
      || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title)), [events.data, nowKey]);
  const recommendedUpcoming = useMemo(() => (recommendations.data ?? [])
    .filter((ev) => isUpcoming(ev, nowKey))
    .sort((a, b) => (eventDay(a) ?? "").localeCompare(eventDay(b) ?? "")
      || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title)), [recommendations.data, nowKey]);
  const visibleEvents = mode === "recommendations" ? recommendedUpcoming : allUpcoming;
  const conflicts = useMemo(() => visibleEvents.filter((ev) => ev.conflict === true || isConflict(ev, blocks)), [visibleEvents, blocks]);

  const fcEvents = useMemo(() => {
    const evs = visibleEvents.filter((ev) => ev.start && (!hideConflicts || !(ev.conflict === true || isConflict(ev, blocks)))).map((ev) => {
      const palette = PALETTE[ev.category] ?? PALETTE["Campus life"];
      const base = displayWindow(calendarEvent(ev, view === "dayGridMonth"));
      return { ...base, backgroundColor: palette[0], borderColor: palette[1], textColor: "#292522",
        classNames: [...(ev.conflict === true || isConflict(ev, blocks) ? ["conflict-ev"] : []), ...(base.extendedProps.capped ? ["long-ev"] : [])] };
    });
    const cls = (view === "dayGridMonth" ? [] : blocks).filter((b) => b.start && b.end).map((b, i) => ({
      id: `class-${i}`, title: b.title || "Class", daysOfWeek: [(b.day + 1) % 7], startTime: b.start, endTime: b.end,
      classNames: ["class-block"], editable: false,
    }));
    return [...cls, ...evs];
  }, [visibleEvents, blocks, hideConflicts, view]);

  const dirty = JSON.stringify(blocks) !== JSON.stringify(profile.data?.availability ?? []);
  const invalid = blockOverlaps(blocks).size > 0 || blocks.some((b) => b.end <= b.start);
  const persist = () => {
    const p = profile.data;
    save.mutate({ data: {
      phone: "", email: p?.email || undefined, consent: p?.consent ?? false,
      interests: p?.interests ?? [], goals: p?.goals ?? [], notes: p?.notes ?? "",
      gmail_consent: p?.gmail_consent ?? false, availability: blocks,
      frequency: (p?.frequency || "weekly") as StudentInputFrequency, name: p?.name || undefined,
    } }, {
      onSuccess: (np) => {
        qc.setQueryData(getGetProfileQueryKey(), np);
        qc.invalidateQueries({ queryKey: getGetRecommendationsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        toast({ title: "Class schedule saved", description: `${np.availability.length} block(s) on your week.` });
      },
      onError: () => toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" }),
    });
  };

  const isProfileLoading = profile.isLoading;
  const hasProfile = !!profile.data?.onboarded;
  const loading = mode === "recommendations" ? recommendations.isLoading || profile.isLoading : events.isLoading;
  const dataError = mode === "recommendations" ? recommendations.isError || profile.isError : events.isError;
  const retry = () => {
    if (mode === "recommendations") {
      void recommendations.refetch();
      void profile.refetch();
    } else {
      void events.refetch();
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
      <PageHead kicker="Your calendar" title="Make room for what matters">
        A quieter view of what’s coming up at USC, shaped around your interests and class schedule.
      </PageHead>

      {!isProfileLoading && profile.isError && (
        <div role="status" data-testid="status-profile-error" className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          We couldn’t load your student profile. Your calendar is still available, but recommendations may be incomplete.
          <button type="button" data-testid="button-retry-profile" className="ml-2 font-bold underline" onClick={() => profile.refetch()}>Try again</button>
        </div>
      )}

      <section className="mb-6 rounded-[1.75rem] border border-card-border bg-card p-4 shadow-sm sm:p-6" aria-label="Upcoming campus events">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.16em] text-primary">
              <Sparkles size={14} /> {mode === "recommendations" ? "Curated for you" : "Campus-wide"}
            </div>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl" data-testid="text-calendar-heading">
              {mode === "recommendations" ? "Your upcoming picks" : "All upcoming events"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {mode === "recommendations"
                ? "Relevant opportunities first. Each pick comes from your saved interests and goals."
                : "The campus-wide lineup, in date order."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose event list">
            <button type="button" aria-pressed={mode === "recommendations"} data-testid="button-show-recommendations"
              onClick={() => setMode("recommendations")}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${mode === "recommendations" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}>
              <Sparkles size={14} className="mr-2 inline" />For you
            </button>
            <button type="button" aria-pressed={mode === "all"} data-testid="button-show-all-events"
              onClick={() => setMode("all")}
              className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${mode === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}>
              All events
            </button>
            <button type="button" aria-pressed={showGrid} data-testid="button-toggle-calendar-grid"
              onClick={() => setShowGrid((value) => !value)}
              className="min-h-10 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary">
              {showGrid ? <ListChecks size={15} /> : <CalendarRange size={15} />}
              {showGrid ? "Agenda" : "Calendar grid"}
            </button>
          </div>
        </div>

        {showGrid ? (
          <div className="chatsc-cal mt-6 rounded-2xl border border-border bg-background p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous dates" data-testid="button-calendar-previous" className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-secondary" onClick={() => calRef.current?.getApi().prev()}><ChevronLeft size={18} /></button>
                <button type="button" data-testid="button-calendar-today" className="h-10 rounded-full border border-border px-4 text-sm font-semibold hover:bg-secondary" onClick={() => calRef.current?.getApi().today()}>Today</button>
                <button type="button" aria-label="Next dates" data-testid="button-calendar-next" className="grid h-10 w-10 place-items-center rounded-full border border-border hover:bg-secondary" onClick={() => calRef.current?.getApi().next()}><ChevronRight size={18} /></button>
              </div>
              <h3 className="font-display text-xl font-bold" data-testid="text-calendar-range">{rangeTitle}</h3>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Calendar view">
                {[["timeGridDay", "Day"], ["timeGrid3Day", "3 days"], ["timeGridWeek", "Week"], ["dayGridMonth", "Month"]].map(([name, label]) => (
                  <button key={name} type="button" aria-pressed={view === name} data-testid={`button-calendar-view-${name}`}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold ${view === name ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary"}`}
                    onClick={() => calRef.current?.getApi().changeView(name)}>{label}</button>
                ))}
              </div>
            </div>
            <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={hideConflicts} onChange={(e) => setHideConflicts(e.target.checked)} className="h-4 w-4 accent-[#990000]" data-testid="toggle-hide-conflicts" />
              Hide events that conflict with class
            </label>
            {conflicts.length > 0 && <span role="status" data-testid="status-conflict-count" className="ml-3 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-xs font-bold text-destructive"><AlertTriangle size={12} />{conflicts.length} class conflict{conflicts.length === 1 ? "" : "s"}</span>}
            {events.isError ? <ErrorState what="events" onRetry={() => events.refetch()} /> : (
              <div className={events.isLoading ? "animate-pulse opacity-50" : ""}>
                <FullCalendar ref={calRef} plugins={[dayGridPlugin, timeGridPlugin, luxonPlugin]} timeZone={TZ} initialView="timeGrid3Day" firstDay={1}
                  headerToolbar={false} height={view === "dayGridMonth" ? "auto" : 620} slotMinTime="07:00:00" slotMaxTime="24:00:00"
                  nowIndicator events={fcEvents} expandRows={false} slotEventOverlap={false} eventMaxStack={2}
                  datesSet={(info) => { setView(info.view.type); setRangeTitle(info.view.title); }}
                  views={{ dayGridMonth: { dayMaxEvents: 3, eventDisplay: "block" }, timeGrid3Day: { type: "timeGrid", duration: { days: 3 }, buttonText: "3 days" } }}
                  moreLinkClick="popover" moreLinkContent={(info) => `+${info.num} more`} moreLinkHint={(n) => `Show ${n} more events`}
                  allDayText="All day" allDaySlot eventMinHeight={58} eventShortHeight={40}
                  eventContent={(info) => {
                    const props = info.event.extendedProps;
                    const ongoing = props.ongoing && (view === "dayGridMonth" || props.ongoingWindow);
                    const endDay = props.endDay as string | undefined;
                    const endLabel = endDay ? new Date(`${endDay}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                    const isClass = info.event.classNames.includes("class-block");
                    const time = ongoing ? `Ongoing, ends ${endLabel}` : isClass ? info.timeText : props.originalStart && !info.event.allDay ? fmtRange(props.originalStart, props.originalEnd) : info.timeText;
                    if (view === "dayGridMonth") return <div className="calendar-event-label">{`${ongoing ? `Ongoing · ends ${endLabel} · ` : info.timeText ? `${info.timeText} ` : ""}${info.event.title}`}</div>;
                    return <div className="cal-ev"><div className="cal-ev-title">{info.event.title}</div>{time && <div className="cal-ev-time">{time}{props.capped ? " (long)" : ""}</div>}</div>;
                  }}
                  eventClick={(info) => { const ev = visibleEvents.find((item) => String(item.id) === info.event.id); if (ev) setOpen(ev); }} />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <p className="text-sm text-muted-foreground" data-testid="status-event-count">
                {loading ? "Finding what’s coming up…" : `${visibleEvents.length} ${visibleEvents.length === 1 ? "event" : "events"} ahead`}
              </p>
              <Link href="/events" data-testid="link-browse-events" className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
                Browse events <ArrowRight size={15} />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3" aria-label="Loading events" data-testid="status-events-loading">
                {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-muted/60" />)}
              </div>
            ) : dataError ? (
              <div data-testid="status-events-error"><ErrorState what={mode === "recommendations" ? "recommendations" : "events"} onRetry={retry} /></div>
            ) : mode === "recommendations" && !hasProfile ? (
              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/[.035] p-6 sm:p-8" data-testid="status-onboarding-needed">
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles size={19} /></span>
                  <div>
                    <h3 className="font-display text-xl font-bold">Start with what you’re looking for</h3>
                    <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">Add a few interests and goals so your calendar can surface opportunities that fit. Your full campus schedule is available in the meantime.</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href="/onboarding" data-testid="link-set-preferences" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">Set your preferences <ArrowRight size={15} /></Link>
                      <button type="button" data-testid="button-view-all-from-empty" onClick={() => setMode("all")} className="min-h-10 rounded-full border border-border px-4 text-sm font-semibold hover:bg-secondary">See all events</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : visibleEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-background px-6 py-10 text-center" data-testid={mode === "recommendations" ? "status-no-recommendations" : "status-no-upcoming-events"}>
                <CalendarDays size={25} className="mx-auto text-primary/70" />
                <h3 className="mt-3 font-display text-xl font-bold">{mode === "recommendations" ? "No recommendations just yet" : "Nothing upcoming in the listings"}</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{mode === "recommendations" ? "We don’t have relevant upcoming events to show right now. Browse the full campus list to see what’s out there." : "Check back soon, or browse the full event directory for more details."}</p>
                {mode === "recommendations" && <button type="button" data-testid="button-see-all-empty" onClick={() => setMode("all")} className="mt-4 rounded-full border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-primary/5">See all upcoming events</button>}
              </div>
            ) : (
              <div className="space-y-3" data-testid="list-upcoming-events">
                {visibleEvents.map((ev, index) => {
                  const day = eventDay(ev)!;
                  const conflict = ev.conflict === true || isConflict(ev, blocks);
                  const dateChanges = index === 0 || day !== eventDay(visibleEvents[index - 1]);
                  return <div key={ev.id}>
                    {dateChanges && <h3 className="mb-2 mt-5 font-mono text-[11px] font-semibold uppercase tracking-[.15em] text-muted-foreground" data-testid={`text-agenda-day-${day}`}>{formatDay(day)}</h3>}
                    <article className="group grid gap-4 rounded-2xl border border-card-border bg-background p-4 transition-colors hover:border-primary/40 sm:grid-cols-[100px_1fr_auto] sm:items-center sm:p-5" data-testid={`card-agenda-event-${ev.id}`}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary sm:flex-col sm:items-start sm:gap-1">
                        <span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{displayTime(ev).includes(",") ? displayTime(ev).split(", ").slice(-1)[0] : displayTime(ev)}</span>
                        {ev.end && ev.start?.includes("T") && <span className="pl-5 text-xs font-medium text-muted-foreground sm:pl-0">Ends {new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(ev.end))}</span>}
                      </div>
                      <button type="button" onClick={() => setOpen(ev)} data-testid={`button-open-event-${ev.id}`} className="text-left">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{ev.category || "Campus life"}</span>
                          {conflict && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive"><AlertTriangle size={11} />Class conflict</span>}
                        </div>
                        <h4 className="font-display text-lg font-bold leading-snug group-hover:text-primary">{ev.title}</h4>
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Users size={12} />{ev.host || "Host not listed"}</span>
                          <span className="inline-flex items-center gap-1"><MapPin size={12} />{ev.location || "Location to be announced"}</span>
                        </p>
                        {mode === "recommendations" && ev.matched_reasons?.length ? <p className="mt-2 text-xs font-medium text-foreground/75"><span className="text-primary">A match because</span> {ev.matched_reasons.join(" · ")}</p> : null}
                      </button>
                      <div className="flex items-center gap-3 sm:justify-end">
                        {ev.source_url && <a href={ev.source_url} target="_blank" rel="noreferrer" aria-label={`Open source for ${ev.title}`} data-testid={`link-event-source-${ev.id}`} className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold hover:bg-secondary">Source <ExternalLink size={12} /></a>}
                        <button type="button" onClick={() => setOpen(ev)} data-testid={`button-event-details-${ev.id}`} className="inline-flex h-9 items-center gap-1 rounded-full bg-secondary px-3 text-xs font-bold hover:bg-secondary/70">Details <ArrowRight size={13} /></button>
                      </div>
                    </article>
                  </div>;
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start" aria-label="Class schedule">
        <div className="rounded-[1.75rem] border border-card-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="mb-1 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.15em] text-muted-foreground"><CalendarClock size={13} /> Your weekly rhythm</div>
              <h2 className="font-display text-2xl font-bold">Class schedule</h2>
              <p className="mt-1 text-sm text-muted-foreground">Add class times to flag overlaps and tune your recommendations.</p>
            </div>
            {dirty && <span className="rounded-full bg-accent/45 px-3 py-1 text-xs font-bold">Unsaved changes</span>}
          </div>
          {profile.isLoading ? <div className="mt-5 h-28 animate-pulse rounded-2xl bg-muted" data-testid="status-schedule-loading" /> :
            profile.isError ? <div className="mt-4 rounded-xl border border-destructive/25 p-4 text-sm text-muted-foreground" data-testid="status-schedule-error">Schedule unavailable. Try reloading your profile before editing.</div> :
            !hasProfile ? (
              <div className="mt-5 rounded-2xl border border-dashed border-primary/35 bg-background p-4" data-testid="status-schedule-onboarding">
                <p className="text-sm leading-relaxed text-muted-foreground">Add your class schedule during onboarding so recommendations can work around your week.</p>
                <Link href="/onboarding" data-testid="link-add-schedule-onboarding" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground">Add schedule in onboarding <ArrowRight size={14} /></Link>
              </div>
            ) : (
              <>
                <div className="mt-5"><ClassBlockEditor blocks={blocks} onChange={setBlocks} /></div>
                <button type="button" onClick={persist} disabled={!dirty || invalid || save.isPending} data-testid="button-save-classes"
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 sm:w-auto sm:min-w-48">
                  <Save size={15} />{save.isPending ? "Saving schedule…" : dirty ? "Save schedule" : "Schedule saved"}
                </button>
              </>
            )}
          {invalid && <p role="status" data-testid="status-schedule-invalid" className="mt-2 text-xs font-medium text-destructive">Resolve overlapping blocks or end times before saving.</p>}
        </div>

        <aside className="rounded-[1.75rem] border border-border bg-secondary/45 p-5">
          <h3 className="font-display text-lg font-bold">A clearer week</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{hasProfile ? "Your schedule stays yours. ChatSC uses class times to identify event conflicts and keep recommendations practical." : "Add class times during onboarding to identify conflicts and make recommendations fit your week."}</p>
          {conflicts.length > 0 ? (
            <div className="mt-4 border-t border-border pt-4" data-testid="status-class-conflicts">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-destructive"><AlertTriangle size={14} />{conflicts.length} schedule overlap{conflicts.length === 1 ? "" : "s"}</p>
              <ul className="mt-2 space-y-2">
                {conflicts.slice(0, 4).map((ev) => {
                  const block = conflictsWith(ev, blocks);
                  return <li key={ev.id}><button type="button" data-testid={`button-conflict-event-${ev.id}`} onClick={() => setOpen(ev)} className="text-left text-sm leading-snug hover:underline"><span className="font-semibold">{ev.title}</span><span className="block text-xs text-muted-foreground">Overlaps {block?.title || "a class block"}</span></button></li>;
                })}
              </ul>
            </div>
          ) : <p role="status" data-testid="status-no-class-conflicts" className="mt-4 border-t border-border pt-4 text-sm font-medium text-muted-foreground">{hasProfile ? "No class conflicts in upcoming events." : "Add your schedule to see which events fit around classes."}</p>}
          <Link href="/onboarding" data-testid="link-edit-preferences" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">Edit your preferences <ArrowRight size={14} /></Link>
        </aside>
      </section>
      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? open.conflict === true || isConflict(open, blocks) : false} />
    </div>
  );
}
