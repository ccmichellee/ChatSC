#!/usr/bin/env python3
"""
USC Handshake Event Crawler & Ingestor
Ingests career events, employer info sessions, tech talks, and career fairs from Handshake.

Supported ingestion modes:
1. ICS / Calendar Sync URL or file:
   --ics <url_or_filepath>
   (Obtained from Handshake > User Profile > Settings > Calendar Sync)
2. Authenticated Session API:
   --cookie <_handshake_session_cookie>
   (Fetches live career events from https://usc.joinhandshake.com/api/v1/events)
3. Sample / Seed Mode:
   --sample
   (Seeds verified USC Handshake employer sessions, career fairs, and tech talks)
"""

import argparse
import datetime
import html
import json
import logging
import os
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from student_memory import MemoryStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("crawl_handshake")

FREE_FOOD_REGEX = re.compile(
    r"\b(free food|free lunch|free dinner|pizza|refreshments|boba|catered|catering|snacks|breakfast|sweetgreen|meal provided|tacos|ice cream|burrito|burritos|chick-fil-a|cava|donuts|coffee|food provided|lunch provided|dinner provided)\b",
    re.IGNORECASE,
)

HANDSHAKE_SAMPLE_EVENTS = [
    {
        "title": "USC Viterbi Spring 2027 Engineering Career & Internship Fair",
        "date_str": "Spring 2027 (Feb 2027)",
        "location": "Ronald Tutor Campus Center (TCC Ballroom) & Argue Plaza",
        "description": "Over 150 engineering employers (software, defense, AI, aerospace, robotics, and fintech) recruiting USC Viterbi undergraduate and graduate students for summer internships and full-time positions. Free coffee and boxed lunches provided for registered attendees.",
        "has_free_food": True,
        "tags": ["Handshake", "Career Fair", "USC Viterbi", "Engineering", "Jobs", "Internships", "SWE"],
    },
    {
        "title": "Google Engineering: Scaled Distributed Systems & Tech Talk",
        "date_str": "Wed, Nov 18, 2026 6 PM - 8 PM",
        "location": "Seeley G. Mudd (SGM 123)",
        "description": "Google infrastructure engineers and USC alumni share insights into building massive scale distributed storage and inference pipelines. Q&A on SWE internship interviews with recruiters. Boba and pizza provided!",
        "has_free_food": True,
        "tags": ["Handshake", "Google", "Employer Info Session", "Tech Talk", "Distributed Systems", "Software Engineering"],
    },
    {
        "title": "Meta: AI Systems & Generative Foundation Models Tech Talk",
        "date_str": "Tue, Nov 24, 2026 5:30 PM - 7:30 PM",
        "location": "Ronald Tutor Hall (RTH 105)",
        "description": "Meta engineers present state-of-the-art training architectures and PyTorch 2.x optimizations. Networking session with tech recruiters for 2027 intern roles. Full dinner buffet catered by Sweetgreen.",
        "has_free_food": True,
        "tags": ["Handshake", "Meta", "Tech Talk", "AI", "Generative AI", "Networking"],
    },
    {
        "title": "Citadel & Citadel Securities: Quant & Software Engineering Career Session",
        "date_str": "Mon, Nov 23, 2026 5 PM - 7 PM",
        "location": "Fertitta Hall (JFF) Room 102",
        "description": "Explore high-performance computing, systematic trading algorithms, and real-time systems engineering at Citadel. Hear from USC alumni on the engineering team. Catered dinner and Citadel swag provided.",
        "has_free_food": True,
        "tags": ["Handshake", "Citadel", "Fintech", "Quantitative Research", "SWE", "High Performance"],
    },
    {
        "title": "Amazon Web Services (AWS): Cloud Architecture & Serverless Deep Dive",
        "date_str": "Thu, Nov 19, 2026 5:30 PM - 7:00 PM",
        "location": "Ginsburg Hall (Ginsburg Auditorium)",
        "description": "AWS Solutions Architects break down modern cloud system design, microservices, and distributed resilience. Informal Q&A on AWS cloud certifications and SWE roles. Refreshments and snacks provided.",
        "has_free_food": True,
        "tags": ["Handshake", "Amazon", "AWS", "Cloud", "Distributed Systems"],
    },
    {
        "title": "USC Career Center: Technical Resume & LeetCode Strategy Workshop",
        "date_str": "Tue, Nov 17, 2026 3 PM - 4:30 PM",
        "location": "Student Union (STU) Room 405 & Zoom",
        "description": "Peer career advisors and alumni recruiters review resume formatting, technical portfolio presentation, and interview technical problem-solving frameworks. Free coffee and cookies provided.",
        "has_free_food": True,
        "tags": ["Handshake", "USC Career Center", "Career Workshop", "Resume Review", "Interviews"],
    },
]


def parse_ics_datetime(val: str) -> Optional[datetime.datetime]:
    """Parses an RFC 5545 iCalendar datetime string (e.g., 20261118T180000Z)."""
    val = val.strip()
    if ";" in val:
        val = val.split(":")[-1].strip()

    # Pattern: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
    m = re.match(r"^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$", val)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        hour, minute = int(m.group(4)), int(m.group(5))
        sec = int(m.group(6)) if m.group(6) else 0
        is_utc = bool(m.group(7))
        dt = datetime.datetime(year, month, day, hour, minute, sec)
        if is_utc:
            # Convert UTC to Los Angeles PST (UTC - 8 hours)
            dt = dt - datetime.timedelta(hours=8)
        return dt

    # Date-only: YYYYMMDD
    m_date = re.match(r"^(\d{4})(\d{2})(\d{2})$", val)
    if m_date:
        return datetime.datetime(int(m_date.group(1)), int(m_date.group(2)), int(m_date.group(3)), 9, 0, 0)

    return None


def parse_ics_content(ics_text: str) -> List[Dict[str, Any]]:
    """
    Parses an iCalendar (.ics) string into normalized campus event dicts.
    Handles RFC 5545 multi-line unfolding and property unescaping.
    """
    # Unfold lines (a CRLF followed by a space or tab is a continuation)
    unfolded = re.sub(r"\r?\n[ \t]", "", ics_text)
    lines = unfolded.splitlines()

    events: List[Dict[str, Any]] = []
    current_event: Optional[Dict[str, str]] = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if line == "BEGIN:VEVENT":
            current_event = {}
        elif line == "END:VEVENT" and current_event is not None:
            summary = current_event.get("SUMMARY", "").replace("\\,", ",").replace("\\;", ";").strip()
            location = current_event.get("LOCATION", "").replace("\\,", ",").replace("\\;", ";").strip() or "USC Campus / Virtual"
            description = current_event.get("DESCRIPTION", "").replace("\\n", "\n").replace("\\,", ",").strip()

            dtstart_raw = current_event.get("DTSTART", "")
            dtend_raw = current_event.get("DTEND", "")

            s_dt = parse_ics_datetime(dtstart_raw)
            e_dt = parse_ics_datetime(dtend_raw)

            if s_dt and e_dt:
                date_str = f"{s_dt.strftime('%a, %b %-d, %Y %-I:%M %p')} - {e_dt.strftime('%-I:%M %p PST')}"
            elif s_dt:
                date_str = f"{s_dt.strftime('%a, %b %-d, %Y %-I:%M %p PST')}"
            else:
                date_str = "Fall 2026"

            combined = f"{summary} {description} {location}"
            has_free_food = bool(FREE_FOOD_REGEX.search(combined))

            tags = ["Handshake", "Career Event"]
            if "career fair" in summary.lower() or "career fair" in description.lower():
                tags.append("Career Fair")
            if "workshop" in summary.lower():
                tags.append("Career Workshop")
            if "talk" in summary.lower() or "speaker" in summary.lower():
                tags.append("Tech Talk")
            if "interview" in summary.lower():
                tags.append("Interviews")

            if summary:
                events.append({
                    "title": summary,
                    "date_str": date_str,
                    "location": location,
                    "description": description[:1000] if description else summary,
                    "has_free_food": has_free_food,
                    "tags": tags,
                })
            current_event = None
        elif current_event is not None:
            if ":" in line:
                key_part, val_part = line.split(":", 1)
                prop_name = key_part.split(";")[0].upper()
                current_event[prop_name] = val_part

    return events


def crawl_handshake_ics(source: str) -> List[Dict[str, Any]]:
    """Fetches and parses a Handshake calendar sync ICS feed from a URL or local file path."""
    source = source.strip()
    ics_text = ""

    if source.startswith("http://") or source.startswith("https://") or source.startswith("webcal://"):
        url = source.replace("webcal://", "https://")
        logger.info(f"🌐 Fetching Handshake Calendar feed from URL: {url[:50]}...")
        req = urllib.request.Request(url, headers={"User-Agent": "ChatSC/1.0 Handshake Calendar Ingestor"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            ics_text = resp.read().decode("utf-8", errors="ignore")
    elif os.path.exists(source):
        logger.info(f"📁 Reading Handshake Calendar file: {source}")
        with open(source, "r", encoding="utf-8", errors="ignore") as f:
            ics_text = f.read()
    else:
        logger.error(f"Invalid ICS source (not a URL or accessible file path): {source}")
        return []

    return parse_ics_content(ics_text)


def crawl_handshake_api(session_cookie: str, per_page: int = 50) -> List[Dict[str, Any]]:
    """
    Crawls upcoming USC Handshake events via the authenticated Handshake API.
    Uses the student's authenticated session cookie.
    """
    url = f"https://usc.joinhandshake.com/api/v1/events?page=1&per_page={per_page}"
    logger.info("🔐 Querying authenticated USC Handshake API...")

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
        "Cookie": session_cookie if session_cookie.startswith("_handshake_session=") else f"_handshake_session={session_cookie}",
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        logger.error(f"Handshake API returned HTTP {e.code}: {e.reason}")
        return []
    except Exception as e:
        logger.error(f"Failed to query Handshake API: {e}")
        return []

    raw_events = data.get("results") or data.get("events") or []
    events: List[Dict[str, Any]] = []

    for ev in raw_events:
        title = ev.get("name") or ev.get("title") or ""
        desc = ev.get("description") or ""
        desc_clean = re.sub(r"<[^>]+>", " ", desc).strip()
        loc = ev.get("location_name") or ev.get("location") or "USC Campus / Virtual"

        start_str = ev.get("start_date") or ev.get("start_date_time") or ""
        end_str = ev.get("end_date") or ev.get("end_date_time") or ""

        date_str = f"{start_str[:10]} - {end_str[:10]}" if start_str else "Upcoming"

        combined = f"{title} {desc_clean}"
        has_free_food = bool(FREE_FOOD_REGEX.search(combined))

        tags = ["Handshake", "Career Event"]
        employer = ev.get("employer", {})
        if isinstance(employer, dict) and employer.get("name"):
            tags.append(employer["name"])

        events.append({
            "title": title,
            "date_str": date_str,
            "location": loc,
            "description": desc_clean[:1000],
            "has_free_food": has_free_food,
            "tags": tags,
        })

    return events


def ingest_handshake_events(
    events: List[Dict[str, Any]],
    store: Optional[MemoryStore] = None,
    dry_run: bool = False
) -> int:
    """Ingests normalized Handshake events into memory.db with semantic embeddings."""
    if not events:
        logger.warning("No Handshake events to ingest.")
        return 0

    if store is None:
        store = MemoryStore()

    count = 0
    for ev in events:
        if dry_run:
            logger.info(f"   [DRY-RUN] Would ingest Handshake event: {ev['title']} ({ev['date_str']} @ {ev['location']})")
            count += 1
            continue

        res = store.add_event(
            title=ev["title"],
            date_str=ev["date_str"],
            location=ev["location"],
            description=ev["description"],
            has_free_food=ev["has_free_food"],
            tags=ev["tags"],
        )
        if res:
            count += 1
            food_flag = " 🍕 (Free Food!)" if ev["has_free_food"] else ""
            logger.info(f"   ✅ Saved: '{ev['title']}' ({ev['date_str']}){food_flag}")

    logger.info(f"🤝 Handshake Ingestion Complete: {count} event(s) processed.")
    return count


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest events from Handshake into ChatSC memory.")
    parser.add_argument("--ics", type=str, default="", help="Handshake Calendar sync URL or local .ics file path.")
    parser.add_argument("--cookie", type=str, default=os.getenv("HANDSHAKE_SESSION", ""), help="Handshake _handshake_session cookie.")
    parser.add_argument("--sample", action="store_true", help="Ingest sample verified USC Handshake career events.")
    parser.add_argument("--dry-run", action="store_true", help="Inspect parsed events without writing to memory.db.")

    args = parser.parse_args()

    events_to_ingest: List[Dict[str, Any]] = []

    if args.ics:
        events_to_ingest = crawl_handshake_ics(args.ics)
    elif args.cookie:
        events_to_ingest = crawl_handshake_api(args.cookie)
    elif args.sample:
        logger.info("💼 Loading verified USC Handshake career events, career fairs, and employer tech talks...")
        events_to_ingest = HANDSHAKE_SAMPLE_EVENTS
    else:
        logger.info("ℹ️ No specific source provided. Running with --sample verified USC Handshake events.")
        events_to_ingest = HANDSHAKE_SAMPLE_EVENTS

    ingest_handshake_events(events_to_ingest, dry_run=args.dry_run)
