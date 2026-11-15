import type { CampusEvent } from "@workspace/api-client-react";
import { TZ } from "./campus";

export function campusDay(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function hasEventTime(event: CampusEvent) {
  // The API normalizes date-only sources to midnight. Keep those out of the
  // timed grid, but retain explicitly published midnight times.
  return /\d{1,2}:\d{2}|\d{1,2}\s*[ap]\.?m\.?/i.test(event.date_str)
    || (!!event.start && !/T00:00(?::00(?:\.0+)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(event.start)
      && event.start.includes("T"));
}

export function calendarEvent(event: CampusEvent, month: boolean) {
  const startDay = campusDay(event.start!);
  const endDay = event.end ? campusDay(event.end) : startDay;
  const ongoing = endDay > startDay;
  const timed = hasEventTime(event);
  const collapsed = month && ongoing;
  // Registration windows and other long-running listings belong above the
  // hourly grid, not in columns that cover every hour for weeks at a time.
  const ongoingWindow = ongoing && !!event.end
    && new Date(event.end).getTime() - new Date(event.start!).getTime() > 48 * 60 * 60 * 1000;
  const allDay = collapsed || !timed || ongoingWindow;
  return {
    id: String(event.id),
    title: event.title,
    start: allDay ? startDay : event.start!,
    end: collapsed ? undefined : (allDay ? event.end ? exclusiveDay(endDay) : undefined : event.end ?? undefined),
    allDay,
    extendedProps: { ongoing, ongoingWindow, endDay, originalStart: event.start, originalEnd: event.end },
  };
}

function exclusiveDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

const MAX_DISPLAY_MS = 2.5 * 60 * 60 * 1000;

// Long timed events keep their real times in extendedProps; only the drawn
// block is capped so it doesn't swallow the whole evening column.
export function displayWindow<T extends ReturnType<typeof calendarEvent>>(ev: T) {
  if (ev.allDay || !ev.end) return { ...ev, extendedProps: { ...ev.extendedProps, capped: false } };
  const s = new Date(ev.start).getTime();
  const e = new Date(ev.end).getTime();
  if (e - s <= MAX_DISPLAY_MS) return { ...ev, extendedProps: { ...ev.extendedProps, capped: false } };
  return { ...ev, end: new Date(s + MAX_DISPLAY_MS).toISOString(), extendedProps: { ...ev.extendedProps, capped: true } };
}

export function fmtRange(start: string, end?: string | null) {
  const f = (d: string) => new Date(d).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  return end ? `${f(start)} – ${f(end)}` : f(start);
}
