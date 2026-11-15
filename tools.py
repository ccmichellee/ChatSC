import json
from typing import Dict, Any, List
from student_memory import MemoryStore
from calendar_reader import MacCalendarReader

store = MemoryStore()
cal_reader = MacCalendarReader()

TOOLS_SPEC = [
    {
        "type": "function",
        "function": {
            "name": "search_campus_events",
            "description": "Searches for live USC campus events, workshops, hackathons, and speaker talks by topic or keyword. Automatically evaluates student calendar availability for returned events.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Event topic, title, or interest, e.g. 'hackathon', 'AI talk', 'free dinner', 'career networking'"
                    },
                    "free_food_only": {
                        "type": "boolean",
                        "description": "Set to true to filter specifically for events with free food/meals."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_campus_clubs",
            "description": "Searches registered USC student organizations, tech clubs, incubators, and project teams.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Club keyword, domain, or category, e.g. 'AI', 'robotics', 'startups', 'consulting'"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_student_calendar",
            "description": "Checks the student's personal macOS calendar for upcoming classes, appointments, busy blocks, and free time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {
                        "type": "integer",
                        "description": "Number of days ahead to inspect (default: 14)."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_student_profile",
            "description": "Fetches the current student's background, courses, major, and known interests from memory.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]


def execute_tool(name: str, arguments: Dict[str, Any], current_user: str) -> str:
    """Executes a tool call and returns JSON string result."""
    try:
        if name == "search_campus_events":
            query = arguments.get("query", "")
            free_food_only = bool(arguments.get("free_food_only", False))
            events = store.search_events(query, free_food_only=free_food_only, top_k=3)

            # Check student calendar availability for each event
            student_cals = cal_reader.get_upcoming_events(days_ahead=30)
            for ev in events:
                sched = cal_reader.evaluate_conflict(ev.get("date", ""), student_cals)
                ev["schedule_status"] = sched["status"]
                ev["schedule_availability"] = sched.get("conflicting_details") or sched.get("note")

            return json.dumps({"events": events}, indent=2)

        elif name == "check_student_calendar":
            days = arguments.get("days_ahead", 14)
            cal_events = cal_reader.get_upcoming_events(days_ahead=days)
            summary_list = []
            for e in cal_events:
                if e.get("is_holiday"):
                    summary_list.append(f"{e['summary']} on {e['start_dt'].strftime('%A, %b %-d')} (All Day - USC Campus Closed / No Classes)")
                else:
                    loc_str = f" @ {e['location']}" if e.get("location") else ""
                    summary_list.append(
                        f"{e['summary']} on {e['start_dt'].strftime('%A, %b %-d from %-I:%M %p')} to {e['end_dt'].strftime('%-I:%M %p PST')}{loc_str}"
                    )
            return json.dumps({
                "calendar_events": summary_list if summary_list else f"Calendar is completely clear for the next {days} days."
            }, indent=2)

        elif name == "search_campus_clubs":
            query = arguments.get("query", "")
            clubs = store.search_clubs(query, top_k=3)
            return json.dumps({"clubs": clubs}, indent=2)

        elif name == "get_student_profile":
            profile = store.get_student_profile(current_user)
            if not profile:
                students = store.list_all_students()
                if students:
                    profile = store.get_student_profile(students[0]["phone_or_email"])
            return json.dumps({"profile": profile}, indent=2)

        else:
            return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as e:
        return json.dumps({"error": str(e)})
