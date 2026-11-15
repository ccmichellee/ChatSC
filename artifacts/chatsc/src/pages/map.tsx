import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { AlertCircle, CalendarClock, ChevronRight, ExternalLink, LocateFixed, MapPin, Search, SlidersHorizontal, UtensilsCrossed } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { useGetEvents, useGetProfile, useGetSummary, type CampusEvent } from "@workspace/api-client-react";
import { EventDialog } from "@/components/events-ui";
import { CardSkeleton, EmptyState, ErrorState, PageHead } from "@/components/bits";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { emptyFilters, fmtWhen, isConflict, toParams, type EventFilters } from "@/lib/campus";
import { KIND_COLOR, LANDMARKS, eventsAt, type Landmark } from "@/lib/campus-landmarks";

const CENTER: [number, number] = [34.0224, -118.2851];

const landmarkIcon = (landmark: Landmark) => L.divIcon({
  className: "landmark-icon",
  html: `<div class="landmark-pin"><span class="landmark-dot" style="background:${KIND_COLOR[landmark.kind]}"></span><span class="landmark-name">${landmark.short}</span></div>`,
  iconSize: [Math.max(64, landmark.short.length * 7 + 34), 20],
  iconAnchor: [6, 10],
});

const eventPin = (active: boolean) => L.divIcon({
  className: "",
  html: `<div style="width:${active ? 30 : 22}px;height:${active ? 30 : 22}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active ? "#FFCC00" : "#990000"};border:3px solid #FBFAF4;box-shadow:0 4px 10px rgba(60,0,0,.35);transition:all .2s"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function FlyTo({ event }: { event: CampusEvent | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (event?.lat != null && event.lng != null) map.flyTo([event.lat, event.lng], 17, { duration: 0.6 });
  }, [event, map]);
  return null;
}

function MapReset() {
  const map = useMap();
  return (
    <button
      type="button"
      aria-label="Return map to campus overview"
      data-testid="button-map-reset"
      onClick={() => map.setView(CENTER, 16)}
      className="absolute right-3 top-3 z-[500] grid h-10 w-10 place-items-center rounded-xl border border-border bg-card/95 text-muted-foreground shadow-md transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
    >
      <LocateFixed size={17} aria-hidden="true" />
    </button>
  );
}

export default function MapPage() {
  const [filters, setFilters] = useState<EventFilters>(emptyFilters);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const deferred = useDeferredValue(filters);
  const params = useMemo(() => toParams(deferred), [deferred]);
  const events = useGetEvents(params);
  const { data: profile } = useGetProfile();
  const { data: summary } = useGetSummary();
  const blocks = profile?.availability ?? [];
  const visible = events.data ?? [];
  const placed = visible.filter((event) => event.lat != null && event.lng != null);
  const withoutLocation = visible.filter((event) => event.lat == null || event.lng == null);
  const selected = placed.find((event) => event.id === selectedId);
  const hasFilters = !!filters.q || !!filters.tag || !!filters.from || !!filters.to || filters.free_food;
  const activeFilterCount = [!!filters.tag, !!(filters.from || filters.to), filters.free_food].filter(Boolean).length;
  const clearFilters = () => setFilters(emptyFilters);

  const countLabel = events.data
    ? `${placed.length} mapped${withoutLocation.length ? ` · ${withoutLocation.length} without pins` : ""}`
    : "";

  return (
    <main className="mx-auto max-w-7xl min-w-0 px-4">
      <PageHead kicker="Map" title="Explore campus" />

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search campus events, hosts, and places</span>
          <Search size={17} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={filters.q}
            onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
            placeholder="Search events or places"
            data-testid="input-search"
            className="h-12 w-full rounded-full border border-input bg-card pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-end">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : "Filters"}
                data-testid="button-map-filters"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
                {activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{activeFilterCount}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} className="z-[1200] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border-border bg-card p-4 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold">Filter events</h2>
                {hasFilters && <button type="button" onClick={clearFilters} data-testid="button-clear-filters" className="rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-secondary">Clear all</button>}
              </div>
              <div className="mt-4 space-y-4">
                <label className="block space-y-1.5 text-xs font-semibold text-muted-foreground">
                  Topic
                  <select
                    id="map-tag-filter"
                    value={filters.tag}
                    onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}
                    data-testid="select-tag"
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">All topics</option>
                    {summary?.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                    From
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
                      data-testid="input-from"
                      className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-2 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
                    To
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
                      data-testid="input-to"
                      className="h-10 w-full min-w-0 rounded-xl border border-input bg-background px-2 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>
                <label className="flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={filters.free_food}
                    onChange={(event) => setFilters((current) => ({ ...current, free_food: event.target.checked }))}
                    data-testid="toggle-free-food"
                    className="h-4 w-4 accent-[#990000]"
                  />
                  <UtensilsCrossed size={15} aria-hidden="true" className="text-muted-foreground" />
                  Free food only
                </label>
              </div>
            </PopoverContent>
          </Popover>
          <p className="min-w-0 text-right text-xs text-muted-foreground sm:text-sm" aria-live="polite" aria-label={events.data ? `${placed.length} events on map, ${withoutLocation.length} events without map coordinates` : undefined} data-testid="text-count">{countLabel}</p>
        </div>
      </div>

      <section className="mt-4 grid min-w-0 gap-4 lg:h-[640px] lg:grid-cols-[minmax(290px,360px)_minmax(0,1fr)]" aria-label="Campus events and map">
        <aside className="order-2 flex min-w-0 flex-col overflow-hidden rounded-3xl border border-card-border bg-card shadow-sm lg:order-1 lg:h-full" aria-label="Event results">
          <header className="flex min-h-[68px] items-center justify-between gap-3 border-b border-border px-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-primary">Around campus</p>
              <h2 className="mt-1 font-display text-xl font-bold">Coming up</h2>
            </div>
            {events.data && <span className="grid h-7 min-w-7 place-items-center rounded-full bg-secondary px-2 font-mono text-[10px] font-semibold text-primary">{visible.length}</span>}
          </header>
          <div className="min-h-0 flex-1 space-y-0 overflow-y-auto overscroll-contain">
            {events.isLoading && <div className="space-y-3 p-3"><CardSkeleton n={3} /></div>}
            {events.isError && <div className="p-3"><ErrorState what="events" onRetry={() => events.refetch()} /></div>}
            {events.data && visible.length === 0 && (
              <EmptyState
                title="No events match"
                body="Try another search or clear your filters."
                action={<button type="button" onClick={clearFilters} className="font-semibold text-primary underline">Clear filters</button>}
              />
            )}
            {placed.map((event) => {
              const conflict = isConflict(event, blocks);
              return (
                <article
                  key={event.id}
                  data-testid={`card-map-event-${event.id}`}
                  className={`flex min-w-0 items-stretch justify-between border-b border-border/70 transition-colors ${selectedId === event.id ? "bg-secondary/60 shadow-[inset_3px_0_0_hsl(var(--primary))]" : "hover:bg-secondary/35"}`}
                >
                  <button
                    type="button"
                    data-testid={`button-focus-event-${event.id}`}
                    aria-label={`Focus ${event.title} on map`}
                    onFocus={() => setSelectedId(event.id)}
                    onClick={() => setSelectedId(event.id)}
                    className="flex min-w-0 flex-1 flex-col items-start justify-center gap-1 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
                  >
                    <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{fmtWhen(event.start) ?? event.date_str ?? "Date TBD"}</span>
                    <span className="max-w-full truncate text-sm font-bold leading-snug text-foreground" title={event.title}>{event.title}</span>
                    <span className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground"><MapPin size={12} aria-hidden="true" className="shrink-0 text-primary" /><span className="truncate">{event.location || "Location TBD"}</span></span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1 px-2">
                    {event.free_food && <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-muted-foreground" aria-label="Free food" title="Free food"><UtensilsCrossed size={13} aria-hidden="true" /></span>}
                    {conflict && <span className="grid h-7 w-7 place-items-center rounded-full bg-destructive/10 text-destructive" aria-label="Class conflict" title="Class conflict"><AlertCircle size={14} aria-hidden="true" /></span>}
                    <button
                      type="button"
                      data-testid={`button-open-event-${event.id}`}
                      aria-label={`View details for ${event.title}`}
                      onClick={() => { setSelectedId(event.id); setOpen(event); }}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
            {withoutLocation.length > 0 && (
              <div className="bg-background/70 px-4 py-3" data-testid="section-location-tbd">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">No map pin</p>
                  <span className="font-mono text-[10px] text-primary">{withoutLocation.length}</span>
                </div>
                <div className="mt-1 divide-y divide-border/70">
                  {withoutLocation.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      data-testid={`button-tbd-event-${event.id}`}
                      onClick={() => setOpen(event)}
                      className="flex w-full min-w-0 items-center justify-between gap-2 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-[9px] uppercase text-muted-foreground">{fmtWhen(event.start) ?? event.date_str ?? "Date TBD"}</span>
                        <span className="mt-1 block truncate text-xs font-semibold text-foreground">{event.title}</span>
                      </span>
                      <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="relative z-0 order-1 h-[390px] min-w-0 overflow-hidden rounded-3xl border-4 border-card shadow-lg sm:h-[450px] lg:order-2 lg:h-full" data-testid="map">
          <MapContainer center={CENTER} zoom={16} scrollWheelZoom keyboard className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {placed.map((event) => (
              <Marker
                key={event.id}
                position={[event.lat!, event.lng!]}
                icon={eventPin(selectedId === event.id)}
                keyboard
                title={event.title}
                eventHandlers={{
                  click: () => { setSelectedId(event.id); setOpen(event); },
                  mouseover: () => setSelectedId(event.id),
                }}
              >
                <Tooltip direction="top" offset={[0, -28]}>{event.title}</Tooltip>
              </Marker>
            ))}
            {LANDMARKS.map((landmark) => {
              const nearbyEvents = eventsAt(landmark, visible);
              return (
                <Marker key={landmark.id} position={[landmark.lat, landmark.lng]} icon={landmarkIcon(landmark)} keyboard title={landmark.name} zIndexOffset={-500}>
                  <Popup className="landmark-popup" maxWidth={280}>
                    <div data-testid={`popup-landmark-${landmark.id}`}>
                      <p className="landmark-kind" style={{ color: KIND_COLOR[landmark.kind] }}>{landmark.kind}</p>
                      <p className="landmark-title">{landmark.name}</p>
                      <p className="landmark-blurb">{landmark.blurb}</p>
                      {nearbyEvents.length > 0 ? (
                        <div className="landmark-events">
                          <p className="landmark-kind">Events here ({nearbyEvents.length})</p>
                          {nearbyEvents.slice(0, 5).map((event) => (
                            <button key={event.id} type="button" data-testid={`button-landmark-event-${event.id}`} onClick={() => { setSelectedId(event.id); setOpen(event); }}>
                              {event.title}
                            </button>
                          ))}
                        </div>
                      ) : <p className="landmark-none">No listed events here right now.</p>}
                      <p className="landmark-note">Location approximate. <a href="https://www.usc.edu/campus-maps-pdf" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">Official USC campus map <ExternalLink size={10} aria-hidden="true" /></a></p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            <FlyTo event={selected} />
            <MapReset />
          </MapContainer>
          <div className="pointer-events-none absolute bottom-3 left-3 z-[500] inline-flex items-center gap-3 rounded-full border border-border/80 bg-card/95 px-3 py-2 text-[10px] font-semibold text-muted-foreground shadow-md">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-card bg-primary shadow-sm" aria-hidden="true" />Events</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] border-2 border-card bg-[#657c75] shadow-sm" aria-hidden="true" />Places</span>
          </div>
        </div>
      </section>

      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? isConflict(open, blocks) : false} />
    </main>
  );
}
