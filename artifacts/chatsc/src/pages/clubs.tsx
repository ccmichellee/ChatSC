import { useDeferredValue, useMemo, useState } from "react";
import { Clock, ExternalLink, Search, UsersRound, Building2, CheckCircle2 } from "lucide-react";
import { useGetClubs, type Club } from "@workspace/api-client-react";
import { CardSkeleton, EmptyState, ErrorState, PageHead, SampleBadge, Tag } from "@/components/bits";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampusResourceCard } from "@/components/campus-resource-card";
import { CAMPUS_RESOURCES, RESOURCE_CATEGORIES } from "@/lib/campus-resources";
import { CLUB_CATEGORIES, clubCategory } from "@/lib/club-categories";

export default function Clubs() {
  const [view, setView] = useState("clubs");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<Club | null>(null);
  const dq = useDeferredValue(q);
  const params = useMemo(() => dq.trim() ? { q: dq.trim() } : undefined, [dq]);
  const clubs = useGetClubs(params);
  const filteredClubs = (clubs.data ?? []).filter((c) => !category || clubCategory(c.category) === category);
  const normalizedQuery = dq.trim().toLowerCase();
  const filteredResources = CAMPUS_RESOURCES.filter((resource) => {
    const matchesCategory = !category || resource.category === category;
    const searchableText = `${resource.name} ${resource.category} ${resource.description} ${resource.helpfulFor}`.toLowerCase();
    return matchesCategory && (!normalizedQuery || searchableText.includes(normalizedQuery));
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4">
      <PageHead kicker="Discover" title="Find your people and campus support">
        Explore student-run communities and official USC resources in one place. Search for a group, find support, and choose a next step.
      </PageHead>
      <Tabs
        className="min-w-0"
        value={view}
        onValueChange={(nextView) => {
          setView(nextView);
          setCategory("");
        }}
      >
        <TabsList aria-label="Discovery sections" className="grid h-auto w-full max-w-xl grid-cols-2 gap-1 rounded-2xl p-1.5">
          <TabsTrigger value="clubs" className="min-h-12 gap-2 rounded-xl px-2 py-2.5 text-xs sm:text-sm" data-testid="tab-clubs">
            <UsersRound size={17} aria-hidden="true" />
            Clubs & Communities
          </TabsTrigger>
          <TabsTrigger value="resources" className="min-h-12 gap-2 rounded-xl px-2 py-2.5 text-xs sm:text-sm" data-testid="tab-resources">
            <Building2 size={17} aria-hidden="true" />
            Campus Resources
          </TabsTrigger>
        </TabsList>

        <div role="search" className="mt-5 flex flex-col gap-3">
          <label className="relative max-w-xl">
            <span className="sr-only">{view === "clubs" ? "Search clubs and communities" : "Search campus resources"}</span>
            <Search size={16} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={view === "clubs" ? "Search clubs by name or mission" : "Search resources by name or support"}
              data-testid="input-discovery-search"
              className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>

        <TabsContent value="clubs" className="mt-5" data-testid="panel-clubs">
          <div role="group" aria-label="Filter clubs by category" className="min-w-0 flex flex-nowrap gap-2 overflow-x-auto pb-2 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
            <Tag active={!category} onClick={() => setCategory("")}>All</Tag>
            {CLUB_CATEGORIES.map((clubType) => (
              <Tag key={clubType} active={category === clubType} onClick={() => setCategory(category === clubType ? "" : clubType)}>
                {clubType}
              </Tag>
            ))}
          </div>

          {!clubs.isLoading && !clubs.isError && (
            <p className="mt-3 text-sm text-muted-foreground" aria-live="polite" data-testid="text-club-count">
              {filteredClubs.length} {filteredClubs.length === 1 ? "club or community" : "clubs and communities"}
            </p>
          )}
          {clubs.isError && <div className="mt-5"><ErrorState what="clubs" onRetry={() => clubs.refetch()} /></div>}
          {!clubs.isLoading && !clubs.isError && filteredClubs.length === 0 && (
            <div className="mt-5"><EmptyState title="No clubs found" body="Try a different search or category." /></div>
          )}
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.isLoading && <CardSkeleton n={6} />}
            {filteredClubs.map((club, index) => (
              <article key={club.id} className={`min-w-0 rounded-3xl border p-5 transition-transform hover:-translate-y-1 ${index % 5 === 0 ? "bg-foreground text-background border-foreground" : "bg-card border-card-border"}`} data-testid={`card-club-${club.id}`}>
                <div className="flex items-center gap-2"><span className={`font-mono text-[11px] uppercase tracking-wider ${index % 5 === 0 ? "text-accent" : "text-primary"}`}>{clubCategory(club.category)}</span><SampleBadge show={club.sample_data} /></div>
                <h3 className="mt-2 font-display text-xl font-bold">{club.name}</h3>
                <p className={`mt-2 truncate text-sm ${index % 5 === 0 ? "text-background/80" : "text-muted-foreground"}`}>{club.description.length > 100 ? `${club.description.slice(0, 97).trimEnd()}…` : club.description}</p>
                <button type="button" onClick={() => setOpen(club)} className="mt-4 text-sm font-semibold underline underline-offset-4" data-testid={`link-club-${club.id}`}>Learn more</button>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="mt-5" data-testid="panel-resources">
          <div role="group" aria-label="Filter campus resources by category" className="min-w-0 flex flex-nowrap gap-2 overflow-x-auto pb-2 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
            <Tag active={!category} onClick={() => setCategory("")}>All resources</Tag>
            {RESOURCE_CATEGORIES.map((resourceCategory) => (
              <Tag key={resourceCategory} active={category === resourceCategory} onClick={() => setCategory(category === resourceCategory ? "" : resourceCategory)}>
                {resourceCategory}
              </Tag>
            ))}
          </div>

          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-resource-source-note">
            <CheckCircle2 size={16} className="shrink-0 text-primary" aria-hidden="true" />
            Campus resources link to official USC information.
          </p>
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite" data-testid="text-resource-count">
            {filteredResources.length} {filteredResources.length === 1 ? "resource" : "resources"}
          </p>
          {filteredResources.length === 0 ? (
            <div className="mt-5"><EmptyState title="No resources found" body="Try another search or category." /></div>
          ) : (
            <div className="mt-5 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredResources.map((resource) => <CampusResourceCard key={resource.id} resource={resource} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!open} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="rounded-3xl bg-card max-w-lg max-h-[85vh] overflow-y-auto">
          {open && <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{open.name}</DialogTitle>
              <DialogDescription>{clubCategory(open.category)}</DialogDescription>
            </DialogHeader>
            <SampleBadge show={open.sample_data} />
            <p className="text-sm whitespace-pre-line leading-relaxed">{open.description || "No description provided."}</p>
            <p className="text-sm flex gap-2"><Clock size={15} className="shrink-0" />{open.meeting_times || "Meeting times not listed"}</p>
            <p className="text-xs text-muted-foreground">Original categories: {open.category}</p>
            {/^https?:\/\//.test(open.source_url) && <a href={open.source_url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline inline-flex gap-1 items-center">Visit club page <ExternalLink size={13} /></a>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
