export const CLUB_CATEGORIES = [
  "Tech & Engineering", "Business & Entrepreneurship", "Arts & Culture",
  "Service & Volunteering", "Academic & Career", "Social & Recreation",
] as const;

export function clubCategory(category: string): string {
  if (/tech|engineer|computer|robot|hardware|artificial intelligence|\bAI\b|hackathon|design team|viterbi/i.test(category)) return CLUB_CATEGORIES[0];
  if (/business|entrepreneur|venture|startup|product/i.test(category)) return CLUB_CATEGORIES[1];
  if (/arts|cultur|music|perform|dance|film/i.test(category)) return CLUB_CATEGORIES[2];
  if (/service|volunteer|civic|social impact|environment|social awareness/i.test(category)) return CLUB_CATEGORIES[3];
  if (/academic|career|professional/i.test(category)) return CLUB_CATEGORIES[4];
  return CLUB_CATEGORIES[5];
}
