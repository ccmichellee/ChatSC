import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGetEvents, useGetProfile, type CampusEvent } from "@workspace/api-client-react";
import { EventCard, EventDialog, EventFilterBar } from "@/components/events-ui";
import { CardSkeleton, ErrorState, PageHead } from "@/components/bits";
import { emptyFilters, isConflict, toParams } from "@/lib/campus";

const CENTER: [number, number] = [34.0224, -118.2851];
const pin = (active: boolean) => L.divIcon({
  className: "",
  html: `<div style="width:${active ? 30 : 22}px;height:${active ? 30 : 22}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${active ? "#FFCC00" : "#990000"};border:3px solid #FBFAF4;box-shadow:0 4px 10px rgba(60,0,0,.35);transition:all .2s"></div>`,
  iconSize: [30, 30], iconAnchor: [15, 30],
});

function FlyTo({ ev }: { ev: CampusEvent | undefined }) {
  const map = useMap();
  useEffect(() => { if (ev?.lat != null && ev?.lng != null) map.flyTo([ev.lat, ev.lng], 17, { duration: 0.6 }); }, [ev, map]);
  return null;
}

export default function MapPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const deferred = useDeferredValue(filters);
  const params = useMemo(() => toParams(deferred), [deferred]);
  const events = useGetEvents(params);
  const { data: profile } = useGetProfile();
  const blocks = profile?.availability ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const placed = (events.data ?? []).filter((e) => e.lat != null && e.lng != null);
  const tbd = (events.data ?? []).filter((e) => e.lat == null || e.lng == null);
  const selected = placed.find((e) => e.id === sel);

  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead kicker="Map" title="Campus, pinned" />
      <EventFilterBar value={filters} onChange={setFilters} />
      <div className="mt-4 grid lg:grid-cols-[380px_1fr] gap-4">
        <div className="order-2 lg:order-1 lg:h-[640px] overflow-y-auto space-y-3 pr-1" aria-label="Events list">
          {events.isLoading && <CardSkeleton n={3} />}
          {events.isError && <ErrorState what="events" onRetry={() => events.refetch()} />}
          {events.data?.length === 0 && <p className="text-sm text-muted-foreground p-4">No events match these filters.</p>}
          {placed.map((e) => (
            <div key={e.id} onMouseEnter={() => setSel(e.id)}>
              <EventCard ev={e} compact selected={sel === e.id} conflict={isConflict(e, blocks)} onOpen={() => { if (sel === e.id) setOpen(e); else setSel(e.id); }} />
            </div>
          ))}
          {tbd.length > 0 && (
            <div className="rounded-3xl border-2 border-dashed border-border p-3">
              <p className="font-display font-bold px-2">Location TBD <span className="font-mono text-xs text-muted-foreground">({tbd.length})</span></p>
              <p className="text-xs text-muted-foreground px-2 mb-2">No map coordinates from the source.</p>
              <div className="space-y-3">{tbd.map((e) => <EventCard key={e.id} ev={e} compact conflict={isConflict(e, blocks)} onOpen={() => setOpen(e)} />)}</div>
            </div>
          )}
        </div>
        <div className="order-1 lg:order-2 h-[380px] lg:h-[640px] rounded-3xl border-4 border-card shadow-lg overflow-hidden" data-testid="map">
          <MapContainer center={CENTER} zoom={16} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {placed.map((e) => (
              <Marker key={e.id} position={[e.lat!, e.lng!]} icon={pin(sel === e.id)} keyboard title={e.title}
                eventHandlers={{ click: () => { setSel(e.id); setOpen(e); }, mouseover: () => setSel(e.id) }}>
                <Tooltip direction="top" offset={[0, -28]}>{e.title}</Tooltip>
              </Marker>
            ))}
            <FlyTo ev={selected} />
          </MapContainer>
        </div>
      </div>
      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? isConflict(open, blocks) : false} />
    </div>
  );
}
