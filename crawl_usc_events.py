import urllib.request
import urllib.parse
import json
import re
import html
import logging
from typing import List, Dict, Any, Optional

from student_memory import MemoryStore

logger = logging.getLogger("crawl_usc_events")

CALENDAR_API_URL = "https://calendar.usc.edu/api/2/events"
ENGAGESC_API_URL = "https://engage.usc.edu/mobile_ws/v17/mobile_events_list"

FREE_FOOD_REGEX = re.compile(
    r"\b(free food|free lunch|free dinner|pizza|refreshments|boba|catered|catering|snacks|breakfast|sweetgreen|meal provided|tacos|ice cream|burrito|burritos|chick-fil-a|cava|donuts|coffee|food provided|lunch provided|dinner provided)\b",
    re.IGNORECASE
)


def extract_calendar_event_fields(raw_event: Dict[str, Any]) -> Dict[str, Any]:
    """Extracts and normalizes event fields from USC Calendar API structure."""
    ev = raw_event.get("event", {})
    title = (ev.get("title") or "").strip()
    
    first_date = (ev.get("first_date") or "").strip()
    date_str = first_date

    loc_name = (ev.get("location_name") or "").strip()
    room = (ev.get("room_number") or "").strip()
    location_parts = [p for p in [loc_name, room] if p]
    location = ", ".join(location_parts) if location_parts else "USC Campus"

    description = (ev.get("description_text") or ev.get("description") or "").strip()
    description = re.sub(r"<[^>]+>", " ", description)
    description = " ".join(description.split())

    filters = ev.get("filters", {})
    tags: List[str] = ["USC Calendar"]
    for filter_key in ("event_types", "event_topic", "event_target_audience", "event_campus"):
        for item in filters.get(filter_key, []):
            name = item.get("name")
            if name and name not in tags:
                tags.append(name)

    combined_text = f"{title} {description}"
    has_free_food = bool(FREE_FOOD_REGEX.search(combined_text))

    return {
        "title": title,
        "date_str": date_str,
        "location": location,
        "description": description,
        "has_free_food": has_free_food,
        "tags": tags,
    }


def extract_event_fields(raw_event: Dict[str, Any]) -> Dict[str, Any]:
    """Backward compatibility alias for calendar event extractor."""
    return extract_calendar_event_fields(raw_event)


def extract_engagesc_event_fields(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extracts and normalizes an event record from EngageSC (CampusGroups) JSON structure."""
    raw_fields = item.get("fields", "")
    if not raw_fields:
        return None

    field_names = [f.strip() for f in raw_fields.split(",") if f.strip()]
    obj: Dict[str, Any] = {}
    for idx, fname in enumerate(field_names):
        pkey = f"p{idx}"
        if pkey in item and item[pkey] is not None:
            obj[fname] = item[pkey]

    if obj.get("displayType") == "separator" or not obj.get("eventName"):
        return None

    title = html.unescape(str(obj.get("eventName", "")).strip())
    if not title:
        return None

    # Date parsing from eventDates or ariaEventDetails
    raw_dates = obj.get("eventDates", "")
    if raw_dates:
        clean_date = html.unescape(re.sub(r"<[^>]+>", " ", str(raw_dates))).strip()
        clean_date = " ".join(clean_date.split()).replace("&ndash;", "-").replace("–", "-")
    else:
        clean_date = str(obj.get("ariaEventDetails", ""))[:60]

    club_name = html.unescape(str(obj.get("clubName", "USC Student Organization")).strip())
    category = html.unescape(str(obj.get("eventCategory", "Student Organization Activity")).strip())
    raw_loc = html.unescape(str(obj.get("eventLocation", "USC Campus")).strip())
    
    if "Private Location" in raw_loc or not raw_loc:
        location = f"USC Campus ({club_name})"
    else:
        location = raw_loc

    # Build comprehensive description
    url_link = "https://engage.usc.edu" + str(obj.get("eventUrl", ""))
    flyer_desc = html.unescape(str(obj.get("eventPhotoDescription", "")).strip())
    price = str(obj.get("eventPriceRange", "")).strip()

    desc_parts = [f"Hosted by {club_name} ({category})."]
    if price and price != "FREE":
        desc_parts.append(f"Admission: {price}.")
    if flyer_desc and flyer_desc.lower() != "event flyer":
        desc_parts.append(flyer_desc)
    desc_parts.append(f"RSVP: {url_link}")

    full_desc = " | ".join(desc_parts)

    tags = ["EngageSC", club_name, category]

    has_free_food = bool(FREE_FOOD_REGEX.search(f"{title} {full_desc}"))

    return {
        "title": title,
        "date_str": clean_date,
        "location": location,
        "description": full_desc,
        "has_free_food": has_free_food,
        "tags": tags,
    }


def crawl_calendar_events(days: int = 60, max_pages: int = 3, store: Optional[MemoryStore] = None) -> int:
    """Crawls official USC Calendar Open API for upcoming campus events."""
    if store is None:
        store = MemoryStore()

    indexed = 0
    current_page = 1

    logger.info(f"📅 Crawling official USC Calendar (days={days}, max_pages={max_pages})...")

    while current_page <= max_pages:
        params = {
            "days": str(days),
            "pp": "100",
            "page": str(current_page),
        }
        url = f"{CALENDAR_API_URL}?{urllib.parse.urlencode(params)}"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "curl/8.7.1",
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.error(f"Failed to fetch {url}: {e}")
            break

        raw_events = data.get("events", [])
        if not raw_events:
            break

        for item in raw_events:
            fields = extract_calendar_event_fields(item)
            if not fields["title"]:
                continue

            store.upsert_event(
                title=fields["title"],
                date_str=fields["date_str"],
                location=fields["location"],
                description=fields["description"],
                has_free_food=fields["has_free_food"],
                tags=fields["tags"]
            )
            indexed += 1

        page_meta = data.get("page", {})
        next_page = page_meta.get("next_page")
        if not next_page:
            break
        current_page = next_page

    logger.info(f"   Indexed {indexed} events from USC Calendar.")
    return indexed


def crawl_engagesc_events(limit: int = 50, max_pages: int = 4, store: Optional[MemoryStore] = None) -> int:
    """Crawls EngageSC (CampusGroups) for registered student organization events."""
    if store is None:
        store = MemoryStore()

    indexed = 0
    range_offset = 0

    logger.info(f"🏛️ Crawling EngageSC club events (pages={max_pages}, batch={limit})...")

    for page in range(max_pages):
        url = f"{ENGAGESC_API_URL}?range={range_offset}&limit={limit}"

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Accept": "application/json"
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                items = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            logger.error(f"Failed to fetch EngageSC events at {url}: {e}")
            break

        if not isinstance(items, list) or not items:
            logger.info("No more EngageSC events returned.")
            break

        new_for_page = 0
        for item in items:
            fields = extract_engagesc_event_fields(item)
            if not fields or not fields["title"]:
                continue

            store.upsert_event(
                title=fields["title"],
                date_str=fields["date_str"],
                location=fields["location"],
                description=fields["description"],
                has_free_food=fields["has_free_food"],
                tags=fields["tags"]
            )
            indexed += 1
            new_for_page += 1

        range_offset += limit
        logger.info(f"   Page {page+1}: processed {new_for_page} events (offset {range_offset}).")

    logger.info(f"   Indexed {indexed} events from EngageSC.")
    return indexed


def crawl_events(
    days: int = 60,
    max_pages: int = 3,
    store: Optional[MemoryStore] = None,
    include_instagram: bool = False
) -> int:
    """
    Crawls official USC Calendar and EngageSC events, saving all records into memory.db.
    (Instagram crawling is disabled by default per Decision 12/13).
    Returns the total count of events processed.
    """
    if store is None:
        store = MemoryStore()

    logger.info("🚀 Starting Multi-Source Campus Events Crawl (USC Calendar + EngageSC)...")
    cal_count = crawl_calendar_events(days=days, max_pages=max_pages, store=store)
    engage_count = crawl_engagesc_events(limit=50, max_pages=max_pages, store=store)

    ig_count = 0
    if include_instagram:
        try:
            from crawl_instagram_events import crawl_instagram_events
            ig_count = crawl_instagram_events(store=store)
        except Exception as e:
            logger.warning(f"Instagram crawl skipped: {e}")

    total = cal_count + engage_count + ig_count

    logger.info(
        f"🎉 Multi-Source Crawl Finished: {total} total events indexed "
        f"({cal_count} Calendar, {engage_count} EngageSC)."
    )
    return total


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    crawl_events(days=60, max_pages=3)
