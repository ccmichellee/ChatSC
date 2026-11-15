import { CalendarClock, CalendarDays, ExternalLink, MapPin, Search, UtensilsCrossed, BellRing, AlertCircle, X, Users } from "lucide-react";
import { useGetSummary, type CampusEvent } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SampleBadge } from "./bits";
import { fmtWhen, laDateKey, timeAgo, type EventFilters, emptyFilters } from "@/lib/campus";
import { classifyEvent, EVENT_CATEGORIES, eventAudience } from "@/lib/event-categories";

export function EventCard({ ev, onOpen, conflict, compact, selected }: { ev: CampusEvent; onOpen: () => void; conflict?: boolean; compact?: boolean; selected?: boolean }) {
  const when = fmtWhen(ev.start) ?? ev.date_str;
  const taxonomy = classifyEvent(ev);
  const audience = eventAudience(ev);
  return (
    <button type="button" onClick={onOpen} data-testid={`card-event-${ev.id}`}
      className={`group text-left w-full rounded-3xl bg-card border p-5 transition-all hover:-translate-y-1 hover:shadow-[0_12px_30px_-12px_hsl(0_100%_30%/0.35)] ${selected ? "border-primary ring-2 ring-primary/30" : "border-card-border"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{taxonomy.category}</span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">{taxonomy.topic}</span>
        <SampleBadge show={ev.sample_data} />
        {ev.free_food && <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold"><UtensilsCrossed size={10} /> Free food</span>}
        {conflict && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase"><AlertCircle size={10} /> Class conflict</span>}
      </div>
      <h3 className="font-display text-lg font-bold leading-snug mt-2 group-hover:text-primary transition-colors">{ev.title}</h3>
      <p className="text-sm text-muted-foreground">by {ev.host || "Unknown host"}</p>
      <div className="mt-3 space-y-1 text-sm">
        <p className="flex items-start gap-2"><CalendarClock size={15} className="mt-0.5 shrink-0 text-primary" />{when || "Date TBD"}</p>
        <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-primary" />{ev.location || "Location TBD"}</p>
      </div>
      {!compact && <p className="flex items-start gap-2 mt-3 text-xs text-muted-foreground"><Users size={14} className="mt-0.5 shrink-0" />{audience.label}</p>}
      {ev.matched_reasons && ev.matched_reasons.length > 0 && <p className="mt-3 text-xs text-foreground/80 bg-accent/25 rounded-xl px-3 py-1.5">Why: {ev.matched_reasons.join(" · ")}</p>}
      <p className="mt-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{ev.source} · {timeAgo(ev.updated_at)}</p>
    </button>
  );
}

export function EventDialog({ ev, onClose, conflict }: { ev: CampusEvent | null; onClose: () => void; conflict?: boolean }) {
  const { toast } = useToast();
  const taxonomy = ev ? classifyEvent(ev) : null;
  const audience = ev ? eventAudience(ev) : null;
  return (
    <Dialog open={!!ev} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl bg-card max-w-lg">
        {ev && <>
          <DialogHeader>
            <div className="flex gap-2 items-center flex-wrap"><span className="font-mono text-xs uppercase text-primary">{taxonomy?.category}</span><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{taxonomy?.topic}</span><SampleBadge show={ev.sample_data} /></div>
            <DialogTitle className="font-display text-2xl font-extrabold">{ev.title}</DialogTitle>
            <DialogDescription>Hosted by {ev.host || "Unknown host"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="flex gap-2"><CalendarClock size={16} className="text-primary" />{fmtWhen(ev.start) ?? (ev.date_str || "Date TBD")}{ev.end && fmtWhen(ev.end) ? ` – ${fmtWhen(ev.end)}` : ""}</p>
            <p className="flex gap-2"><MapPin size={16} className="text-primary" />{ev.location || "Location TBD"}</p>
            <p className="flex gap-2"><Users size={16} className="text-primary" />{audience?.label}</p>
            {conflict && <p className="flex gap-2 text-destructive font-medium"><AlertCircle size={16} />Overlaps one of your class blocks.</p>}
            <p className="pt-2 leading-relaxed whitespace-pre-line">{ev.description || "No description provided by the source."}</p>
            {ev.free_food && <p className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"><UtensilsCrossed size={12} /> Free food</p>}
            <p className="font-mono text-[11px] text-muted-foreground pt-2">Source: {ev.source} · {timeAgo(ev.updated_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button data-testid="button-remind" onClick={() => toast({ title: "Reminder noted (preview only)", description: "This is a UI demo. No actual reminder or text will be sent." })}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:-translate-y-0.5 transition-transform"><BellRing size={15} /> Remind me</button>
            {ev.source_url && <a href={ev.source_url} target="_blank" rel="noreferrer" data-testid="link-source"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">View source <ExternalLink size={14} /></a>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}

const field = "h-10 rounded-full bg-card border border-input px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function rangeFor(preset: string): [string, string] {
  const today = laDateKey();
  if (preset === "upcoming") return [today, ""];
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  if (preset === "today") return [today, today];
  if (preset === "week") {
    const mondayOffset = (weekday + 6) % 7;
    const monday = addDays(today, -mondayOffset);
    return [monday, addDays(monday, 6)];
  }
  if (preset === "weekend") {
    const saturday = weekday === 0 ? today : addDays(today, (6 - weekday + 7) % 7);
    return [saturday, weekday === 0 ? today : addDays(saturday, 1)];
  }
  return ["", ""];
}

function activeDatePreset(value: EventFilters) {
  for (const [preset, key] of [["upcoming", "upcoming"], ["today", "today"], ["week", "week"], ["weekend", "weekend"]] as const) {
    const [from, to] = rangeFor(key);
    if (value.from === from && value.to === to) return preset;
  }
  return !value.from && !value.to ? "any" : "custom";
}

function pill(active: boolean) {
  return `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50 hover:bg-secondary"}`;
}

type CategorizedFilterProps = {
  value: EventFilters;
  onChange: (f: EventFilters) => void;
  events: CampusEvent[];
  category: string;
  onCategoryChange: (value: string) => void;
  subcategory: string;
  onSubcategoryChange: (value: string) => void;
  audience: string;
  onAudienceChange: (value: string) => void;
  onClear: () => void;
};

type BasicFilterProps = { value: EventFilters; onChange: (f: EventFilters) => void };

export function EventFilterBar(props: CategorizedFilterProps | BasicFilterProps) {
  if ("events" in props) return <CategorizedEventFilterBar {...props} />;
  return <BasicEventFilterBar {...props} />;
}

function BasicEventFilterBar({ value, onChange }: BasicFilterProps) {
  const { data: summary } = useGetSummary();
  const set = (p: Partial<EventFilters>) => onChange({ ...value, ...p });
  const dirty = JSON.stringify(value) !== JSON.stringify(emptyFilters);
  return (
    <div role="search" className="rounded-3xl bg-card/70 border border-card-border p-3 flex flex-wrap gap-2 items-center">
      <label className="relative flex-1 min-w-[200px]">
        <span className="sr-only">Search events</span>
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={value.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search events, hosts, places" data-testid="input-search" className={`${field} w-full pl-10`} />
      </label>
      <label className="sr-only" htmlFor="map-tag-filter">Tag</label>
      <select id="map-tag-filter" value={value.tag} onChange={(e) => set({ tag: e.target.value })} className={field} data-testid="select-tag">
        <option value="">All tags</option>
        {summary?.tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">From<input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} className={field} data-testid="input-from" /></label>
      <label className="flex items-center gap-1 text-xs text-muted-foreground">To<input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} className={field} data-testid="input-to" /></label>
      <button type="button" aria-pressed={value.free_food} onClick={() => set({ free_food: !value.free_food })} data-testid="toggle-free-food"
        className={`h-10 rounded-full px-4 text-sm font-semibold inline-flex items-center gap-2 border transition-colors ${value.free_food ? "bg-accent border-accent text-accent-foreground" : "border-input bg-card"}`}>
        <UtensilsCrossed size={14} /> Free food
      </button>
      {dirty && <button type="button" onClick={() => onChange(emptyFilters)} data-testid="button-clear-filters" className="h-10 rounded-full px-3 text-sm inline-flex items-center gap-1 hover:bg-secondary"><X size={14} />Clear</button>}
    </div>
  );
}

function CategorizedEventFilterBar({
  value, onChange, events, category, onCategoryChange, subcategory, onSubcategoryChange, audience, onAudienceChange, onClear,
}: CategorizedFilterProps) {
  const set = (p: Partial<EventFilters>) => onChange({ ...value, ...p });
  const categoryCounts = new Map(EVENT_CATEGORIES.map((group) => [group.label, 0]));
  const subcategoryCounts = new Map<string, number>();
  const audienceCounts = new Map([["open", 0], ["specific", 0], ["unknown", 0]]);
  for (const event of events) {
    const taxonomy = classifyEvent(event);
    categoryCounts.set(taxonomy.category, (categoryCounts.get(taxonomy.category) ?? 0) + 1);
    subcategoryCounts.set(taxonomy.topic, (subcategoryCounts.get(taxonomy.topic) ?? 0) + 1);
    const group = eventAudience(event).group;
    audienceCounts.set(group, (audienceCounts.get(group) ?? 0) + 1);
  }
  const selectedCategory = EVENT_CATEGORIES.find((group) => group.label === category);
  const preset = activeDatePreset(value);
  const dirty = !!value.q || !!value.tag || value.free_food || !!category || !!subcategory || !!audience || (preset !== "upcoming");
  const chooseDate = (name: string) => {
    const [from, to] = rangeFor(name);
    set({ from, to });
  };
  const audienceOptions = [
    ["", "Any audience", events.length],
    ["open", "Open to everyone", audienceCounts.get("open") ?? 0],
    ["specific", "Specific audience", audienceCounts.get("specific") ?? 0],
    ["unknown", "Not listed", audienceCounts.get("unknown") ?? 0],
  ] as const;
  return (
    <div role="search" aria-label="Filter campus events" className="rounded-3xl bg-card/70 border border-card-border p-4 sm:p-5 space-y-5">
      <label className="relative block">
        <span className="sr-only">Search events, hosts, and places</span>
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={value.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search by event, host, or place" data-testid="input-search" className={`${field} h-12 w-full pl-11 text-base`} />
      </label>

      <div>
        <p className="text-sm font-semibold mb-2">Browse by subject</p>
        <div className="flex flex-wrap gap-2 pb-1" aria-label="Event subjects">
          <button type="button" aria-pressed={!category} onClick={() => onCategoryChange("")} className={pill(!category)} data-testid="filter-category-all">
            All subjects <span className="text-xs opacity-75">{events.length}</span>
          </button>
          {EVENT_CATEGORIES.map((group) => {
            const count = categoryCounts.get(group.label) ?? 0;
            return <button key={group.label} type="button" aria-pressed={category === group.label} disabled={count === 0} onClick={() => onCategoryChange(category === group.label ? "" : group.label)}
              className={`${pill(category === group.label)} ${count === 0 ? "opacity-50" : ""}`} data-testid={`filter-category-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
              {group.label}<span className="text-xs opacity-75">{count}</span>
            </button>;
          })}
        </div>
        {selectedCategory && <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2">Narrow {selectedCategory.label} by</p>
          <div className="flex flex-wrap gap-2" aria-label={`${selectedCategory.label} topics`}>
            <button type="button" aria-pressed={!subcategory} onClick={() => onSubcategoryChange("")} className={pill(!subcategory)}>All</button>
            {selectedCategory.topics.map((topic) => {
              const count = subcategoryCounts.get(topic) ?? 0;
              return <button key={topic} type="button" aria-pressed={subcategory === topic} disabled={count === 0} onClick={() => onSubcategoryChange(subcategory === topic ? "" : topic)}
                className={`${pill(subcategory === topic)} ${count === 0 ? "opacity-50" : ""}`} data-testid={`filter-topic-${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                {topic}<span className="text-xs opacity-75">{count}</span>
              </button>;
            })}
          </div>
        </div>}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Who can attend?</p>
        <div className="flex flex-wrap gap-2 pb-1">
          {audienceOptions.map(([valueKey, label, count]) => <button key={valueKey || "all"} type="button" aria-pressed={audience === valueKey} disabled={valueKey !== "" && count === 0}
            onClick={() => onAudienceChange(valueKey)} className={`${pill(audience === valueKey)} ${count === 0 ? "opacity-50" : ""}`}>
            {label}<span className="text-xs opacity-75">{count}</span>
          </button>)}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2"><CalendarDays size={15} className="inline mr-1.5 text-primary" />When</p>
        <div className="flex flex-wrap gap-2 pb-1">
          {([["upcoming", "Upcoming"], ["any", "Any date"], ["today", "Today"], ["week", "This week"], ["weekend", "This weekend"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={preset === key}
            onClick={() => chooseDate(key)} className={pill(preset === key)} data-testid={`filter-date-${key}`}>{label}</button>)}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <details className="group" open={preset === "custom" || value.free_food}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted-foreground hover:text-foreground">
            More filters <span aria-hidden className="inline-block transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-background p-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">From<input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} className={field} data-testid="input-from" /></label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">To<input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} className={field} data-testid="input-to" /></label>
            <label className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium">
              <input type="checkbox" checked={value.free_food} onChange={(e) => set({ free_food: e.target.checked })} className="h-4 w-4 accent-[#990000]" data-testid="toggle-free-food" />
              <UtensilsCrossed size={14} /> Free food only
            </label>
          </div>
        </details>
        {dirty && <button type="button" onClick={onClear} data-testid="button-clear-filters" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold text-primary hover:bg-secondary"><X size={14} />Clear filters</button>}
      </div>
    </div>
  );
}
