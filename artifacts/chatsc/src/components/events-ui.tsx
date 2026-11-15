import { CalendarClock, ExternalLink, MapPin, Search, UtensilsCrossed, BellRing, AlertCircle, X } from "lucide-react";
import { useGetSummary, type CampusEvent } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SampleBadge, Tag } from "./bits";
import { fmtWhen, timeAgo, type EventFilters, emptyFilters } from "@/lib/campus";

export function EventCard({ ev, onOpen, conflict, compact, selected }: { ev: CampusEvent; onOpen: () => void; conflict?: boolean; compact?: boolean; selected?: boolean }) {
  const when = fmtWhen(ev.start) ?? ev.date_str;
  return (
    <button type="button" onClick={onOpen} data-testid={`card-event-${ev.id}`}
      className={`group text-left w-full rounded-3xl bg-card border p-5 transition-all hover:-translate-y-1 hover:shadow-[0_12px_30px_-12px_hsl(0_100%_30%/0.35)] ${selected ? "border-primary ring-2 ring-primary/30" : "border-card-border"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[11px] uppercase tracking-wider text-primary">{ev.category || "Event"}</span>
        <SampleBadge show={ev.sample_data} />
        {ev.free_food && <span className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-[10px] font-bold uppercase"><UtensilsCrossed size={10} /> Free food</span>}
        {conflict && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase"><AlertCircle size={10} /> Class conflict</span>}
      </div>
      <h3 className="font-display text-lg font-bold leading-snug mt-2 group-hover:text-primary transition-colors">{ev.title}</h3>
      <p className="text-sm text-muted-foreground">by {ev.host || "Unknown host"}</p>
      <div className="mt-3 space-y-1 text-sm">
        <p className="flex items-start gap-2"><CalendarClock size={15} className="mt-0.5 shrink-0 text-primary" />{when || "Date TBD"}</p>
        <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-primary" />{ev.location || "Location TBD"}</p>
      </div>
      {!compact && ev.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{ev.tags.slice(0, 4).map((t) => <Tag key={t}>{t}</Tag>)}</div>}
      {ev.matched_reasons && ev.matched_reasons.length > 0 && <p className="mt-3 text-xs text-foreground/80 bg-accent/25 rounded-xl px-3 py-1.5">Why: {ev.matched_reasons.join(" · ")}</p>}
      <p className="mt-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{ev.source} · {timeAgo(ev.updated_at)}</p>
    </button>
  );
}

export function EventDialog({ ev, onClose, conflict }: { ev: CampusEvent | null; onClose: () => void; conflict?: boolean }) {
  const { toast } = useToast();
  return (
    <Dialog open={!!ev} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl bg-card max-w-lg">
        {ev && <>
          <DialogHeader>
            <div className="flex gap-2 items-center"><span className="font-mono text-xs uppercase text-primary">{ev.category}</span><SampleBadge show={ev.sample_data} /></div>
            <DialogTitle className="font-display text-2xl font-extrabold">{ev.title}</DialogTitle>
            <DialogDescription>Hosted by {ev.host || "Unknown host"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="flex gap-2"><CalendarClock size={16} className="text-primary" />{fmtWhen(ev.start) ?? (ev.date_str || "Date TBD")}{ev.end && fmtWhen(ev.end) ? ` – ${fmtWhen(ev.end)}` : ""}</p>
            <p className="flex gap-2"><MapPin size={16} className="text-primary" />{ev.location || "Location TBD"}</p>
            {conflict && <p className="flex gap-2 text-destructive font-medium"><AlertCircle size={16} />Overlaps one of your class blocks.</p>}
            <p className="pt-2 leading-relaxed whitespace-pre-line">{ev.description || "No description provided by the source."}</p>
            {ev.tags.length > 0 && <div className="flex flex-wrap gap-1.5 pt-2">{ev.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>}
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

export function EventFilterBar({ value, onChange }: { value: EventFilters; onChange: (f: EventFilters) => void }) {
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
      <label className="sr-only" htmlFor="tag-filter">Tag</label>
      <select id="tag-filter" value={value.tag} onChange={(e) => set({ tag: e.target.value })} className={field} data-testid="select-tag">
        <option value="">All tags</option>
        {summary?.tags.map((t) => <option key={t} value={t}>{t}</option>)}
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
