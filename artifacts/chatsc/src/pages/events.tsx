import { useDeferredValue, useMemo, useState } from "react";
import { useGetEvents, useGetProfile, type CampusEvent } from "@workspace/api-client-react";
import { EventCard, EventDialog, EventFilterBar } from "@/components/events-ui";
import { CardSkeleton, EmptyState, ErrorState, PageHead } from "@/components/bits";
import { emptyFilters, isConflict, toParams } from "@/lib/campus";

export default function Events() {
  const [filters, setFilters] = useState(emptyFilters);
  const deferred = useDeferredValue(filters);
  const params = useMemo(() => toParams(deferred), [deferred]);
  const events = useGetEvents(params);
  const { data: profile } = useGetProfile();
  const blocks = profile?.availability ?? [];
  const [open, setOpen] = useState<CampusEvent | null>(null);
  return (
    <div className="max-w-6xl mx-auto px-4">
      <PageHead kicker="Discover" title="What's on around campus">Filter by vibe, date, or the most important tag of all: free food.</PageHead>
      <EventFilterBar value={filters} onChange={setFilters} />
      <p className="mt-4 text-sm text-muted-foreground" aria-live="polite" data-testid="text-count">{events.data ? `${events.data.length} event${events.data.length === 1 ? "" : "s"}` : ""}</p>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.isLoading && <CardSkeleton n={6} />}
        {events.isError && <ErrorState what="events" onRetry={() => events.refetch()} />}
        {events.data?.length === 0 && <EmptyState title="No events match" body="Loosen a filter or clear the date range to see more." action={<button onClick={() => setFilters(emptyFilters)} className="text-primary font-semibold underline">Clear filters</button>} />}
        {events.data?.map((e) => <EventCard key={e.id} ev={e} conflict={isConflict(e, blocks)} onOpen={() => setOpen(e)} />)}
      </div>
      <EventDialog ev={open} onClose={() => setOpen(null)} conflict={open ? isConflict(open, blocks) : false} />
    </div>
  );
}
