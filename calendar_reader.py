import datetime
import logging
import os
import re
import subprocess
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("calendar_reader")

DEFAULT_SKIP_CALENDARS = [
    "Festivos en Estados Unidos",
    "Holidays in Colombia",
    "Festivos de Colombia",
    "Scheduled Reminders",
    "Birthdays",
    "Siri Suggestions",
    "US Holidays",
    "Holidays in United States",
    "Birthdays",
]

MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
}

# Student's enrolled weekly recurring class schedule (in USC Pacific Time, PST)
RECURRING_WEEKLY_SCHEDULE = [
    # Monday: CSCI 402 Operating Systems
    {
        "day": 0,
        "title": "CSCI 402: Operating Systems",
        "start_time": (10, 0),
        "end_time": (11, 50),
        "location": "OHE132",
        "calendar": "linero@usc.edu"
    },
    # Tuesday: CSCI 591 Computer Science Research Colloquium
    {
        "day": 1,
        "title": "CSCI 591: Computer Science Research Colloquium",
        "start_time": (16, 0),
        "end_time": (17, 20),
        "location": "OHE100C",
        "calendar": "linero@usc.edu"
    },
    # Wednesday: CSCI 402 Operating Systems
    {
        "day": 2,
        "title": "CSCI 402: Operating Systems",
        "start_time": (10, 0),
        "end_time": (11, 50),
        "location": "OHE132",
        "calendar": "linero@usc.edu"
    },
    # Thursday: Impatico Builders Work Session
    {
        "day": 3,
        "title": "Impatico | Builders Work Session",
        "start_time": (14, 0),
        "end_time": (15, 30),
        "location": "meet.google.com",
        "calendar": "Work"
    },
    # Thursday: CSCI 572 Information Retrieval and Web Search Engines
    {
        "day": 3,
        "title": "CSCI 572: Information Retrieval and Web Search Engines",
        "start_time": (17, 0),
        "end_time": (20, 0),
        "location": "SGM123",
        "calendar": "linero@usc.edu"
    },
    # Friday: CSCI 402 Operating Systems
    {
        "day": 4,
        "title": "CSCI 402: Operating Systems",
        "start_time": (10, 0),
        "end_time": (11, 50),
        "location": "OHE132",
        "calendar": "linero@usc.edu"
    },
    # Sunday: Tennis session sign up
    {
        "day": 6,
        "title": "Tennis session sign up",
        "start_time": (15, 50),
        "end_time": (16, 50),
        "location": "Online",
        "calendar": "Calendar"
    }
]


def get_pst_offset() -> datetime.timedelta:
    """Calculates offset between local system time and USC Pacific Time (PST, UTC-8)."""
    local_offset_sec = -time.timezone if time.daylight == 0 else -time.altzone
    pst_offset_sec = -8 * 3600
    diff_sec = local_offset_sec - pst_offset_sec
    return datetime.timedelta(seconds=diff_sec)


def parse_time_str(t_str: str, meridiem: str) -> datetime.time:
    """Parses a time string like '12:30' or '6' with AM/PM into a datetime.time object."""
    meridiem = meridiem.upper()
    if ":" in t_str:
        h, m = [int(x) for x in t_str.split(":")]
    else:
        h = int(t_str)
        m = 0

    if meridiem == "PM" and h < 12:
        h += 12
    elif meridiem == "AM" and h == 12:
        h = 0
    return datetime.time(hour=h, minute=m)


def parse_campus_event_interval(date_str: str) -> Optional[Tuple[datetime.datetime, datetime.datetime, bool]]:
    """
    Parses date_str from campus_events into start and end datetime intervals.
    Returns: (start_dt, end_dt, has_explicit_time) or None if unparseable.
    """
    if not date_str:
        return None

    clean = " ".join(date_str.split()).strip()

    # Pattern A: ISO standard date (e.g. 2026-11-18 or 2026-11-18 18:00)
    iso_match = re.search(r"(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?", clean)
    if iso_match:
        year, month, day = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        if iso_match.group(4):
            hour, minute = int(iso_match.group(4)), int(iso_match.group(5))
            start_dt = datetime.datetime(year, month, day, hour, minute)
            end_dt = start_dt + datetime.timedelta(hours=2)
            return (start_dt, end_dt, True)
        else:
            # Whole-day bounds
            start_dt = datetime.datetime(year, month, day, 9, 0)
            end_dt = datetime.datetime(year, month, day, 21, 0)
            return (start_dt, end_dt, False)

    # Pattern B: Month Day, Year (e.g. 'Wed, Nov 18, 2026 12 PM - 12:30 PM')
    month_match = re.search(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?", clean, re.IGNORECASE)
    if month_match:
        month_name = month_match.group(1).lower()
        month = MONTH_MAP.get(month_name, 11)
        day = int(month_match.group(2))
        year = int(month_match.group(3)) if month_match.group(3) else datetime.datetime.now().year

        # Check for times
        times = re.findall(r"(\d{1,2}(?::\d{2})?)\s*(am|pm)", clean, re.IGNORECASE)
        if len(times) >= 2:
            t1 = parse_time_str(times[0][0], times[0][1])
            t2 = parse_time_str(times[1][0], times[1][1])
            start_dt = datetime.datetime(year, month, day, t1.hour, t1.minute)
            end_dt = datetime.datetime(year, month, day, t2.hour, t2.minute)
            if end_dt <= start_dt:
                end_dt += datetime.timedelta(hours=2)
            return (start_dt, end_dt, True)
        elif len(times) == 1:
            t1 = parse_time_str(times[0][0], times[0][1])
            start_dt = datetime.datetime(year, month, day, t1.hour, t1.minute)
            end_dt = start_dt + datetime.timedelta(hours=2)
            return (start_dt, end_dt, True)
        else:
            start_dt = datetime.datetime(year, month, day, 9, 0)
            end_dt = datetime.datetime(year, month, day, 21, 0)
            return (start_dt, end_dt, False)

    return None


class MacCalendarReader:
    """
    Reads the student's personal schedule directly from macOS Calendar.app via AppleScript.
    Cross-references scheduled commitments against campus events to detect availability.
    """

    def __init__(self, skip_calendars: Optional[List[str]] = None, mock: bool = False, cache_ttl_seconds: int = 180):
        self.skip_calendars = skip_calendars or DEFAULT_SKIP_CALENDARS
        self.mock = mock
        self.cache_ttl_seconds = cache_ttl_seconds
        self._cached_events: Optional[List[Dict[str, Any]]] = None
        self._cache_time: Optional[datetime.datetime] = None

    def get_upcoming_events(self, days_ahead: int = 21, use_cache: bool = True) -> List[Dict[str, Any]]:
        """
        Retrieves scheduled events from macOS Calendar.app for the next `days_ahead` days.
        Returns a list of dicts: {calendar, summary, start_iso, end_iso, start_dt, end_dt}.
        """
        now = datetime.datetime.now()
        if (
            use_cache
            and self._cached_events is not None
            and self._cache_time is not None
            and (now - self._cache_time).total_seconds() < self.cache_ttl_seconds
        ):
            return self._cached_events

        if self.mock:
            self._cached_events = self._get_mock_events()
            self._cache_time = now
            return self._cached_events

        script = f'''
tell application "Calendar"
    set d1 to current date
    set d2 to d1 + ({days_ahead} * days)
    set calNames to name of calendars
    set outText to ""
    repeat with cName in calNames
        set cNameStr to cName as string
        if cNameStr does not contain "Holidays" and cNameStr does not contain "Festivos" and cNameStr does not contain "Birthdays" and cNameStr does not contain "Reminders" and cNameStr does not contain "Siri" then
            try
                tell calendar cNameStr
                    set evs to (every event whose start date is greater than or equal to d1 and start date is less than or equal to d2)
                    repeat with e in evs
                        set outText to outText & cNameStr & ":::" & (summary of e) & ":::" & (start date of e as «class isot» as string) & ":::" & (end date of e as «class isot» as string) & linefeed
                    end repeat
                end tell
            end try
        end if
    end repeat
    return outText
end tell
'''
        try:
            res = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                timeout=15
            )
            if res.returncode != 0:
                logger.warning(f"AppleScript Calendar read returned error: {res.stderr.strip()}. Using fallback.")
                self._cached_events = self._get_mock_events()
                return self._cached_events

            output = res.stdout.strip()
            if not output:
                logger.info("No events found in Calendar.app for the selected date range.")
                self._cached_events = []
                return []

            events = []
            for line in output.splitlines():
                parts = line.split(":::")
                if len(parts) >= 4:
                    cal_name = parts[0].strip()
                    summary = parts[1].strip()
                    start_str = parts[2].strip()
                    end_str = parts[3].strip()

                    try:
                        start_dt = datetime.datetime.fromisoformat(start_str)
                        end_dt = datetime.datetime.fromisoformat(end_str)
                        # Normalize local AppleScript dates to USC Pacific Time (PST)
                        pst_offset = get_pst_offset()
                        start_dt = start_dt - pst_offset
                        end_dt = end_dt - pst_offset
                        events.append({
                            "calendar": cal_name,
                            "summary": summary,
                            "start_iso": start_dt.isoformat(),
                            "end_iso": end_dt.isoformat(),
                            "start_dt": start_dt,
                            "end_dt": end_dt,
                        })
                    except Exception as e:
                        logger.debug(f"Failed to parse datetime from '{start_str}': {e}")

            # Expand recurring weekly schedule across the query range
            recurring_evs = self._expand_recurring_schedule(now.date(), now.date() + datetime.timedelta(days=days_ahead))

            # Combine one-off events and recurring events
            all_events = events + recurring_evs
            # Deduplicate by (summary, start_dt)
            seen = set()
            unique_events = []
            for ev in all_events:
                key = (ev["summary"], ev["start_dt"])
                if key not in seen:
                    seen.add(key)
                    unique_events.append(ev)

            unique_events.sort(key=lambda x: x["start_dt"])
            logger.info(f"📅 Retrieved {len(unique_events)} total event(s) (including recurring courses) for student.")
            self._cached_events = unique_events
            self._cache_time = now
            return unique_events

        except subprocess.TimeoutExpired:
            logger.warning("Calendar AppleScript query timed out. Using fallback schedule.")
            self._cached_events = self._get_mock_events()
            self._cache_time = now
            return self._cached_events
        except Exception as e:
            logger.warning(f"Failed to query Calendar.app: {e}. Using fallback schedule.")
            self._cached_events = self._get_mock_events()
            self._cache_time = now
            return self._cached_events

    def _expand_recurring_schedule(self, start_date: datetime.date, end_date: datetime.date) -> List[Dict[str, Any]]:
        """
        Expands the student's enrolled weekly recurring courses and commitments
        (CSCI 402, CSCI 572, CSCI 591, Impatico, Tennis sign up) across the given date range.
        Times are in USC Pacific Standard Time (PST).
        """
        recurring_events = []
        current = start_date
        semester_end = datetime.date(2026, 12, 12)

        while current <= min(end_date, semester_end):
            weekday = current.weekday()
            for item in RECURRING_WEEKLY_SCHEDULE:
                if item["day"] == weekday:
                    sh, sm = item["start_time"]
                    eh, em = item["end_time"]
                    start_dt = datetime.datetime(current.year, current.month, current.day, sh, sm, 0)
                    end_dt = datetime.datetime(current.year, current.month, current.day, eh, em, 0)

                    recurring_events.append({
                        "calendar": item.get("calendar", "linero@usc.edu"),
                        "summary": item["title"],
                        "location": item.get("location", ""),
                        "start_iso": start_dt.isoformat(),
                        "end_iso": end_dt.isoformat(),
                        "start_dt": start_dt,
                        "end_dt": end_dt,
                        "is_recurring": True,
                    })
            current += datetime.timedelta(days=1)

        return recurring_events

    def _get_mock_events(self) -> List[Dict[str, Any]]:
        """Fallback mock schedule for unit tests and offline simulations."""
        now = datetime.datetime.now()
        base_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        recurring = self._expand_recurring_schedule(base_date.date(), base_date.date() + datetime.timedelta(days=14))
        one_offs = [
            {
                "calendar": "linero@usc.edu",
                "summary": "IRS visit - ITIN (appointment required)",
                "location": "IRS Taxpayer Assistance Center",
                "start_dt": base_date + datetime.timedelta(days=9, hours=9, minutes=45),
                "end_dt": base_date + datetime.timedelta(days=9, hours=11, minutes=45),
                "start_iso": (base_date + datetime.timedelta(days=9, hours=9, minutes=45)).isoformat(),
                "end_iso": (base_date + datetime.timedelta(days=9, hours=11, minutes=45)).isoformat(),
            }
        ]
        all_evs = recurring + one_offs
        all_evs.sort(key=lambda x: x["start_dt"])
        return all_evs

    def evaluate_conflict(
        self,
        event_date_str: str,
        student_events: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates whether a campus event clashes with the student's personal schedule.
        Returns a dict:
        {
            "status": "free" | "conflict",
            "has_conflict": bool,
            "conflicting_event": Optional[str],
            "conflicting_details": Optional[str],
            "busy_same_day": List[str],
            "note": str
        }
        """
        interval = parse_campus_event_interval(event_date_str)
        if not interval:
            return {
                "status": "free",
                "has_conflict": False,
                "conflicting_event": None,
                "conflicting_details": None,
                "busy_same_day": [],
                "note": "Date format unparseable; schedule presumed free."
            }

        ev_start, ev_end, has_explicit_time = interval
        if student_events is None:
            student_events = self.get_upcoming_events()

        busy_same_day = []
        for s_ev in student_events:
            s_start = s_ev["start_dt"]
            s_end = s_ev["end_dt"]

            # Same day check
            if s_start.date() == ev_start.date():
                time_fmt = f"{s_start.strftime('%-I:%M %p')} - {s_end.strftime('%-I:%M %p')}"
                busy_same_day.append(f"{s_ev['summary']} ({time_fmt})")

                # If the campus event has explicit time, check overlap interval: max(s1, s2) < min(e1, e2)
                if has_explicit_time:
                    overlap_start = max(s_start, ev_start)
                    overlap_end = min(s_end, ev_end)
                    if overlap_start < overlap_end:
                        return {
                            "status": "conflict",
                            "has_conflict": True,
                            "conflicting_event": s_ev["summary"],
                            "conflicting_details": f"Overlaps with '{s_ev['summary']}' ({time_fmt})",
                            "busy_same_day": busy_same_day,
                            "note": f"Direct calendar conflict with {s_ev['summary']} on {s_start.strftime('%A, %b %-d')}."
                        }

        # If it's a date-only campus event and the student has events that day
        if not has_explicit_time and busy_same_day:
            return {
                "status": "free",
                "has_conflict": False,
                "conflicting_event": None,
                "conflicting_details": None,
                "busy_same_day": busy_same_day,
                "note": f"Free for general hours; has {len(busy_same_day)} item(s) on calendar: {', '.join(busy_same_day)}."
            }

        return {
            "status": "free",
            "has_conflict": False,
            "conflicting_event": None,
            "conflicting_details": None,
            "busy_same_day": busy_same_day,
            "note": "Student calendar is clear at this time."
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    reader = MacCalendarReader()
    evs = reader.get_upcoming_events(days_ahead=30)
    print(f"\nFound {len(evs)} events on student macOS Calendar:")
    for e in evs:
        print(f" • [{e['calendar']}] {e['summary']} ({e['start_dt'].strftime('%a %b %d, %I:%M %p')} - {e['end_dt'].strftime('%I:%M %p')})")

    # Test conflict evaluation
    sample_date = "Wed, Nov 18, 2026 6 PM - 8 PM"
    eval_res = reader.evaluate_conflict(sample_date, evs)
    print(f"\nConflict evaluation for '{sample_date}':")
    print(eval_res)
