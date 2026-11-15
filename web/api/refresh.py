"""Run the existing crawlers with extra provenance, without editing their files."""
import contextlib
import io
import logging
import threading
from datetime import datetime, timedelta

import crawl_usc_events
import scrape_usc_clubs
import seed_memory
from .store import PACIFIC, now, parse_dates

logger = logging.getLogger("chatsc")
refresh_lock = threading.Lock()
last_refresh = {"status": "ready", "count": 0, "message": "Ready to discover campus.", "sample_data": True}


def seed_fallback(store):
    old_factory = seed_memory.MemoryStore
    store.sample_mode = True
    try:
        seed_memory.MemoryStore = lambda: store
        with contextlib.redirect_stdout(io.StringIO()):
            seed_memory.seed_database()
        # Explicitly fictional, dated examples make calendar interaction usable offline.
        demos = [
            ("Sample: Build your first campus app", "Ginsburg Hall", ["tech", "coding"], True),
            ("Sample: Trojan creative mixer", "Fertitta Hall", ["arts", "networking"], False),
            ("Sample: Community volunteer meetup", "TCC Trojan Lounge", ["community", "volunteer"], False),
            ("Sample: Mindful study break", "Leavey Library", ["wellness"], True),
            ("Sample: Student startup showcase", "Bovard Auditorium", ["startups", "career"], False),
            ("Sample: Film and conversation", "Doheny Memorial Library", ["film", "culture"], True),
        ]
        for i, (title, location, tags, food) in enumerate(demos):
            start = (datetime.now(PACIFIC) + timedelta(days=i + 1)).replace(hour=17 + i % 3, minute=0, second=0, microsecond=0)
            end = start + timedelta(hours=1)
            store.pending[(title, start.isoformat())] = {"host": "Fictional student group", "start": start.isoformat(), "end": end.isoformat()}
            # Stable title guard avoids creating a new rolling demo every restart.
            if not any(e["title"] == title for e in store.events()):
                store.upsert_event(title, start.isoformat(), location,
                                   "Sample data: a fictional event for exploring ChatSC. This is not a real scheduled USC event.",
                                   food, tags)
    finally:
        seed_memory.MemoryStore = old_factory
        store.sample_mode = False


def refresh(store):
    global last_refresh
    if not refresh_lock.acquire(blocking=False):
        return {"status": "busy", "count": 0, "message": "A campus refresh is already running.", "sample_data": False}
    original_cal = crawl_usc_events.extract_calendar_event_fields
    original_engage = crawl_usc_events.extract_engagesc_event_fields

    def calendar_fields(raw):
        fields = original_cal(raw)
        ev = raw.get("event", {})
        instances = ev.get("event_instances") or []
        instance = instances[0].get("event_instance", {}) if instances else {}
        start, _ = parse_dates(instance.get("start") or fields["date_str"])
        end, _ = parse_dates(instance.get("end") or "")
        groups = ev.get("groups") or []
        store.pending[(fields["title"], fields["date_str"])] = {
            "source_url": ev.get("localist_url") or ev.get("url") or "https://calendar.usc.edu/",
            "host": ", ".join(g.get("name", "") for g in groups) or None,
            "start": start, "end": end,
        }
        return fields

    def engage_fields(raw):
        fields = original_engage(raw)
        if fields:
            store.pending[(fields["title"], fields["date_str"])] = {
                "host": fields["tags"][1] if len(fields["tags"]) > 1 else None,
            }
        return fields

    try:
        crawl_usc_events.extract_calendar_event_fields = calendar_fields
        crawl_usc_events.extract_engagesc_event_fields = engage_fields
        count = crawl_usc_events.crawl_events(days=30, max_pages=2, store=store)
        # Existing crawler handles network errors internally and returns zero.
        if not count:
            seed_fallback(store)
        if not store.clubs() or all(c["sample_data"] for c in store.clubs()):
            try:
                for club in scrape_usc_clubs.fetch_clubs_from_params({"search": ""}):
                    store.add_club(**club)
            except Exception:
                logger.exception("Club crawl unavailable; existing clubs retained")
        last_refresh = dict(status="success" if count else "fallback", count=count,
                            message=f"Refreshed {count} campus events." if count else "Campus sources are unavailable. Showing labeled sample data and any previously fetched events.",
                            sample_data=not bool(count))
    except Exception:
        logger.exception("Campus refresh failed")
        try:
            seed_fallback(store)
        except Exception:
            logger.exception("Sample seed unavailable; existing records retained")
        last_refresh = dict(status="fallback", count=0, message="Refresh unavailable. Existing data retained; fallback entries are labeled Sample data.", sample_data=True)
    finally:
        crawl_usc_events.extract_calendar_event_fields = original_cal
        crawl_usc_events.extract_engagesc_event_fields = original_engage
        store.pending.clear()
        refresh_lock.release()
    return last_refresh
