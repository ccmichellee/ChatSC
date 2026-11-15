import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { ClassBlock } from "@workspace/api-client-react";
import { DAYS_LONG, blockOverlaps, toMin } from "@/lib/campus";

const inp = "h-9 rounded-xl bg-background border border-input px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

export function ClassBlockEditor({ blocks, onChange }: { blocks: ClassBlock[]; onChange: (b: ClassBlock[]) => void }) {
  const overlaps = blockOverlaps(blocks);
  const upd = (i: number, p: Partial<ClassBlock>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...p } : b)));
  return (
    <div className="space-y-2">
      {blocks.length === 0 && <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-4">No class blocks yet. Add your lectures, labs, and shifts so we can steer around them.</p>}
      {blocks.map((b, i) => {
        const invalid = toMin(b.end) <= toMin(b.start);
        return (
          <div key={i} className={`rounded-2xl border p-3 bg-card grid grid-cols-2 sm:grid-cols-[1.3fr_1fr_1fr_1.6fr_auto] gap-2 items-center ${overlaps.has(i) || invalid ? "border-destructive/60" : "border-card-border"}`} data-testid={`row-class-${i}`}>
            <label className="sr-only" htmlFor={`d${i}`}>Day</label>
            <select id={`d${i}`} value={b.day} onChange={(e) => upd(i, { day: Number(e.target.value) })} className={inp}>
              {DAYS_LONG.map((d, k) => <option key={d} value={k}>{d}</option>)}
            </select>
            <input aria-label="Start time" type="time" value={b.start} onChange={(e) => upd(i, { start: e.target.value })} className={inp} />
            <input aria-label="End time" type="time" value={b.end} onChange={(e) => upd(i, { end: e.target.value })} className={inp} />
            <input aria-label="Class title" value={b.title} placeholder="e.g. WRIT 150" onChange={(e) => upd(i, { title: e.target.value })} className={inp} />
            <button type="button" aria-label={`Remove ${b.title || "class block"}`} onClick={() => onChange(blocks.filter((_, j) => j !== i))} className="h-9 w-9 grid place-items-center rounded-xl hover:bg-destructive/10 text-destructive justify-self-end"><Trash2 size={16} /></button>
            {(overlaps.has(i) || invalid) && <p className="col-span-full text-xs text-destructive flex items-center gap-1"><AlertTriangle size={12} />{invalid ? "End time must be after start." : "Overlaps another class block."}</p>}
          </div>
        );
      })}
      <button type="button" data-testid="button-add-class" onClick={() => onChange([...blocks, { day: 0, start: "10:00", end: "11:50", title: "" }])}
        className="inline-flex items-center gap-2 rounded-full border border-dashed border-primary text-primary px-4 py-2 text-sm font-semibold hover:bg-primary/5"><Plus size={15} />Add class block</button>
    </div>
  );
}
