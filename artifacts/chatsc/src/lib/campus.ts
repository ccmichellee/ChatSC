import type { CampusEvent, ClassBlock, GetEventsParams } from "@workspace/api-client-react";

export const TZ = "America/Los_Angeles";
export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function laDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export type EventFilters = { q: string; tag: string; from: string; to: string; free_food: boolean };
export const emptyFilters: EventFilters = { q: "", tag: "", from: "", to: "", free_food: false };

export function toParams(f: EventFilters): GetEventsParams | undefined {
  const p: GetEventsParams = {};
  if (f.q.trim()) p.q = f.q.trim();
  if (f.tag) p.tag = f.tag;
  if (f.from) p.from = f.from;
  if (f.to) p.to = f.to;
  if (f.free_food) p.free_food = true;
  return Object.keys(p).length ? p : undefined;
}

export function fmtWhen(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

export function fmtDay(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "update time unknown";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "update time unknown";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "updated just now";
  if (m < 60) return `updated ${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `updated ${h}h ago`;
  return `updated ${Math.round(h / 24)}d ago`;
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function laParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: DAYS.indexOf(get("weekday")), min: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function conflictsWith(ev: CampusEvent, blocks: ClassBlock[]): ClassBlock | null {
  if (!ev.start || !blocks.length) return null;
  const s = laParts(ev.start);
  const e = ev.end ? laParts(ev.end) : s;
  if (!ev.end) return blocks.find((b) => b.day === s.day && toMin(b.start) <= s.min && toMin(b.end) > s.min) ?? null;
  const endMin = e.day === s.day ? e.min : 24 * 60;
  return blocks.find((b) => b.day === s.day && toMin(b.start) < endMin && toMin(b.end) > s.min) ?? null;
}

export function isConflict(ev: CampusEvent, blocks: ClassBlock[]) {
  return !!conflictsWith(ev, blocks);
}

export function blockOverlaps(blocks: ClassBlock[]) {
  const bad = new Set<number>();
  blocks.forEach((a, i) => blocks.forEach((b, j) => {
    if (i < j && a.day === b.day && toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end)) { bad.add(i); bad.add(j); }
  }));
  return bad;
}
