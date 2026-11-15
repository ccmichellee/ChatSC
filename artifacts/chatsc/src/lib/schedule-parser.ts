import type { ClassBlock } from "@workspace/api-client-react";

const DAY_NUMBERS: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };

function clock(value: string, meridiem?: string) {
  const [h, m = "00"] = value.split(":");
  let hour = Number(h);
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  }
  if (hour > 23 || Number(m) > 59) return null;
  return `${String(hour).padStart(2, "0")}:${m}`;
}

function daysInText(text: string) {
  const found = new Set<number>();
  const notation = text.replace(/\bto\b/gi, " ").match(/\b(?:MWF|TTh|TuTh|TR|MW|WF|Sa|Su|M|T|W|R|F)\b/gi) ?? [];
  for (const token of notation) {
    const t = token.toLowerCase();
    if (t === "mwf") [0, 2, 4].forEach((d) => found.add(d));
    else if (t === "tth" || t === "tuth" || t === "tr") [1, 3].forEach((d) => found.add(d));
    else if (t === "mw") [0, 2].forEach((d) => found.add(d));
    else if (t === "wf") [2, 4].forEach((d) => found.add(d));
    else {
      const d = t.startsWith("th") || t === "r" ? 3
        : t.startsWith("tu") || t === "t" ? 1
        : t.startsWith("w") ? 2 : t.startsWith("f") ? 4
        : t.startsWith("sa") ? 5 : t.startsWith("su") ? 6
        : t.startsWith("m") ? 0 : undefined;
      if (d !== undefined) found.add(d);
    }
  }
  const names: [RegExp, number][] = [
    [/\bmondays?\b/i, 0], [/\btuesdays?\b/i, 1], [/\bwednesdays?\b/i, 2],
    [/\bthursdays?\b/i, 3], [/\bfridays?\b/i, 4], [/\bsaturdays?\b/i, 5],
    [/\bsundays?\b/i, 6],
  ];
  for (const [re, day] of names) if (re.test(text)) found.add(day);
  return [...found];
}

function makeTitle(line: string, timeMatch: RegExpMatchArray) {
  const withoutTime = line.replace(timeMatch[0], " ").replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|MWF|TTh|TuTh|MW|WF|TR|[MTWRFSU])\b/gi, " ");
  const title = withoutTime.replace(/[\s|,;:-]+/g, " ").trim();
  return (title || "Class").slice(0, 100);
}

export function parseScheduleText(text: string): ClassBlock[] {
  const result = new Map<string, ClassBlock>();
  const range = /(\d{1,2}(?::\d{2})?)\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|–|—|to)\s*(\d{1,2}(?::\d{2})?)\s*(a\.?m\.?|p\.?m\.?)?/i;
  for (const raw of text.split(/[\r\n]+/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const match = line.match(range);
    if (!match) continue;
    const days = daysInText(line.replace(match[0], " "));
    if (!days.length) continue;
    const endMeridiem = match[4]?.replace(/\./g, "").toLowerCase();
    const startMeridiem = match[2]?.replace(/\./g, "").toLowerCase() || endMeridiem;
    const start = clock(match[1], startMeridiem);
    const end = clock(match[3], endMeridiem || startMeridiem);
    if (!start || !end || end <= start) continue;
    const title = makeTitle(line, match);
    for (const day of days) {
      const block = { day, start, end, title };
      result.set(`${day}:${start}:${end}:${title}`, block);
    }
  }
  return [...result.values()].slice(0, 40);
}

function unfoldIcs(raw: string) {
  return raw.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function parseIcsDate(line: string) {
  const value = line.split(":").slice(1).join(":");
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  if (m[7]) {
    const instant = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}Z`);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(instant);
    const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
    return { day, time: `${p.hour}:${p.minute}` };
  }
  const weekday = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
  return { day: (weekday + 6) % 7, time: `${m[4]}:${m[5]}` };
}

export function parseIcsSchedule(raw: string): ClassBlock[] {
  const events: string[][] = [];
  let current: string[] | null = null;
  for (const line of unfoldIcs(raw)) {
    if (line === "BEGIN:VEVENT") current = [];
    else if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
    } else if (current) current.push(line);
  }
  const result = new Map<string, ClassBlock>();
  for (const event of events) {
    const startLine = event.find((line) => line.startsWith("DTSTART"));
    const endLine = event.find((line) => line.startsWith("DTEND"));
    const summaryLine = event.find((line) => line.startsWith("SUMMARY"));
    if (!startLine || !endLine) continue;
    const start = parseIcsDate(startLine);
    const end = parseIcsDate(endLine);
    if (!start || !end || end.day !== start.day || end.time <= start.time) continue;
    const summary = summaryLine?.split(":").slice(1).join(":").replace(/\\([,;\\])/g, "$1").trim();
    const title = (summary || "Class").slice(0, 100);
    const rule = event.find((line) => line.startsWith("RRULE:")) ?? "";
    const byday = rule.match(/(?:^|;)BYDAY=([^;]+)/)?.[1]?.split(",").map((d) => DAY_NUMBERS[d.slice(-2)]).filter((d) => d !== undefined);
    const days = byday?.length ? [...new Set(byday)] : [start.day];
    for (const day of days) {
      const block = { day, start: start.time, end: end.time, title };
      result.set(`${day}:${start.time}:${end.time}:${title}`, block);
    }
  }
  return [...result.values()].slice(0, 40);
}
