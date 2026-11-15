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
import { calendarEvent } from "@/lib/calendar-events";

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
  const inited = useRef(false);
  useEffect(() => {
    if (profile.data && !inited.current) { inited.current = true; setBlocks(profile.data.availability ?? []); }
  }, [profile.data]);

  const all = events.data ?? [];
  const conflicts = useMemo(() => all.filter((e) => conflictsWith(e, blocks)), [all, blocks]);
  const fcEvents = useMemo(() => {
    const evs = all.filter((e) => e.start && (!hide || !isConflict(e, blocks))).map((e) => {
      const palette = ({
        Technology: ["#edf1fa", "#465d84"], Career: ["#eaf4ef", "#27654d"],
        "Arts & culture": ["#f2ecf7", "#785187"], Community: ["#faf2dc", "#806020"],
        Wellness: ["#e8f5f5", "#287375"], "Campus life": ["#faeded", "#990000"],
      }[e.category] ?? ["#faeded", "#990000"]);
      return { ...calendarEvent(e, month), backgroundColor: palette[0], borderColor: palette[1],
        textColor: "#292524", classNames: isConflict(e, blocks) ? ["conflict-ev"] : [] };
    });
    const cls = (month ? [] : blocks).filter((b) => b.start && b.end).map((b, i) => ({
      id: `class-${i}`, title: b.title || "Class", daysOfWeek: [(b.day + 1) % 7], startTime: b.start, endTime: b.end,
      classNames: ["class-block"], editable: false,
    }));
    return [...cls, ...evs];
  }, [all, blocks, hide, month]);

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
      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="rounded-3xl bg-card border border-card-border p-3 md:p-5">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} className="w-4 h-4 accent-[#990000]" data-testid="toggle-hide-conflicts" />
              Hide events that conflict with class
            </label>
            {conflicts.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-3 py-1 text-xs font-bold" role="status"><AlertTriangle size={12} />{conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}</span>}
          </div>
          {events.isError ? <ErrorState what="events" onRetry={() => events.refetch()} /> : (
            <div className={events.isLoading ? "opacity-50 animate-pulse" : ""}>
              <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, luxonPlugin]} timeZone={TZ} initialView="timeGridWeek" firstDay={1}
                headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
                height="auto" slotMinTime="00:00:00" slotMaxTime="24:00:00" scrollTime="08:00:00" nowIndicator events={fcEvents}
                datesSet={(info) => setMonth(info.view.type === "dayGridMonth")}
                views={{ dayGridMonth: { dayMaxEvents: 3, eventDisplay: "block" } }}
                moreLinkClick="popover" moreLinkContent={(info) => `+${info.num} more`}
                allDayText="All-day" allDaySlot eventMinHeight={0} eventShortHeight={20}
                eventContent={(info) => {
                  const ongoing = info.event.extendedProps.ongoing && (month || info.event.extendedProps.ongoingWindow);
                  const endDay = info.event.extendedProps.endDay as string | undefined;
                  const endLabel = endDay ? new Date(`${endDay}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                  const label = `${ongoing ? `Ongoing · ends ${endLabel} · ` : info.timeText ? `${info.timeText} ` : ""}${info.event.title}`;
                  return <div className="calendar-event-label" title={label}>{label}</div>;
                }}
                eventClick={(info) => { const ev = all.find((e) => String(e.id) === info.event.id); if (ev) setOpen(ev); }} />
            </div>
          )}
        </div>
        <aside className="space-y-4">
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
