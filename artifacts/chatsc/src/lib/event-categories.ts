import type { CampusEvent } from "@workspace/api-client-react";

export const EVENT_CATEGORIES = [
  {
    label: "Business & entrepreneurship",
    topics: ["Accounting", "Finance & investing", "Marketing", "Startups & entrepreneurship", "Business competitions"],
  },
  {
    label: "Technology & engineering",
    topics: ["Computer science & AI", "Engineering & design", "Robotics & making", "Hackathons"],
  },
  {
    label: "Politics & society",
    topics: ["Politics & public policy", "Sociology & psychology", "Community & service", "Sustainability"],
  },
  {
    label: "Arts & culture",
    topics: ["Visual arts", "Music & dance", "Film & media", "Theater & performance"],
  },
  {
    label: "Academic & career",
    topics: ["Research", "Careers & internships", "Lectures & workshops", "Conferences & talks"],
  },
  {
    label: "Social & recreation",
    topics: ["Social & community", "Sports & recreation", "Health & wellness", "Games & competitions"],
  },
] as const;

export type EventAudience = { group: "open" | "specific" | "unknown"; label: string };

function eventText(event: CampusEvent) {
  return [event.title, event.host, event.description, ...event.tags].filter(Boolean).join(" ").toLowerCase();
}

export function classifyEvent(event: CampusEvent) {
  const text = eventText(event);
  const has = (pattern: RegExp) => pattern.test(text);

  if (has(/\b(accounting|accountant|bookkeeping)\b/)) return { category: EVENT_CATEGORIES[0].label, topic: "Accounting" };
  if (has(/\b(finance|financial|investing|investment|venture capital|banking)\b/)) return { category: EVENT_CATEGORIES[0].label, topic: "Finance & investing" };
  if (has(/\b(marketing|branding|brand strategy|advertising)\b/)) return { category: EVENT_CATEGORIES[0].label, topic: "Marketing" };
  if (has(/\b(startup|start-up|entrepreneur|venture|founder|pitch)\b/)) return { category: EVENT_CATEGORIES[0].label, topic: "Startups & entrepreneurship" };
  if (has(/\b(business|consulting|case competition|business competition)\b/)) return { category: EVENT_CATEGORIES[0].label, topic: "Business competitions" };

  if (has(/\b(hackathon|hacksc|hackathons)\b/)) return { category: EVENT_CATEGORIES[1].label, topic: "Hackathons" };
  if (has(/\b(coding|computer science|software|programming|artificial intelligence|machine learning|data science|generative ai)\b/)) return { category: EVENT_CATEGORIES[1].label, topic: "Computer science & AI" };
  if (has(/\b(engineering|design|viterbi|maker|makeathon)\b/)) return { category: EVENT_CATEGORIES[1].label, topic: "Engineering & design" };
  if (has(/\b(robotics|robot|hardware|3d printing)\b/)) return { category: EVENT_CATEGORIES[1].label, topic: "Robotics & making" };
  if (has(/\b(hack|build competition)\b/)) return { category: EVENT_CATEGORIES[1].label, topic: "Hackathons" };

  if (has(/\b(politics|political|government|public policy|policy|election|civic)\b/)) return { category: EVENT_CATEGORIES[2].label, topic: "Politics & public policy" };
  if (has(/\b(sociology|psychology|mental health|social science|human behavior)\b/)) return { category: EVENT_CATEGORIES[2].label, topic: "Sociology & psychology" };
  if (has(/\b(sustainability|climate|environment|conservation|green)\b/)) return { category: EVENT_CATEGORIES[2].label, topic: "Sustainability" };
  if (has(/\b(volunteer|volunteering|community service|service project|advocacy|activism)\b/)) return { category: EVENT_CATEGORIES[2].label, topic: "Community & service" };

  if (has(/\b(film|cinema|media|journalism|photography|screening)\b/)) return { category: EVENT_CATEGORIES[3].label, topic: "Film & media" };
  if (has(/\b(music|concert|singer|band|dance|dancing)\b/)) return { category: EVENT_CATEGORIES[3].label, topic: "Music & dance" };
  if (has(/\b(theater|theatre|performance|performing arts|play|musical)\b/)) return { category: EVENT_CATEGORIES[3].label, topic: "Theater & performance" };
  if (has(/\b(art|arts|exhibit|exhibition|gallery|creative)\b/)) return { category: EVENT_CATEGORIES[3].label, topic: "Visual arts" };

  if (has(/\b(internship|internships|career|careers|job fair|recruiting|resume|professional development)\b/)) return { category: EVENT_CATEGORIES[4].label, topic: "Careers & internships" };
  if (has(/\b(research|lab|scholarship|fellowship|academic)\b/)) return { category: EVENT_CATEGORIES[4].label, topic: "Research" };
  if (has(/\b(conference|symposium|symposia)\b/)) return { category: EVENT_CATEGORIES[4].label, topic: "Conferences & talks" };
  if (has(/\b(speaker|panel|lecture|talk|workshop|seminar|class|course)\b/)) return { category: EVENT_CATEGORIES[4].label, topic: "Lectures & workshops" };

  if (has(/\b(competition|contest|tournament|game night|board game|trivia)\b/)) return { category: EVENT_CATEGORIES[5].label, topic: "Games & competitions" };
  if (has(/\b(sport|sports|football|basketball|soccer|fitness|recreation|recreational)\b/)) return { category: EVENT_CATEGORIES[5].label, topic: "Sports & recreation" };
  if (has(/\b(wellness|wellbeing|well-being|yoga|meditation|health|mindful)\b/)) return { category: EVENT_CATEGORIES[5].label, topic: "Health & wellness" };
  if (has(/\b(social|community|networking|mixer|reception|friend|student life|welcome|luncheon|breakfast|brunch)\b/)) return { category: EVENT_CATEGORIES[5].label, topic: "Social & community" };

  return { category: EVENT_CATEGORIES[5].label, topic: "Social & community" };
}

export function eventAudience(event: CampusEvent): EventAudience {
  const text = eventText(event);
  const groups = [
    [/\b(first[- ]year|first[- ]years|freshman|freshmen)\b/g, "First-years"],
    [/\bsophomores?\b/g, "Sophomores"],
    [/\bjuniors?\b/g, "Juniors"],
    [/\bseniors?\b/g, "Seniors"],
    [/\bgraduate students?\b/g, "Graduate students"],
    [/\bundergraduates?\b/g, "Undergraduate students"],
  ] as const;
  const matches = groups.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  if (matches.length) return { group: "specific", label: `For ${matches.join(", ")}` };
  if (/\b(open to (all|everyone|the public|anyone)|all (usc )?students (are )?welcome|everyone is welcome|open to the public)\b/.test(text)) {
    return { group: "open", label: "Open to everyone" };
  }
  if (/\b(members only|usc students only|students only|eligibility|required to be|must be a)\b/.test(text)) {
    return { group: "specific", label: "Eligibility applies" };
  }
  return { group: "unknown", label: "Audience not listed" };
}
