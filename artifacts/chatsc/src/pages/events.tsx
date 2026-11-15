import { useDeferredValue, useMemo, useState } from "react";
import { useGetEvents, useGetProfile, type CampusEvent } from "@workspace/api-client-react";
import { EventCard, EventDialog, EventFilterBar } from "@/components/events-ui";
import { CardSkeleton, EmptyState, ErrorState, PageHead } from "@/components/bits";
import { emptyFilters, isConflict, laDateKey, toParams, type EventFilters } from "@/lib/campus";
import { classifyEvent, eventAudience } from "@/lib/event-categories";

export default function Events() {
  const defaultFilters = useMemo<EventFilters>(() => ({ ...emptyFilters, from: laDateKey() }), []);
  const [filters, setFilters] = useState(defaultFilters);
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [audience, setAudience] = useState("");
  const deferred = useDeferredValue(filters);
  const params = useMemo(() => toParams(deferred), [deferred]);
  const events = useGetEvents(params);
  const { data: profile } = useGetProfile();
  const blocks = profile?.availability ?? [];
  const [open, setOpen] = useState<CampusEvent | null>(null);
  const visibleEvents = useMemo(() => (events.data ?? []).filter((event) => {
    const taxonomy = classifyEvent(event);
    const eventAudienceType = eventAudience(event);
    return (!category || taxonomy.category === category)
      && (!subcategory || taxonomy.topic === subcategory)
      && (!audience || eventAudienceType.group === audience);
  }), [events.data, category, subcategory, audience]);
  const clearAll = () => {
    setFilters(defaultFilters);
    setCategory("");
    setSubcategory("");
    setAudience("");
  };
  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead kicker="Discover" title="Find your next event">Browse campus events by subject, date, and who can attend.</PageHead>
      <EventFilterBar
        value={filters}
        onChange={setFilters}
        events={events.data ?? []}
        category={category}
        onCategoryChange={(value) => { setCategory(value); setSubcategory(""); }}
        subcategory={subcategory}
        onSubcategoryChange={setSubcategory}
        audience={audience}
        onAudienceChange={setAudience}
        onClear={clearAll}
      />
      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite" data-testid="text-count">{events.data ? `${visibleEvents.length} event${visibleEvents.length === 1 ? "" : "s"}` : ""}</p>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.isLoading && <CardSkeleton n={6} />}
        {events.isError && <ErrorState what="events" onRetry={() => events.refetch()} />}
        {events.data && visibleEvents.length === 0 && <EmptyState title="No events match" body="Try another subject, audience, or date." action={<button onClick={clearAll} className="text-primary font-semibold underline">Clear filters</button>} />}
        {visibleEvents.map((e) => <EventCard key={e.id} ev={e} conflict={isConflict(e, blocks)} onOpen={() => setOpen(e)} />)}
      </div>
      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? isConflict(open, blocks) : false} />
    </div>
  );
}
