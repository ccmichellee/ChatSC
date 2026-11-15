import { Aperture, Boxes, Hexagon, Layers3, Orbit, Sparkles } from "lucide-react";

const marks = [Orbit, Layers3, Hexagon, Aperture, Boxes, Sparkles];
const colors = [
  { background: "#EAF0FF", foreground: "#3454A5" },
  { background: "#E5F2EC", foreground: "#25654E" },
  { background: "#F1EAF8", foreground: "#714995" },
  { background: "#FFF0DD", foreground: "#9A581B" },
  { background: "#E5F3F5", foreground: "#236775" },
  { background: "#FBE9ED", foreground: "#9C3D57" },
];

/** Original placeholder branding, not an organization's official logo. */
export function OrganizationLogo({ organization }: { organization: string }) {
  const name = organization.replace(/^sample:\s*/i, "").trim() || "Campus organization";
  const hash = Array.from(name.toLowerCase()).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  const Mark = marks[hash % marks.length];
  const color = colors[Math.floor(hash / marks.length) % colors.length];
  const initials = name
    .split(/\s+/)
    .filter((word) => !["the", "of", "and", "&"].includes(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div
      role="img"
      aria-label={`Fictional logo for ${name}`}
      title={`Illustrative logo for ${name}`}
      data-testid="organization-logo"
      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-black/5"
      style={{ backgroundColor: color.background, color: color.foreground }}
    >
      <Mark size={25} strokeWidth={1.8} aria-hidden="true" />
      <span aria-hidden="true" className="text-[9px] font-bold leading-none tracking-[0.13em]">{initials}</span>
    </div>
  );
}
