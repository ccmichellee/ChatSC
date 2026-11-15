import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { CalendarClock, ExternalLink, MapPin, Search, UtensilsCrossed, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./_group.css";

type Event = {
  id: number;
  title: string;
  host: string;
  start: string;
  date_str: string;
  location: string;
  lat: number | null;
  lng: number | null;
  category: string;
  topic: string;
  source: string;
  sample_data: boolean;
  free_food: boolean;
  description: string;
};

type Landmark = {
  id: string;
  name: string;
  short: string;
  kind: string;
  lat: number;
  lng: number;
  blurb: string;
  keywords: string[];
};

const events: Event[] = [
  {
    id: 1,
    title: "AI@USC Hackathon, powered by HackSC",
    host: "Host not listed",
    start: "2026-11-14T09:00:00-08:00",
    date_str: "Sat, Nov 14, 9:00 AM",
    location: "Ginsburg Hall, Ginsburg Hall Auditorium",
    lat: 34.02345,
    lng: -118.2852,
    category: "Technology & Engineering",
    topic: "Hackathons",
    source: "USC Calendar",
    sample_data: true,
    free_food: true,
    description: "Build, learn, and meet other students at a campus hackathon.",
  },
  {
    id: 2,
    title: "Spotlight Cabaret",
    host: "Host not listed",
    start: "2026-11-14T14:00:00-08:00",
    date_str: "Sat, Nov 14, 2:00 PM",
    location: "Tommy's Place (TCC)",
    lat: 34.02054,
    lng: -118.2863,
    category: "Arts & Culture",
    topic: "Music & dance",
    source: "USC Calendar",
    sample_data: true,
    free_food: false,
    description: "A student performance in the Tutor Campus Center.",
  },
  {
    id: 3,
    title: "Student Symphony Orchestra Fall '26 Concert",
    host: "Student Symphony Orchestra at USC",
    start: "2026-11-15T19:30:00-08:00",
    date_str: "Sun, Nov 15, 7:30 PM",
    location: "Bovard Auditorium",
    lat: 34.02072,
    lng: -118.2849,
    category: "Arts & Culture",
    topic: "Music & dance",
    source: "EngageSC",
    sample_data: true,
    free_food: false,
    description: "An evening concert at Bovard Auditorium.",
  },
  {
    id: 4,
    title: "Career Center Drop-In Hours",
    host: "USC Career Center",
    start: "2026-11-16T12:00:00-08:00",
    date_str: "Mon, Nov 16, 12:00 PM",
    location: "Location to be announced",
    lat: null,
    lng: null,
    category: "Business & Entrepreneurship",
    topic: "Career",
    source: "EngageSC",
    sample_data: true,
    free_food: false,
    description: "Bring your questions for a quick career conversation.",
  },
];

const landmarks: Landmark[] = [
  { id: "doheny", name: "Edward L. Doheny Jr. Memorial Library", short: "Doheny", kind: "Library", lat: 34.0202, lng: -118.2837, keywords: ["doheny"], blurb: "Doheny Memorial Library on USC's University Park campus." },
  { id: "leavey", name: "Thomas and Dorothy Leavey Library", short: "Leavey", kind: "Library", lat: 34.0218, lng: -118.2829, keywords: ["leavey"], blurb: "Leavey Library on the eastern side of University Park campus." },
  { id: "tcc", name: "Ronald Tutor Campus Center", short: "TCC", kind: "Student life", lat: 34.0205, lng: -118.2863, keywords: ["tutor campus", "tcc"], blurb: "Student campus center with meeting and event spaces." },
  { id: "tommy", name: "Tommy Trojan", short: "Tommy Trojan", kind: "Landmark", lat: 34.0206, lng: -118.2856, keywords: ["tommy trojan", "hahn plaza"], blurb: "The Trojan Shrine in Hahn Central Plaza." },
  { id: "bovard", name: "Bovard Auditorium", short: "Bovard", kind: "Venue", lat: 34.0207, lng: -118.2849, keywords: ["bovard"], blurb: "A USC performance venue used for campus events." },
  { id: "mccarthy", name: "McCarthy Quad", short: "McCarthy Quad", kind: "Landmark", lat: 34.0212, lng: -118.2835, keywords: ["mccarthy quad"], blurb: "An outdoor campus venue between Leavey and Doheny libraries." },
  { id: "village", name: "USC Village", short: "USC Village", kind: "Student life", lat: 34.0254, lng: -118.2853, keywords: ["usc village", "village"], blurb: "Residential, dining, and retail spaces north of Jefferson Boulevard." },
  { id: "annenberg", name: "Wallis Annenberg Hall", short: "Annenberg", kind: "Academic", lat: 34.0221, lng: -118.2867, keywords: ["annenberg"], blurb: "An academic building for the USC Annenberg School." },
  { id: "lyon", name: "Lyon Center", short: "Lyon Center", kind: "Athletics", lat: 34.0242, lng: -118.2884, keywords: ["lyon center", "lyon"], blurb: "A USC recreational sports facility." },
  { id: "galen", name: "Galen Center", short: "Galen Center", kind: "Athletics", lat: 34.0213, lng: -118.2797, keywords: ["galen"], blurb: "USC arena and event venue near University Park campus." },
];

const kindColors: Record<string, string> = {
  Library: "#2f5d8a",
  "Student life": "#990000",
  Dining: "#b4561b",
  Academic: "#4b5a2a",
  Venue: "#6b3f8f",
  Landmark: "#8a6d00",
  Athletics: "#1f6f6b",
};

const emptyFilters = { q: "", tag: "", from: "", to: "", free_food: false };
const CENTER: [number, number] = [34.0224, -118.2851];

function landmarkEvents(landmark: Landmark, visibleEvents: Event[]) {
  return visibleEvents.filter((event) => {
    const location = event.location.toLowerCase();
    if (landmark.keywords.some((word) => location.includes(word))) return true;
    if (event.lat == null || event.lng == null) return false;
    const dy = (landmark.lat - event.lat) * 111_000;
    const dx = (landmark.lng - event.lng) * 111_000 * Math.cos((landmark.lat * Math.PI) / 180);
    return Math.hypot(dx, dy) < 60;
  });
}

const landmarkIcon = (landmark: Landmark) => L.divIcon({
  className: "landmark-icon",
  html: `<div class="landmark-pin"><span class="landmark-dot" style="background:${kindColors[landmark.kind]}"></span><span class="landmark-name">${landmark.short}</span></div>`,
  iconSize: [0, 0],
  iconAnchor: [6, 6],
});

const eventPin = (active: boolean) => L.divIcon({
  className: "",
  html: `<div style="width:${active ? 30 : 22}px;height:${active ? 30 : 22}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active ? "#FFCC00" : "#990000"};border:3px solid #FBFAF4;box-shadow:0 4px 10px rgba(60,0,0,.35);transition:all .2s"></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

function FlyTo({ event }: { event: Event | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (event?.lat != null && event?.lng != null) map.flyTo([event.lat, event.lng], 17, { duration: 0.6 });
  }, [event, map]);
  return null;
}

function PageHead() {
  return (
    <div className="rise pt-8 pb-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Map</p>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight mt-2 text-balance">Campus, pinned</h1>
    </div>
  );
}

function EventCard({ event, selected, onOpen }: { event: Event; selected?: boolean; onOpen: () => void }) {
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.start));
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group text-left w-full rounded-3xl bg-card border p-5 transition-all hover:-translate-y-1 hover:shadow-[0_12px_30px_-12px_hsl(0_100%_30%/0.35)] ${selected ? "border-primary ring-2 ring-primary/30" : "border-card-border"}`}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{event.category}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">{event.topic}</span>
        {event.sample_data && <span className="rounded-full border border-dashed border-primary/60 text-primary px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">Sample</span>}
        {event.free_food && <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold"><UtensilsCrossed size={10} /> Free food</span>}
      </div>
      <h3 className="font-display text-lg font-bold leading-snug mt-2 group-hover:text-primary transition-colors">{event.title}</h3>
      <p className="text-sm text-muted-foreground">by {event.host}</p>
      <div className="mt-3 space-y-1 text-sm">
        <p className="flex items-start gap-2"><CalendarClock size={15} className="mt-0.5 shrink-0 text-primary" />{date}</p>
        <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-primary" />{event.location}</p>
      </div>
      <p className="mt-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{event.source} · Updated 1 hr ago</p>
    </button>
  );
}

export function Current() {
  const [filters, setFilters] = useState(emptyFilters);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openEvent, setOpenEvent] = useState<Event | null>(null);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesQuery = `${event.title} ${event.host} ${event.location} ${event.category} ${event.topic}`.toLowerCase().includes(filters.q.toLowerCase());
    const matchesTag = !filters.tag || event.topic === filters.tag;
    const matchesFood = !filters.free_food || event.free_food;
    const date = event.start.slice(0, 10);
    const matchesFrom = !filters.from || date >= filters.from;
    const matchesTo = !filters.to || date <= filters.to;
    return matchesQuery && matchesTag && matchesFood && matchesFrom && matchesTo;
  }), [filters]);
  const placed = visibleEvents.filter((event) => event.lat != null && event.lng != null);
  const tbd = visibleEvents.filter((event) => event.lat == null || event.lng == null);
  const selected = placed.find((event) => event.id === selectedId);
  const dirty = filters.q || filters.tag || filters.from || filters.to || filters.free_food;

  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead />
      <div role="search" className="rounded-3xl bg-card/70 border border-card-border p-3 flex flex-wrap gap-2 items-center">
        <label className="relative flex-1 min-w-[200px]">
          <span className="sr-only">Search events</span>
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="Search events, hosts, places" className="h-10 rounded-full bg-card border border-input px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full pl-10" />
        </label>
        <label className="sr-only" htmlFor="current-tag-filter">Tag</label>
        <select id="current-tag-filter" value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })} className="h-10 rounded-full bg-card border border-input px-4 text-sm" aria-label="All tags">
          <option value="">All tags</option>
          {Array.from(new Set(events.map((event) => event.topic))).map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="h-10 rounded-full bg-card border border-input px-4 text-sm" /></label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="h-10 rounded-full bg-card border border-input px-4 text-sm" /></label>
        <button type="button" aria-pressed={filters.free_food} onClick={() => setFilters({ ...filters, free_food: !filters.free_food })} className={`h-10 rounded-full px-4 text-sm font-semibold inline-flex items-center gap-2 border ${filters.free_food ? "bg-accent border-accent text-accent-foreground" : "border-input bg-card"}`}>
          <UtensilsCrossed size={14} /> Free food
        </button>
        {dirty && <button type="button" onClick={() => setFilters(emptyFilters)} className="h-10 rounded-full px-3 text-sm inline-flex items-center gap-1 hover:bg-secondary"><X size={14} />Clear</button>}
      </div>

      <div className="mt-4 grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="order-2 lg:order-1 lg:h-[640px] overflow-y-auto space-y-3 pr-1" aria-label="Events list">
          {visibleEvents.length === 0 && <p className="text-sm text-muted-foreground p-4">No events match these filters.</p>}
          {placed.map((event) => (
            <div key={event.id} onMouseEnter={() => setSelectedId(event.id)}>
              <EventCard event={event} selected={selectedId === event.id} onOpen={() => {
                if (selectedId === event.id) setOpenEvent(event);
                else setSelectedId(event.id);
              }} />
            </div>
          ))}
          {tbd.length > 0 && (
            <div className="rounded-3xl border-2 border-dashed border-border p-3">
              <p className="font-display font-bold px-2">Location TBD <span className="font-mono text-xs text-muted-foreground">({tbd.length})</span></p>
              <p className="text-xs text-muted-foreground px-2 mb-2">No map coordinates from the source.</p>
              <div className="space-y-3">{tbd.map((event) => <EventCard key={event.id} event={event} onOpen={() => setOpenEvent(event)} />)}</div>
            </div>
          )}
        </div>
        <div className="order-1 lg:order-2 h-[380px] lg:h-[640px] rounded-3xl border-4 border-card shadow-lg overflow-hidden" data-testid="map">
          <MapContainer center={CENTER} zoom={16} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {placed.map((event) => (
              <Marker key={event.id} position={[event.lat!, event.lng!]} icon={eventPin(selectedId === event.id)} keyboard title={event.title}
                eventHandlers={{ click: () => { setSelectedId(event.id); setOpenEvent(event); }, mouseover: () => setSelectedId(event.id) }}>
                <Tooltip direction="top" offset={[0, -28]}>{event.title}</Tooltip>
              </Marker>
            ))}
            {landmarks.map((landmark) => {
              const here = landmarkEvents(landmark, visibleEvents);
              return (
                <Marker key={landmark.id} position={[landmark.lat, landmark.lng]} icon={landmarkIcon(landmark)} keyboard title={landmark.name} zIndexOffset={-500}>
                  <Popup className="landmark-popup" maxWidth={280}>
                    <div>
                      <p className="landmark-kind" style={{ color: kindColors[landmark.kind] }}>{landmark.kind}</p>
                      <p className="landmark-title">{landmark.name}</p>
                      <p className="landmark-blurb">{landmark.blurb}</p>
                      {here.length > 0 ? <div className="landmark-events">
                        <p className="landmark-kind">Events here ({here.length})</p>
                        {here.slice(0, 5).map((event) => <button key={event.id} type="button" onClick={() => { setSelectedId(event.id); setOpenEvent(event); }}>{event.title}</button>)}
                      </div> : <p className="landmark-none">No listed events here right now.</p>}
                      <p className="landmark-note">Location approximate. <a href="https://www.usc.edu/campus-maps-pdf" target="_blank" rel="noreferrer" className="underline">Official USC campus map</a></p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            <FlyTo event={selected} />
          </MapContainer>
        </div>
      </div>

      {openEvent && <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/40 p-4" role="presentation" onClick={() => setOpenEvent(null)}>
        <div role="dialog" aria-modal="true" aria-labelledby="current-event-title" className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-mono text-xs uppercase text-primary">{openEvent.category} · {openEvent.topic}</p><h2 id="current-event-title" className="font-display text-2xl font-extrabold mt-2">{openEvent.title}</h2><p className="text-sm text-muted-foreground">Hosted by {openEvent.host}</p></div>
            <button type="button" aria-label="Close event details" onClick={() => setOpenEvent(null)} className="rounded-full p-2 hover:bg-secondary"><X size={18} /></button>
          </div>
          <div className="space-y-2 text-sm mt-5">
            <p>{openEvent.date_str}</p><p>{openEvent.location}</p><p className="pt-2">{openEvent.description}</p>
          </div>
          <a href="https://calendar.usc.edu/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">View source <ExternalLink size={14} /></a>
        </div>
      </div>}
    </div>
  );
}
