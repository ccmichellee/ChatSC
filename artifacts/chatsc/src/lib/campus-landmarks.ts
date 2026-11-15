import type { CampusEvent } from "@workspace/api-client-react";

export type LandmarkKind = "Library" | "Student life" | "Dining" | "Academic" | "Venue" | "Landmark" | "Athletics";

export interface Landmark {
  id: string;
  name: string;
  short: string;
  kind: LandmarkKind;
  lat: number;
  lng: number;
  blurb: string;
  keywords: string[];
}

// Coordinates are approximate placements on the University Park campus.
export const LANDMARKS: Landmark[] = [
  { id: "doheny", name: "Edward L. Doheny Jr. Memorial Library", short: "Doheny", kind: "Library", lat: 34.0202, lng: -118.2837, keywords: ["doheny"],
    blurb: "Doheny Memorial Library on USC's University Park campus." },
  { id: "leavey", name: "Thomas and Dorothy Leavey Library", short: "Leavey", kind: "Library", lat: 34.0218, lng: -118.2829, keywords: ["leavey"],
    blurb: "Leavey Library on the eastern side of University Park campus. Check USC Libraries for access and hours." },
  { id: "tcc", name: "Ronald Tutor Campus Center", short: "TCC", kind: "Student life", lat: 34.0205, lng: -118.2863, keywords: ["tutor campus", "tcc", "campus center", "ronald tutor campus"],
    blurb: "Student campus center with meeting and event spaces, including the Trojan Grand Ballroom." },
  { id: "tommy", name: "Tommy Trojan", short: "Tommy Trojan", kind: "Landmark", lat: 34.0206, lng: -118.2856, keywords: ["tommy trojan", "hahn plaza"],
    blurb: "The Trojan Shrine in Hahn Central Plaza, a central campus landmark." },
  { id: "bovard", name: "Bovard Auditorium", short: "Bovard", kind: "Venue", lat: 34.0207, lng: -118.2849, keywords: ["bovard"],
    blurb: "A USC performance venue used for campus events and productions." },
  { id: "mccarthy", name: "McCarthy Quad", short: "McCarthy Quad", kind: "Landmark", lat: 34.0212, lng: -118.2835, keywords: ["mccarthy quad", "mccarthy quadrangle"],
    blurb: "An outdoor campus venue between Leavey and Doheny libraries." },
  { id: "village", name: "USC Village", short: "USC Village", kind: "Student life", lat: 34.0254, lng: -118.2853, keywords: ["usc village", "village"],
    blurb: "USC Village, north of Jefferson Boulevard, with residential, dining, and retail spaces." },
  { id: "village-dining", name: "USC Village Dining Hall", short: "Village Dining", kind: "Dining", lat: 34.0250, lng: -118.2846, keywords: ["village dining"],
    blurb: "USC Village residential dining hall. Check USC Hospitality for current menus and hours." },
  { id: "evk", name: "Everybody's Kitchen", short: "EVK", kind: "Dining", lat: 34.0213, lng: -118.2823, keywords: ["everybody's kitchen", "evk"],
    blurb: "A USC residential dining hall, also known as EVK. Check USC Hospitality for current menus and hours." },
  { id: "parkside", name: "Parkside Restaurant and Grill", short: "Parkside", kind: "Dining", lat: 34.0189, lng: -118.2902, keywords: ["parkside"],
    blurb: "Parkside residential dining hall. Check USC Hospitality for current menus and hours." },
  { id: "annenberg", name: "Wallis Annenberg Hall", short: "Annenberg", kind: "Academic", lat: 34.0221, lng: -118.2867, keywords: ["annenberg", "wallis"],
    blurb: "An academic building for the USC Annenberg School for Communication and Journalism." },
  { id: "rth", name: "Ronald Tutor Hall", short: "Tutor Hall", kind: "Academic", lat: 34.0200, lng: -118.2899, keywords: ["ronald tutor hall", "rth", "viterbi"],
    blurb: "An academic building in the USC Viterbi engineering area." },
  { id: "mudd", name: "Mudd Hall of Philosophy", short: "Mudd Hall", kind: "Academic", lat: 34.0189, lng: -118.2858, keywords: ["mudd hall", "mudd"],
    blurb: "Mudd Hall of Philosophy on University Park campus." },
  { id: "jff", name: "Jill and Frank Fertitta Hall", short: "Fertitta Hall", kind: "Academic", lat: 34.0189, lng: -118.2836, keywords: ["fertitta", "jff", "marshall"],
    blurb: "An academic building for the USC Marshall School of Business." },
  { id: "bing", name: "Bing Theatre", short: "Bing Theatre", kind: "Venue", lat: 34.0223, lng: -118.2882, keywords: ["bing theatre", "bing theater"],
    blurb: "A USC theatre venue on the University Park campus." },
  { id: "lyon", name: "Lyon Center", short: "Lyon Center", kind: "Athletics", lat: 34.0242, lng: -118.2884, keywords: ["lyon center", "lyon"],
    blurb: "A USC recreational sports facility on the University Park campus." },
  { id: "galen", name: "Galen Center", short: "Galen Center", kind: "Athletics", lat: 34.0213, lng: -118.2797, keywords: ["galen"],
    blurb: "USC arena and event venue near the eastern edge of University Park campus." },
];

export const KIND_COLOR: Record<LandmarkKind, string> = {
  Library: "#2f5d8a", "Student life": "#990000", Dining: "#b4561b", Academic: "#4b5a2a", Venue: "#6b3f8f", Landmark: "#8a6d00", Athletics: "#1f6f6b",
};

function meters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dy = (aLat - bLat) * 111_000;
  const dx = (aLng - bLng) * 111_000 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

export function eventsAt(l: Landmark, events: CampusEvent[]) {
  return events.filter((e) => {
    const loc = (e.location ?? "").toLowerCase();
    if (l.keywords.some((k) => loc.includes(k))) return true;
    return e.lat != null && e.lng != null && meters(l.lat, l.lng, e.lat, e.lng) < 60;
  });
}
