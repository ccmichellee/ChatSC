import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import luxonPlugin from "@fullcalendar/luxon3";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save } from "lucide-react";
import { useGetEvents, useGetProfile, useSaveOnboarding, getGetProfileQueryKey, type CampusEvent, type ClassBlock, type StudentInputFrequency } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ClassBlockEditor } from "@/components/class-blocks";
import { EventDialog } from "@/components/events-ui";
import { ErrorState, PageHead } from "@/components/bits";
import { TZ, blockOverlaps, conflictsWith, isConflict } from "@/lib/campus";
import { calendarEvent, displayWindow, fmtRange } from "@/lib/calendar-events";

const PALETTE: Record<string, [string, string]> = {
  Technology: ["#cfe0fb", "#2f5fa8"], Career: ["#cdeed9", "#21734b"],
  "Arts & culture": ["#e6d6f7", "#6d3fa0"], Community: ["#fde3b8", "#a5640c"],
  Wellness: ["#c9eeec", "#16726f"], "Campus life": ["#fbd3d3", "#990000"],
};

export default function CalendarPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const events = useGetEvents();
  const profile = useGetProfile();
  const save = useSaveOnboarding();
  const [blocks, setBlocks] = useState<ClassBlock[]>([]);
  const [hide, setHide] = useState(false);
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const [month, setMonth] = useState(false);
  const [view, setView] = useState("timeGrid3Day");
  const [rangeTitle, setRangeTitle] = useState("");
  const calRef = useRef<FullCalendar>(null);
  const gridScroll = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  const inited = useRef(false);
  useEffect(() => {
    if (profile.data && !inited.current) { inited.current = true; setBlocks(profile.data.availability ?? []); }
  }, [profile.data]);

  const all = events.data ?? [];
  const conflicts = useMemo(() => all.filter((e) => conflictsWith(e, blocks)), [all, blocks]);
  const fcEvents = useMemo(() => {
    const evs = all.filter((e) => e.start && (!hide || !isConflict(e, blocks))).map((e) => {
      const palette = PALETTE[e.category] ?? PALETTE["Campus life"];
      const base = displayWindow(calendarEvent(e, month));
      return { ...base, backgroundColor: palette[0], borderColor: palette[1],
        textColor: "#1f1a17", classNames: [...(isConflict(e, blocks) ? ["conflict-ev"] : []), ...(base.extendedProps.capped ? ["long-ev"] : [])] };
    });
    const cls = (month ? [] : blocks).filter((b) => b.start && b.end).map((b, i) => ({
      id: `class-${i}`, title: b.title || "Class", daysOfWeek: [(b.day + 1) % 7], startTime: b.start, endTime: b.end,
      classNames: ["class-block"], editable: false,
    }));
    return [...cls, ...evs];
  }, [all, blocks, hide, month]);

  useEffect(() => {
    if (scrolled.current || !events.data) return;
    const api = calRef.current?.getApi();
    if (!api) return;
    scrolled.current = true;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
    const hours = events.data.filter((e) => e.start && e.start.includes("T") && new Date(e.start).toLocaleDateString("en-CA", { timeZone: TZ }) === today)
      .map((e) => Number(new Date(e.start!).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false })));
    const nowH = Number(new Date().toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }));
    const h = hours.length ? Math.min(...hours) : Math.max(nowH - 1, 7);
    api.scrollToTime(`${String(Math.max(0, h - 1)).padStart(2, "0")}:00:00`);
  }, [events.data]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const container = gridScroll.current;
      const today = container?.querySelector<HTMLElement>(".fc-col-header-cell.fc-day-today");
      if (container && today) {
        container.scrollLeft = Math.max(0, today.getBoundingClientRect().left - container.getBoundingClientRect().left - 50);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [view, events.data]);

  const dirty = JSON.stringify(blocks) !== JSON.stringify(profile.data?.availability ?? []);
  const invalid = blockOverlaps(blocks).size > 0 || blocks.some((b) => b.end <= b.start);
  const persist = () => {
    const p = profile.data;
    save.mutate({ data: { phone: "", consent: p?.consent ?? false, interests: p?.interests ?? [], availability: blocks, frequency: (p?.frequency || "weekly") as StudentInputFrequency, name: p?.name || undefined } }, {
      onSuccess: (np) => {
        qc.setQueryData(getGetProfileQueryKey(), np);
        qc.invalidateQueries({ queryKey: ["/api/recommendations"] });
        qc.invalidateQueries({ queryKey: ["/api/events"] });
        toast({ title: "Class schedule saved", description: `${np.availability.length} block(s) on your week.` });
      },
      onError: () => toast({ title: "Couldn't save", description: "Please try again.", variant: "destructive" }),
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead kicker="Calendar" title="Your week, with room to breathe">Striped blocks are your classes. Event borders show categories. Times shown in Los Angeles time.</PageHead>
      <div className="space-y-5">
        <div className="rounded-3xl bg-card border border-card-border p-3 md:p-5 chatsc-cal">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="w-4 h-4 accent-[#990000]" data-testid="toggle-hide-conflicts" />
              Hide events that conflict with class
            </label>
            {conflicts.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-3 py-1 text-xs font-bold" role="status"><AlertTriangle size={12} />{conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}</span>}
          </div>
          <div className="flex flex-wrap gap-2 mb-3" aria-label="Calendar views">
            {[["timeGridDay", "Day"], ["timeGrid3Day", "3 days"], ["timeGridWeek", "Week"], ["dayGridMonth", "Month"]].map(([name, label]) => (
              <button key={name} type="button" aria-pressed={view === name}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold border ${view === name ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
                onClick={() => calRef.current?.getApi().changeView(name)}>{label}</button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-2">
              <button type="button" aria-label="Previous dates" className="rounded-full border border-border px-3 py-1.5" onClick={() => calRef.current?.getApi().prev()}>‹</button>
              <button type="button" className="rounded-full border border-border px-3 py-1.5 text-sm" onClick={() => calRef.current?.getApi().today()}>Today</button>
              <button type="button" aria-label="Next dates" className="rounded-full border border-border px-3 py-1.5" onClick={() => calRef.current?.getApi().next()}>›</button>
            </div>
            <h2 className="font-display text-xl font-bold">{rangeTitle}</h2>
          </div>
          {events.isError ? <ErrorState what="events" onRetry={() => events.refetch()} /> : (
            <div ref={gridScroll} className={`overflow-x-auto ${events.isLoading ? "opacity-50 animate-pulse" : ""}`}>
              <div style={{ minWidth: view === "timeGridWeek" ? 1610 : view === "timeGrid3Day" ? 710 : undefined }}>
              <FullCalendar ref={calRef} plugins={[dayGridPlugin, timeGridPlugin, luxonPlugin]} timeZone={TZ} initialView="timeGrid3Day" firstDay={1}
                headerToolbar={false}
                buttonText={{ day: "Day", week: "Week", month: "Month", today: "Today" }}
                height={month ? "auto" : 720} slotMinTime="00:00:00" slotMaxTime="24:00:00" scrollTime="08:00:00" nowIndicator events={fcEvents}
                expandRows={false} slotEventOverlap={false} eventMaxStack={2}
                datesSet={(info) => { setMonth(info.view.type === "dayGridMonth"); setView(info.view.type); setRangeTitle(info.view.title); }}
                views={{ dayGridMonth: { dayMaxEvents: 3, eventDisplay: "block" }, timeGrid3Day: { type: "timeGrid", duration: { days: 3 }, buttonText: "3 days" } }}
                moreLinkClick="popover"
                moreLinkContent={(info) => `+${info.num} more`}
                moreLinkHint={(n) => `Show ${n} more events`}
                allDayText="All-day" allDaySlot eventMinHeight={64} eventShortHeight={40}
                eventContent={(info) => {
                  const p = info.event.extendedProps;
                  const ongoing = p.ongoing && (month || p.ongoingWindow);
                  const endDay = p.endDay as string | undefined;
                  const endLabel = endDay ? new Date(`${endDay}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                  const isClass = info.event.classNames.includes("class-block");
                  const time = ongoing ? `Ongoing, ends ${endLabel}` : isClass ? info.timeText : p.originalStart && !info.event.allDay ? fmtRange(p.originalStart, p.originalEnd) : info.timeText;
                  if (month) {
                    const label = `${ongoing ? `Ongoing · ends ${endLabel} · ` : info.timeText ? `${info.timeText} ` : ""}${info.event.title}`;
                    return <div className="calendar-event-label" title={label}>{label}</div>;
                  }
                  return (
                    <div className="cal-ev" title={`${info.event.title}${time ? `\n${time}` : ""}`}>
                      <div className="cal-ev-title">{info.event.title}</div>
                      {time && <div className="cal-ev-time">{time}{p.capped ? " (long)" : ""}</div>}
                    </div>
                  );
                }}
                eventClick={(info) => { const ev = all.find((e) => String(e.id) === info.event.id); if (ev) setOpen(ev); }} />
              </div>
            </div>
          )}
        </div>
        <aside className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
          <div className="rounded-3xl bg-card border border-card-border p-5">
            <h2 className="font-display text-xl font-extrabold">Class blocks</h2>
            <p className="text-sm text-muted-foreground mb-3">Edit your weekly schedule. Changes preview instantly.</p>
            {profile.isLoading ? <div className="h-24 rounded-2xl bg-muted animate-pulse" /> : <ClassBlockEditor blocks={blocks} onChange={setBlocks} />}
            <button onClick={persist} disabled={!dirty || invalid || save.isPending} data-testid="button-save-classes"
              className="mt-4 w-full inline-flex justify-center items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 font-semibold disabled:opacity-50">
              <Save size={15} />{save.isPending ? "Saving" : dirty ? "Save schedule" : "Saved"}
            </button>
          </div>
          {conflicts.length > 0 && (
            <div className="rounded-3xl bg-accent/30 border border-accent p-5">
              <h2 className="font-display text-lg font-extrabold">Heads up</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {conflicts.slice(0, 6).map((e) => { const b = conflictsWith(e, blocks); return (
                  <li key={e.id}><button className="text-left hover:underline" onClick={() => setOpen(e)}><span className="font-semibold">{e.title}</span>{b ? <> overlaps <span className="font-semibold">{b.title || "a class"}</span></> : " conflicts with your schedule"}</button></li>
                ); })}
              </ul>
            </div>
          )}
        </aside>
      </div>
      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? isConflict(open, blocks) : false} />
    </div>
  );
}
