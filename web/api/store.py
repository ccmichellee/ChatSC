"""Web-only adapters. The original MemoryStore and crawlers remain unchanged."""
import json
import re
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from dateutil import parser
from student_memory import MemoryStore

PACIFIC = ZoneInfo("America/Los_Angeles")

BUILDINGS = [
    (["leavey"], 34.0217, -118.2829),
    (["doheny", "dml"], 34.0204, -118.2839),
    (["ginsburg"], 34.0251, -118.2906),
    (["tcc", "rtcc", "tutor campus", "trojan lounge"], 34.0201, -118.2863),
    (["bovard"], 34.0209, -118.2854),
    (["epstein"], 34.0205, -118.2892),
    (["fertitta"], 34.0186, -118.2824),
    (["sal ", "salvatori"], 34.0194, -118.2891),
    (["ohe", "olin"], 34.0200, -118.2899),
]


def now():
    return datetime.now(PACIFIC).isoformat()


def parse_dates(text):
    """Only use explicit calendar dates. Ambiguous weekdays/seasons stay undated."""
    if not text or re.search(r"\b(spring|summer|fall|winter|today|tomorrow)\b", text, re.I):
        return None, None
    if not (re.search(r"\d{4}-\d{2}-\d{2}", text) or
            re.search(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b", text, re.I)):
        return None, None
    try:
        # Require a year for human-written dates: do not invent the event year.
        if not re.search(r"\b20\d{2}\b", text):
            return None, None
        pieces = re.split(r"\s+(?:-|–|to)\s+", text, maxsplit=1)
        start = parser.parse(pieces[0], fuzzy=True)
        start = start.replace(tzinfo=PACIFIC) if start.tzinfo is None else start.astimezone(PACIFIC)
        end = None
        if len(pieces) > 1:
            end = parser.parse(pieces[1], default=start.replace(tzinfo=None), fuzzy=True)
            end = end.replace(tzinfo=PACIFIC) if end.tzinfo is None else end.astimezone(PACIFIC)
            if end < start:
                end += timedelta(days=1)
        return start.isoformat(), end.isoformat() if end else None
    except (ValueError, OverflowError, TypeError):
        return None, None


def conflicts(event, blocks):
    if not event.get("start"):
        return False
    start = datetime.fromisoformat(event["start"]).astimezone(PACIFIC)
    # A known start with unknown duration can only be checked as a point in time.
    end = datetime.fromisoformat(event["end"]).astimezone(PACIFIC) if event.get("end") else start
    for block in blocks:
        day = start.date()
        while day <= end.date():
            if day.weekday() == block["day"]:
                a = datetime.combine(day, datetime.strptime(block["start"], "%H:%M").time(), PACIFIC)
                b = datetime.combine(day, datetime.strptime(block["end"], "%H:%M").time(), PACIFIC)
                if (start < b and end > a) or (end == start and a <= start < b):
                    return True
            day += timedelta(days=1)
    return False


class WebStore(MemoryStore):
    def __init__(self):
        super().__init__()
        self.sample_mode = False
        self.pending = {}
        with self.get_connection() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS web_event_metadata (
                    event_id INTEGER PRIMARY KEY, source_url TEXT, host TEXT,
                    updated_at TEXT, sample_data INTEGER DEFAULT 0, start TEXT, end TEXT
                );
                CREATE TABLE IF NOT EXISTS web_club_metadata (
                    club_id INTEGER PRIMARY KEY, sample_data INTEGER DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS web_sessions (
                    token TEXT PRIMARY KEY, student_key TEXT NOT NULL
                );
            """)

    def upsert_event(self, title, date_str, location, description, has_free_food=False, tags=None):
        event_id = super().upsert_event(title, date_str, location, description, has_free_food, tags)
        metadata = self.pending.pop((title, date_str), {})
        start, end = parse_dates(date_str)
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO web_event_metadata VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(event_id) DO UPDATE SET source_url=excluded.source_url,
                host=excluded.host, updated_at=excluded.updated_at,
                sample_data=excluded.sample_data, start=excluded.start, end=excluded.end
            """, (event_id, metadata.get("source_url"), metadata.get("host"), now(),
                  int(self.sample_mode), metadata.get("start", start), metadata.get("end", end)))
        return event_id

    def add_club(self, name, category, description, meeting_times=""):
        with self.get_connection() as conn:
            if conn.execute("SELECT id FROM campus_clubs WHERE name=?", (name,)).fetchone():
                return
        super().add_club(name, category, description, meeting_times)
        with self.get_connection() as conn:
            row = conn.execute("SELECT id FROM campus_clubs WHERE name=? ORDER BY id DESC LIMIT 1", (name,)).fetchone()
            conn.execute("INSERT OR REPLACE INTO web_club_metadata VALUES (?,?)", (row[0], int(self.sample_mode)))

    def events(self):
        with self.get_connection() as conn:
            conn.row_factory = __import__("sqlite3").Row
            rows = conn.execute("""
                SELECT e.*, m.source_url, m.host, m.updated_at, m.sample_data,
                m.start, m.end FROM campus_events e
                LEFT JOIN web_event_metadata m ON e.id=m.event_id
            """).fetchall()
        result = []
        for row in rows:
            r = dict(row)
            tags = json.loads(r["tags_json"] or "[]")
            source = "EngageSC" if "EngageSC" in tags else ("USC Calendar" if "USC Calendar" in tags else "Original dataset")
            url = r["source_url"]
            if not url:
                match = re.search(r"https://[^\s|<>]+", r["description"] or "")
                url = match.group(0).rstrip(").") if match else ("https://engage.usc.edu/events" if source == "EngageSC" else "https://calendar.usc.edu/")
            loc = (r["location"] or "").lower()
            coords = next(((lat, lng) for names, lat, lng in BUILDINGS if any(n in loc for n in names)), (None, None))
            text = " ".join(tags + [r["title"] or ""]).lower()
            category = "Campus life"
            for label, terms in [("Technology", ["tech", " ai", "coding", "hack", "software"]),
                                 ("Career", ["career", "networking", "job", "internship"]),
                                 ("Arts & culture", ["art", "music", "film", "culture"]),
                                 ("Community", ["volunteer", "community", "service"]),
                                 ("Wellness", ["wellness", "yoga", "sport"])]:
                if any(t in text for t in terms):
                    category = label
                    break
            start, end = (r["start"], r["end"]) if r["start"] else parse_dates(r["date_str"])
            result.append(dict(id=r["id"], title=r["title"], host=r["host"] or "Host not listed",
                               date_str=r["date_str"] or "Date not listed", location=r["location"] or "Location TBD",
                               description=r["description"] or "", tags=tags, free_food=bool(r["has_free_food"]),
                               source=source, source_url=url, updated_at=r["updated_at"],
                               sample_data=bool(r["sample_data"]), category=category, start=start, end=end,
                               lat=coords[0], lng=coords[1]))
        return sorted(result, key=lambda e: (e["sample_data"], e["start"] is None, e["start"] or "", e["id"]))

    def clubs(self):
        with self.get_connection() as conn:
            rows = conn.execute("""SELECT c.id,c.name,c.category,c.description,c.meeting_times,m.sample_data
                FROM campus_clubs c LEFT JOIN web_club_metadata m ON c.id=m.club_id""").fetchall()
        result = []
        for r in rows:
            match = re.search(r"Website:\s*(https?://[^\s|]+)", r[3] or "")
            result.append(dict(id=r[0], name=r[1], category=r[2] or "Student Organization",
                               description=r[3] or "", meeting_times=r[4] or "Meeting information not listed",
                               source_url=match.group(1) if match else "https://engage.usc.edu/club_signup",
                               sample_data=bool(r[5])))
        catalog_path = Path(__file__).resolve().parents[2] / "data" / "clubs.json"
        catalog = json.loads(catalog_path.read_text())
        def key(name):
            return re.sub(r"[^a-z0-9]", "", re.sub(r"\busc\b", "", name.lower()))
        names = {key(c["name"]) for c in catalog}
        result = [c for c in result if key(c["name"]) not in names]
        return [
            {**club, "meeting_times": "Meeting information not listed", "sample_data": False}
            for club in catalog
        ] + result
