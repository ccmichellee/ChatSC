import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { CalendarDays, ChevronRight, ExternalLink, LocateFixed, MapPin, Search, SlidersHorizontal, UtensilsCrossed, X } from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./_group.css";
import "./MapRedesign.css";

type CampusEvent = {
  id: number;
  title: string;
  host: string;
  start: string;
  date: string;
  location: string;
  lat: number | null;
  lng: number | null;
  category: string;
  topic: string;
  source: string;
  freeFood: boolean;
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

const events: CampusEvent[] = [
  { id: 1, title: "AI@USC Hackathon", host: "HackSC", start: "2026-11-14T09:00:00-08:00", date: "Sat, Nov 14 · 9:00 AM", location: "Ginsburg Hall Auditorium", lat: 34.02345, lng: -118.2852, category: "Technology", topic: "Hackathons", source: "USC Calendar", freeFood: true, description: "Build, learn, and meet other students at a campus hackathon." },
  { id: 2, title: "Spotlight Cabaret", host: "USC Student Life", start: "2026-11-14T14:00:00-08:00", date: "Sat, Nov 14 · 2:00 PM", location: "Tommy's Place · TCC", lat: 34.02054, lng: -118.2863, category: "Arts & culture", topic: "Music & dance", source: "USC Calendar", freeFood: false, description: "A student performance in the Tutor Campus Center." },
  { id: 3, title: "Student Symphony Orchestra", host: "Student Symphony Orchestra", start: "2026-11-15T19:30:00-08:00", date: "Sun, Nov 15 · 7:30 PM", location: "Bovard Auditorium", lat: 34.02072, lng: -118.2849, category: "Arts & culture", topic: "Music & dance", source: "EngageSC", freeFood: false, description: "An evening concert at Bovard Auditorium." },
  { id: 4, title: "Career Center Drop-In Hours", host: "USC Career Center", start: "2026-11-16T12:00:00-08:00", date: "Mon, Nov 16 · 12:00 PM", location: "Location to be announced", lat: null, lng: null, category: "Career", topic: "Career", source: "EngageSC", freeFood: false, description: "Bring your questions for a quick career conversation." },
  { id: 5, title: "McCarthy Quad Study Break", host: "USC Student Assembly", start: "2026-11-15T16:00:00-08:00", date: "Sun, Nov 15 · 4:00 PM", location: "McCarthy Quad", lat: 34.0212, lng: -118.2835, category: "Community", topic: "Student life", source: "EngageSC", freeFood: true, description: "Take a breather with music, snacks, and other Trojans." },
  { id: 6, title: "Village Farmers Market", host: "USC Village", start: "2026-11-14T11:00:00-08:00", date: "Sat, Nov 14 · 11:00 AM", location: "USC Village", lat: 34.0254, lng: -118.2853, category: "Community", topic: "Food & drink", source: "USC Calendar", freeFood: false, description: "A neighborhood market with local produce and makers." },
];

const landmarks: Landmark[] = [
  { id: "doheny", name: "Edward L. Doheny Jr. Memorial Library", short: "Doheny", kind: "Library", lat: 34.0202, lng: -118.2837, keywords: ["doheny"], blurb: "Doheny Memorial Library on University Park campus." },
  { id: "leavey", name: "Thomas and Dorothy Leavey Library", short: "Leavey", kind: "Library", lat: 34.0218, lng: -118.2829, keywords: ["leavey"], blurb: "Leavey Library on the eastern side of campus." },
  { id: "tcc", name: "Ronald Tutor Campus Center", short: "TCC", kind: "Student life", lat: 34.0205, lng: -118.2863, keywords: ["tcc", "tutor campus"], blurb: "Student center with meeting and event spaces." },
  { id: "tommy", name: "Tommy Trojan", short: "Tommy Trojan", kind: "Landmark", lat: 34.0206, lng: -118.2856, keywords: ["tommy trojan", "hahn plaza"], blurb: "The Trojan Shrine in Hahn Central Plaza." },
  { id: "bovard", name: "Bovard Auditorium", short: "Bovard", kind: "Venue", lat: 34.0207, lng: -118.2849, keywords: ["bovard"], blurb: "A USC performance venue for campus events." },
  { id: "mccarthy", name: "McCarthy Quad", short: "McCarthy Quad", kind: "Landmark", lat: 34.0212, lng: -118.2835, keywords: ["mccarthy"], blurb: "An outdoor campus venue between Leavey and Doheny." },
  { id: "village", name: "USC Village", short: "USC Village", kind: "Student life", lat: 34.0254, lng: -118.2853, keywords: ["usc village", "village"], blurb: "Residential, dining, and retail spaces north of campus." },
  { id: "annenberg", name: "Wallis Annenberg Hall", short: "Annenberg", kind: "Academic", lat: 34.0221, lng: -118.2867, keywords: ["annenberg"], blurb: "Home of the USC Annenberg School." },
  { id: "lyon", name: "Lyon Center", short: "Lyon Center", kind: "Athletics", lat: 34.0242, lng: -118.2884, keywords: ["lyon"], blurb: "USC recreational sports facility." },
  { id: "galen", name: "Galen Center", short: "Galen Center", kind: "Athletics", lat: 34.0213, lng: -118.2797, keywords: ["galen"], blurb: "USC arena and event venue near campus." },
];

const CENTER: [number, number] = [34.0224, -118.2851];
const colorFor: Record<string, string> = { Library: "#526f83", "Student life": "#990000", Venue: "#7c593e", Landmark: "#a18435", Academic: "#687751", Athletics: "#467468" };
const topics = Array.from(new Set(events.map((event) => event.topic)));

function eventIcon(active: boolean) {
  return L.divIcon({
    className: "map-event-icon",
    html: `<span class="mr-event-pin${active ? " is-active" : ""}"><i></i></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 34],
  });
}

function landmarkIcon(landmark: Landmark) {
  return L.divIcon({
    className: "landmark-icon",
    html: `<span class="mr-landmark"><i style="--landmark-color:${colorFor[landmark.kind] ?? "#777"}"></i><b>${landmark.short}</b></span>`,
    iconSize: [Math.max(64, landmark.short.length * 7 + 34), 20],
    iconAnchor: [6, 10],
  });
}

function FlyTo({ event }: { event?: CampusEvent }) {
  const map = useMap();
  useEffect(() => {
    if (event?.lat != null && event.lng != null) map.flyTo([event.lat, event.lng], 17, { duration: 0.55 });
  }, [event, map]);
  return null;
}

function MapReset() {
  const map = useMap();
  return <button type="button" className="mr-map-reset" aria-label="Return map to campus overview" onClick={() => map.setView(CENTER, 16)}><LocateFixed size={16} /></button>;
}

function landmarkEvents(landmark: Landmark, visible: CampusEvent[]) {
  return visible.filter((event) => {
    const location = event.location.toLowerCase();
    if (landmark.keywords.some((word) => location.includes(word))) return true;
    if (event.lat == null || event.lng == null) return false;
    const dy = (landmark.lat - event.lat) * 111_000;
    const dx = (landmark.lng - event.lng) * 111_000 * Math.cos((landmark.lat * Math.PI) / 180);
    return Math.hypot(dx, dy) < 60;
  });
}

export function MapRedesign() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [day, setDay] = useState("");
  const [foodOnly, setFoodOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openEvent, setOpenEvent] = useState<CampusEvent | null>(null);

  const visible = useMemo(() => events.filter((event) => {
    const searchable = `${event.title} ${event.host} ${event.location} ${event.category} ${event.topic}`.toLowerCase();
    return searchable.includes(query.toLowerCase())
      && (!topic || event.topic === topic)
      && (!day || event.start.slice(0, 10) === day)
      && (!foodOnly || event.freeFood);
  }), [query, topic, day, foodOnly]);
  const placed = visible.filter((event) => event.lat != null && event.lng != null);
  const withoutLocation = visible.filter((event) => event.lat == null || event.lng == null);
  const selected = placed.find((event) => event.id === selectedId);
  const activeFilters = !!query || !!topic || !!day || foodOnly;
  const reset = () => { setQuery(""); setTopic(""); setDay(""); setFoodOnly(false); setSelectedId(null); };

  return (
    <main className="map-redesign">
      <header className="mr-topbar">
        <div className="mr-brand">
          <span className="mr-brand-mark" aria-hidden="true">SC</span>
          <span>ChatSC</span>
          <span className="mr-divider" />
          <span className="mr-page-label">Campus map</span>
        </div>
        <div className="mr-live-note"><span className="mr-live-dot" /> University Park</div>
      </header>

      <section className="mr-heading">
        <div>
          <p className="mr-eyebrow">DISCOVER · UNIVERSITY PARK</p>
          <h1>Campus, in good company.</h1>
        </div>
        <p className="mr-heading-meta"><strong>{visible.length}</strong> events <span>·</span> <strong>{landmarks.length}</strong> places</p>
      </section>

      <section className="mr-controls" role="search" aria-label="Search and filter campus events">
        <label className="mr-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Search events and places</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events or places" />
          {query && <button type="button" className="mr-clear-search" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}
        </label>
        <span className="mr-control-divider" />
        <label className="mr-topic-select">
          <SlidersHorizontal size={15} aria-hidden="true" />
          <span className="sr-only">Filter by topic</span>
          <select value={topic} onChange={(event) => setTopic(event.target.value)} aria-label="Filter by topic">
            <option value="">All topics</option>
            {topics.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="mr-topic-select mr-date-select">
          <CalendarDays size={15} aria-hidden="true" />
          <span className="sr-only">Filter by date</span>
          <select value={day} onChange={(event) => setDay(event.target.value)} aria-label="Filter by date">
            <option value="">Any date</option>
            <option value="2026-11-14">Sat, Nov 14</option>
            <option value="2026-11-15">Sun, Nov 15</option>
            <option value="2026-11-16">Mon, Nov 16</option>
          </select>
        </label>
        <button type="button" className={`mr-food-filter${foodOnly ? " selected" : ""}`} aria-pressed={foodOnly} onClick={() => setFoodOnly((value) => !value)}>
          <UtensilsCrossed size={15} /> Free food
        </button>
        {activeFilters && <button type="button" className="mr-reset" onClick={reset}>Clear</button>}
      </section>

      <section className="mr-workspace">
        <aside className="mr-results" aria-label="Campus events">
          <div className="mr-results-heading">
            <div><span className="mr-eyebrow">AROUND CAMPUS</span><h2>Coming up</h2></div>
            <span className="mr-count">{visible.length}</span>
          </div>
          {visible.length === 0 ? (
            <div className="mr-empty">
              <span className="mr-empty-mark"><Search size={19} /></span>
              <h3>No matches here</h3>
              <p>Try a different search or clear your filters.</p>
              <button type="button" onClick={reset}>Reset view</button>
            </div>
          ) : (
            <div className="mr-event-list">
              {placed.map((event) => (
                <article key={event.id} className={`mr-event-row${selectedId === event.id ? " is-selected" : ""}`}>
                  <button type="button" className="mr-event-main" onClick={() => setSelectedId(event.id)} aria-label={`Focus ${event.title} on map`}>
                    <span className="mr-event-time">{event.date.split(" · ")[0]}</span>
                    <span className="mr-event-title">{event.title}</span>
                    <span className="mr-event-location"><MapPin size={13} />{event.location}</span>
                  </button>
                  <div className="mr-event-tail">
                    {event.freeFood && <span className="mr-food-badge" aria-label="Free food"><UtensilsCrossed size={12} /></span>}
                    <button type="button" aria-label={`View details for ${event.title}`} className="mr-open-event" onClick={() => { setSelectedId(event.id); setOpenEvent(event); }}><ChevronRight size={16} /></button>
                  </div>
                </article>
              ))}
              {withoutLocation.length > 0 && <div className="mr-unmapped">
                <div className="mr-unmapped-title"><span>Location to be announced</span><span>{withoutLocation.length}</span></div>
                {withoutLocation.map((event) => (
                  <button type="button" key={event.id} className="mr-tbd-event" onClick={() => setOpenEvent(event)}>
                    <span><span className="mr-event-time">{event.date.split(" · ")[0]}</span><strong>{event.title}</strong></span><ChevronRight size={15} />
                  </button>
                ))}
              </div>}
            </div>
          )}
        </aside>

        <div className="mr-map-shell" data-testid="map">
          <div className="mr-map-label"><MapPin size={14} /> UNIVERSITY PARK CAMPUS</div>
          <MapContainer center={CENTER} zoom={16} scrollWheelZoom keyboard={true} className="mr-leaflet-map">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {placed.map((event) => (
              <Marker key={event.id} position={[event.lat!, event.lng!]} icon={eventIcon(selectedId === event.id)} keyboard title={event.title}
                eventHandlers={{ click: () => { setSelectedId(event.id); setOpenEvent(event); }, mouseover: () => setSelectedId(event.id) }}>
                <Tooltip direction="top" offset={[0, -30]}>{event.title}</Tooltip>
              </Marker>
            ))}
            {landmarks.map((landmark) => {
              const near = landmarkEvents(landmark, visible);
              return <Marker key={landmark.id} position={[landmark.lat, landmark.lng]} icon={landmarkIcon(landmark)} keyboard title={landmark.name} zIndexOffset={-500}>
                <Popup className="landmark-popup" maxWidth={280}>
                  <div>
                    <p className="landmark-kind" style={{ color: colorFor[landmark.kind] }}>{landmark.kind}</p>
                    <p className="landmark-title">{landmark.name}</p>
                    <p className="landmark-blurb">{landmark.blurb}</p>
                    {near.length ? <div className="landmark-events"><p className="landmark-kind">Nearby events · {near.length}</p>
                      {near.slice(0, 4).map((event) => <button key={event.id} type="button" onClick={() => { setSelectedId(event.id); setOpenEvent(event); }}>{event.title}</button>)}
                    </div> : <p className="landmark-none">No listed events nearby right now.</p>}
                    <p className="landmark-note">Location approximate. <a href="https://www.usc.edu/campus-maps-pdf" target="_blank" rel="noreferrer">Official USC campus map <ExternalLink size={10} /></a></p>
                  </div>
                </Popup>
              </Marker>;
            })}
            <FlyTo event={selected} />
            <MapReset />
          </MapContainer>
          <div className="mr-map-key"><span className="mr-key-event" /> Events <span className="mr-key-place" /> Places</div>
        </div>
      </section>

      {openEvent && <div className="mr-modal-backdrop" role="presentation" onClick={() => setOpenEvent(null)}>
        <section className="mr-event-modal" role="dialog" aria-modal="true" aria-labelledby="mr-modal-title" onClick={(event) => event.stopPropagation()}>
          <div className="mr-modal-top"><span className="mr-eyebrow">{openEvent.category} <span>·</span> {openEvent.topic}</span>
            <button type="button" aria-label="Close event details" onClick={() => setOpenEvent(null)}><X size={18} /></button></div>
          <h2 id="mr-modal-title">{openEvent.title}</h2>
          <p className="mr-modal-host">Hosted by {openEvent.host}</p>
          <div className="mr-modal-meta"><p><CalendarDays size={16} />{openEvent.date}</p><p><MapPin size={16} />{openEvent.location}</p></div>
          <p className="mr-modal-description">{openEvent.description}</p>
          {openEvent.freeFood && <span className="mr-modal-food"><UtensilsCrossed size={13} /> Free food</span>}
          <div className="mr-modal-footer"><span>Source · {openEvent.source}</span><a href="https://calendar.usc.edu/" target="_blank" rel="noreferrer">View source <ExternalLink size={13} /></a></div>
        </section>
      </div>}
    </main>
  );
}
