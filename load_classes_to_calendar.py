#!/usr/bin/env python3
"""
Populates the student's enrolled USC class schedule into macOS Calendar.app.
Adds recurring class blocks (CS 402 and CS 572) for the remainder of the semester.
"""

import argparse
import datetime
import logging
import subprocess
from typing import List, Tuple, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("load_classes")

# Weekly class schedule definitions (day_of_week: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri)
CLASS_SCHEDULE = [
    # CSCI 402: Operating Systems (Monday, Wednesday, Friday 10:00 AM - 11:50 AM @ OHE132)
    {"day": 0, "title": "CSCI 402: Operating Systems", "start_time": (10, 0), "end_time": (11, 50), "location": "OHE132"},
    {"day": 2, "title": "CSCI 402: Operating Systems", "start_time": (10, 0), "end_time": (11, 50), "location": "OHE132"},
    {"day": 4, "title": "CSCI 402: Operating Systems", "start_time": (10, 0), "end_time": (11, 50), "location": "OHE132"},

    # CSCI 591: Computer Science Research Colloquium (Tuesday 4:00 PM - 5:20 PM @ OHE100C)
    {"day": 1, "title": "CSCI 591: Computer Science Research Colloquium", "start_time": (16, 0), "end_time": (17, 20), "location": "OHE100C"},

    # CSCI 572: Information Retrieval and Web Search Engines (Thursday 5:00 PM - 8:00 PM @ SGM123)
    {"day": 3, "title": "CSCI 572: Information Retrieval and Web Search Engines", "start_time": (17, 0), "end_time": (20, 0), "location": "SGM123"},
]


def get_available_calendars() -> List[str]:
    """Retrieves list of writable calendar names in macOS Calendar.app."""
    script = 'tell application "Calendar" to get name of calendars'
    try:
        res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=8)
        if res.returncode == 0:
            return [c.strip() for c in res.stdout.strip().split(",") if c.strip()]
    except Exception as e:
        logger.warning(f"Could not retrieve calendar names: {e}")
    return ["Calendar"]


def pick_target_calendar(calendars: List[str], preferred: Optional[str] = None) -> str:
    """Selects the best calendar to insert classes into."""
    if preferred and preferred in calendars:
        return preferred

    # Prefer a calendar containing 'usc' or 'student'
    for c in calendars:
        if "usc" in c.lower():
            return c

    # Fallback to standard calendars
    for c in ["Calendar", "Home", "Work"]:
        if c in calendars:
            return c

    return calendars[0] if calendars else "Calendar"


def load_classes(
    start_date: datetime.date,
    end_date: datetime.date,
    calendar_name: Optional[str] = None,
    dry_run: bool = False
) -> int:
    """
    Inserts recurring course meetings into the target macOS calendar between start_date and end_date.
    Uses batch AppleScript for sub-second execution.
    """
    cals = get_available_calendars()
    target_cal = pick_target_calendar(cals, preferred=calendar_name)
    logger.info(f"📅 Target macOS Calendar: '{target_cal}'")

    current = start_date
    events_to_create = []

    while current <= end_date:
        weekday = current.weekday()
        for item in CLASS_SCHEDULE:
            if item["day"] == weekday:
                sh, sm = item["start_time"]
                eh, em = item["end_time"]
                start_dt = datetime.datetime(current.year, current.month, current.day, sh, sm, 0)
                end_dt = datetime.datetime(current.year, current.month, current.day, eh, em, 0)

                title = item["title"]
                location = item["location"]
                date_str = current.strftime("%A, %b %-d")
                time_str = f"{start_dt.strftime('%-I:%M %p')} - {end_dt.strftime('%-I:%M %p')}"

                events_to_create.append({
                    "title": title,
                    "location": location,
                    "start_dt": start_dt,
                    "end_dt": end_dt,
                    "date_str": date_str,
                    "time_str": time_str
                })
        current += datetime.timedelta(days=1)

    if dry_run:
        for ev in events_to_create:
            logger.info(f"   [DRY-RUN] Would add: {ev['title']} on {ev['date_str']} ({ev['time_str']} @ {ev['location']})")
        return len(events_to_create)

    # Build single batch AppleScript with locale-independent date construction
    s_start_sec = 0
    s_end_sec = 86399
    
    script_lines = [
        'tell application "Calendar"',
        f'    tell calendar "{target_cal}"',
        '        set dStart to (current date)',
        '        set day of dStart to 1',
        f'        set year of dStart to {start_date.year}',
        f'        set month of dStart to {start_date.month}',
        f'        set day of dStart to {start_date.day}',
        '        set time of dStart to 0',
        '        set dEnd to (current date)',
        '        set day of dEnd to 1',
        f'        set year of dEnd to {end_date.year}',
        f'        set month of dEnd to {end_date.month}',
        f'        set day of dEnd to {end_date.day}',
        '        set time of dEnd to 86399',
        '        try',
        '            set oldEvs to (every event whose start date is greater than or equal to dStart and start date is less than or equal to dEnd and (summary starts with "CS 402" or summary starts with "CS 572"))',
        '            repeat with ev in oldEvs',
        '                delete ev',
        '            end repeat',
        '        end try'
    ]

    for idx, ev in enumerate(events_to_create):
        s_dt = ev["start_dt"]
        e_dt = ev["end_dt"]
        s_sec = s_dt.hour * 3600 + s_dt.minute * 60
        e_sec = e_dt.hour * 3600 + e_dt.minute * 60
        title = ev["title"]
        loc = ev["location"]

        script_lines.extend([
            f'        set sDate{idx} to (current date)',
            f'        set day of sDate{idx} to 1',
            f'        set year of sDate{idx} to {s_dt.year}',
            f'        set month of sDate{idx} to {s_dt.month}',
            f'        set day of sDate{idx} to {s_dt.day}',
            f'        set time of sDate{idx} to {s_sec}',
            f'        set eDate{idx} to (current date)',
            f'        set day of eDate{idx} to 1',
            f'        set year of eDate{idx} to {e_dt.year}',
            f'        set month of eDate{idx} to {e_dt.month}',
            f'        set day of eDate{idx} to {e_dt.day}',
            f'        set time of eDate{idx} to {e_sec}',
            f'        make new event with properties {{summary:"{title}", start date:sDate{idx}, end date:eDate{idx}, location:"{loc}"}}'
        ])

    script_lines.append('    end tell')
    script_lines.append('end tell')

    batch_script = "\n".join(script_lines)

    try:
        res = subprocess.run(["osascript", "-e", batch_script], capture_output=True, text=True, timeout=30)
        if res.returncode == 0:
            logger.info(f"🎉 Successfully loaded {len(events_to_create)} class session(s) into '{target_cal}'!")
            for ev in events_to_create[:4]:
                logger.info(f"   • {ev['title']} on {ev['date_str']} ({ev['time_str']})")
            logger.info(f"   ... and {len(events_to_create) - 4} more sessions through {end_date.strftime('%b %d')}.")
            return len(events_to_create)
        else:
            logger.error(f"AppleScript batch error: {res.stderr.strip()}")
            return 0
    except Exception as e:
        logger.error(f"Failed to execute batch script: {e}")
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load USC classes into macOS Calendar.app.")
    parser.add_argument("--calendar", type=str, default="", help="Specific calendar name to populate.")
    parser.add_argument("--weeks", type=int, default=4, help="Number of upcoming weeks to populate (default: 4).")
    parser.add_argument("--dry-run", action="store_true", help="Print schedule without creating calendar events.")

    args = parser.parse_args()

    today = datetime.date.today()
    end = today + datetime.timedelta(weeks=args.weeks)

    load_classes(
        start_date=today,
        end_date=end,
        calendar_name=args.calendar or None,
        dry_run=args.dry_run
    )
