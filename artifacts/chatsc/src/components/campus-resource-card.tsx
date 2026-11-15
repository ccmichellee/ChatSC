import { ExternalLink } from "lucide-react";
import type { CampusResource } from "@/lib/campus-resources";

export function CampusResourceCard({ resource }: { resource: CampusResource }) {
  return (
    <article
      className="flex h-full min-w-0 flex-col rounded-3xl border border-card-border bg-card p-5"
      data-testid={`card-resource-${resource.id}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-wider text-primary">{resource.category}</p>
      <h3 className="mt-2 font-display text-xl font-bold text-balance">{resource.name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{resource.description}</p>
      <div className="mt-4 rounded-2xl bg-secondary/70 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-secondary-foreground">Helpful for</p>
        <p className="mt-1 text-sm leading-relaxed text-secondary-foreground">{resource.helpfulFor}</p>
      </div>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto inline-flex min-h-11 items-center gap-2 pt-5 text-sm font-semibold text-primary underline underline-offset-4"
        data-testid={`link-resource-${resource.id}`}
      >
        {resource.actionLabel}
        <ExternalLink size={14} aria-hidden="true" />
        <span className="sr-only">(opens official USC page in a new tab)</span>
      </a>
    </article>
  );
}
