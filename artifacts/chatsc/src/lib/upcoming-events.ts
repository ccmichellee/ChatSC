import type { CampusEvent } from "@workspace/api-client-react";

export function upcomingEvents(events: CampusEvent[], now: number, limit = 4) {
  return events.filter((event) => event.start && new Date(event.start).getTime() >= now)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime())
    .slice(0, limit);
}
