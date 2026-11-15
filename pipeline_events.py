import argparse
import logging
import os
import sys
from typing import List, Dict, Any, Optional

from student_memory import MemoryStore
from crawl_usc_events import crawl_events
from llm_client import LlamaClient
from imessage_sender import send_message
from calendar_reader import MacCalendarReader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("pipeline_events")


# Optional mapping of phone numbers to preferred iMessage identifiers (e.g. iCloud handle)
PREFERRED_IMESSAGE_TARGETS: Dict[str, str] = {}


def generate_proactive_outreach(
    llama: LlamaClient,
    student_profile: Dict[str, Any],
    events: List[Dict[str, Any]],
    target_user: str
) -> str:
    """
    Wakes up Tommy autonomously to craft a concise, spontaneous iMessage heads-up
    tailored to the student's courses, clubs, and interests.
    """
    events_text = "\n".join([
        f"• Title: {e['title']}\n"
        f"  Date & Time: {e['date']}\n"
        f"  Location: {e['location']}\n"
        f"  Free Food: {'Yes' if e['has_free_food'] else 'No'}\n"
        f"  Match Signals: {', '.join(e.get('matched_reasons', []))}\n"
        f"  Schedule Availability: {e.get('schedule_note', 'Clear on calendar')}\n"
        f"  Description: {e['description'][:220]}"
        for e in events
    ])

    wake_prompt = (
        f"[Proactive Autonomous Wake-Up Notification]\n"
        f"You are Tommy, an energetic and plugged-in USC student AI texting a fellow Trojan over iMessage.\n"
        f"You just woke up because your campus event crawler discovered high-affinity upcoming events!\n\n"
        f"Student Recipient:\n"
        f"• Name: {student_profile.get('name', 'Trojan')}\n"
        f"• Major: {student_profile.get('major', 'Student')} ({student_profile.get('school', 'USC')})\n"
        f"• Enrolled Courses: {student_profile.get('courses', [])}\n"
        f"• Active Clubs: {student_profile.get('clubs', [])}\n"
        f"• Core Interests: {student_profile.get('interests', [])}\n\n"
        f"Events Discovered (with Student Schedule Status):\n"
        f"{events_text}\n\n"
        f"Instructions for iMessage:\n"
        f"1. Write a natural, conversational heads-up text (2-3 sentences max) to {student_profile.get('name', 'friend')}.\n"
        f"2. If multiple events are provided, touch on both.\n"
        f"3. Calendar Awareness: If an event has a schedule conflict (marked with 'Direct calendar conflict' or 'Overlaps with'), gently acknowledge it in a spontaneous student way (e.g., 'Heads up: I saw you have [Conflict], but in case your schedule opens up, [Event] is happening...'). If free, feel free to mention their calendar looks clear!\n"
        f"4. Keep it brief, spontaneous, and Trojan-spirited (e.g., 'Fight On! ✌️').\n"
        f"5. Do NOT use bullet points, markdown headers, or robotic formal greetings."
    )

    # Use direct completion without tools for proactive notification synthesis
    reply = llama.generate_reply(wake_prompt, current_user=target_user, use_tools=False)

    # Fallback safety guard: Never send raw API errors or empty strings as iMessages
    if not reply or reply.startswith("⚠️"):
        logger.warning(f"Model returned '{reply}', synthesizing high-quality template fallback.")
        ev_lines = []
        for ev in events:
            food_txt = " (free food!)" if ev.get("has_free_food") else ""
            conflict_txt = f" [heads up: might overlap with {ev['conflicting_event']}]" if ev.get("has_schedule_conflict") else ""
            ev_lines.append(f"{ev['title']} ({ev['date']} @ {ev['location']}{food_txt}{conflict_txt})")
        reply = (
            f"Hey {student_profile.get('name', 'Trojan')}! Quick heads up on a couple campus events: "
            f"{' and '.join(ev_lines)}. Fight On! ✌️"
        )

    return reply


def run_pipeline(
    crawl: bool = True,
    days: int = 60,
    max_pages: int = 3,
    target_user: Optional[str] = None,
    max_recommend: int = 2,
    min_similarity: float = 0.48,
    dry_run: bool = False,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    bot_prefix: str = "🤖 ",
    use_calendar: bool = True,
    mock_calendar: bool = False
) -> Dict[str, Any]:
    """
    Executes the full pipeline:
    1. Crawls USC calendar events into memory.db.
    2. Identifies unnotified events matching registered student profiles.
    3. Checks student's macOS Calendar for conflicts.
    4. Wakes up the agent to generate proactive recommendations with schedule awareness.
    5. Delivers via iMessage and logs recommendations to prevent duplicates.
    """
    store = MemoryStore()

    # Step 1: Ingest fresh events
    crawled_count = 0
    if crawl:
        logger.info("📡 Step 1: Starting campus events crawl (USC Calendar + EngageSC + Handshake)...")
        crawled_count = crawl_events(days=days, max_pages=max_pages, store=store)
        try:
            from crawl_handshake_events import HANDSHAKE_SAMPLE_EVENTS, ingest_handshake_events
            hs_count = ingest_handshake_events(HANDSHAKE_SAMPLE_EVENTS, store=store)
            crawled_count += hs_count
        except Exception as e:
            logger.warning(f"Could not ingest Handshake events: {e}")
    else:
        logger.info("⏭️ Step 1: Skipping crawl as requested.")

    # Step 2: Initialize LLM client
    llama = LlamaClient(api_key=api_key or None, model=model or None)
    if not llama.is_configured():
        logger.warning("⚠️ Meta API key not set. LLAMA_API_KEY is required for proactive agent wake-up.")
        return {"status": "error", "error": "LLAMA_API_KEY not configured"}

    # Initialize macOS Calendar reader if enabled
    cal_reader = None
    student_cal_events: List[Dict[str, Any]] = []
    if use_calendar:
        logger.info("📅 Initializing macOS Calendar availability checker...")
        cal_reader = MacCalendarReader(mock=mock_calendar)
        student_cal_events = cal_reader.get_upcoming_events(days_ahead=30)

    # Step 3: Determine target students (with alias normalization)
    if target_user:
        target_ids = [target_user]
    else:
        students = store.list_all_students()
        raw_ids = [s["phone_or_email"] for s in students]
        # Normalize and deduplicate linked aliases (prefer iCloud email for iMessage delivery)
        seen_normalized = set()
        target_ids = []
        for rid in raw_ids:
            preferred = PREFERRED_IMESSAGE_TARGETS.get(rid, rid)
            if preferred not in seen_normalized:
                seen_normalized.add(preferred)
                target_ids.append(preferred)

    if not target_ids:
        logger.warning("No students found in memory store to notify.")
        return {"status": "ok", "crawled": crawled_count, "notifications_sent": 0}

    logger.info(f"🔍 Step 2: Evaluating recommendations for {len(target_ids)} student(s)...")

    notifications_sent = 0

    for user_id in target_ids:
        profile = store.get_student_profile(user_id)
        if not profile:
            students = store.list_all_students()
            if students:
                profile = store.get_student_profile(students[0]["phone_or_email"])
        if not profile:
            logger.info(f"No profile found for {user_id}, skipping.")
            continue

        student_name = profile.get("name", user_id)
        logger.info(f"Checking unnotified events for {student_name} ({user_id})...")

        # Step 4: Retrieve unnotified matching events
        unnotified = store.get_unnotified_events_for_student(
            phone_or_email=user_id,
            min_similarity=min_similarity,
            limit=max_recommend
        )

        if not unnotified:
            logger.info(f"   No new unnotified matching events for {student_name}.")
            continue

        logger.info(f"   Found {len(unnotified)} matching event(s) for {student_name}:")
        for ev in unnotified:
            # Step 4.5: Check calendar availability & conflicts
            if cal_reader:
                sched_eval = cal_reader.evaluate_conflict(ev["date"], student_cal_events)
                ev["schedule_status"] = sched_eval["status"]
                ev["has_schedule_conflict"] = sched_eval["has_conflict"]
                ev["conflicting_event"] = sched_eval.get("conflicting_event")
                ev["schedule_note"] = sched_eval.get("conflicting_details") or sched_eval.get("note")

                status_emoji = "⚠️ Conflict" if ev["has_schedule_conflict"] else "✅ Free"
                logger.info(f"   • [{ev['id']}] {ev['title']} (Score: {ev['match_score']}, {status_emoji}: {ev['schedule_note']})")
            else:
                ev["schedule_status"] = "free"
                ev["has_schedule_conflict"] = False
                ev["schedule_note"] = "Schedule checking disabled."
                logger.info(f"   • [{ev['id']}] {ev['title']} (Score: {ev['match_score']})")

        # Step 5: Wake up agent to synthesize proactive iMessage
        logger.info(f"⚡ Step 3: Waking up Tommy ({llama.model}) to compose proactive text with schedule awareness...")
        recommendation_pitch = generate_proactive_outreach(llama, profile, unnotified, user_id)

        full_message = f"{bot_prefix}{recommendation_pitch}".strip()

        # Step 6: Dispatch via iMessage to preferred thread
        dispatch_target = PREFERRED_IMESSAGE_TARGETS.get(user_id, user_id)
        logger.info(f"📲 Step 4: Dispatching recommendation to {dispatch_target}...")
        sent_success = send_message(target=dispatch_target, message=full_message, dry_run=dry_run)

        if sent_success:
            # Step 7: Record sent recommendations for both user_id and linked aliases
            linked = {user_id, dispatch_target}

            for ev in unnotified:
                for alias in linked:
                    store.record_recommendation(alias, ev["id"])
                logger.info(f"   Recorded event #{ev['id']} in sent_recommendations log for {linked}.")
            notifications_sent += 1
        else:
            logger.warning(f"   Failed to deliver iMessage to {dispatch_target}.")

    logger.info("==================================================")
    logger.info(f"🎉 Pipeline finished: {crawled_count} crawled, {notifications_sent} student(s) notified.")
    logger.info("==================================================")

    return {
        "status": "ok",
        "crawled": crawled_count,
        "notifications_sent": notifications_sent
    }


def main():
    parser = argparse.ArgumentParser(description="USC Campus Events Ingestion Pipeline & Proactive Recommender")
    parser.add_argument("--skip-crawl", action="store_true", help="Skip crawling USC events and only run recommendation wake-up.")
    parser.add_argument("--days", type=int, default=60, help="Number of upcoming days to crawl (default: 60).")
    parser.add_argument("--max-pages", type=int, default=3, help="Max calendar pages to fetch (default: 3).")
    parser.add_argument("--target-user", type=str, default="", help="Specific student contact to evaluate (e.g. '+12135550100' or 'student@usc.edu').")
    parser.add_argument("--max-recommend", type=int, default=2, help="Max events to recommend per student in this run (default: 2).")
    parser.add_argument("--min-similarity", type=float, default=0.48, help="Minimum matching score threshold (default: 0.48).")
    parser.add_argument("--dry-run", action="store_true", help="Simulate wake-up and sending without actually delivering iMessage.")
    parser.add_argument("--api-key", type=str, default="", help="Meta API key override.")
    parser.add_argument("--model", type=str, default="", help="LLM model ID override (defaults to muse-ember-1.0).")
    parser.add_argument("--bot-prefix", type=str, default="🤖 ", help="Prefix added to proactive bot messages.")
    parser.add_argument("--no-calendar", action="store_true", help="Disable checking student macOS Calendar.app availability.")
    parser.add_argument("--mock-calendar", action="store_true", help="Use mock student calendar schedule instead of live macOS Calendar.app.")

    args = parser.parse_args()

    run_pipeline(
        crawl=not args.skip_crawl,
        days=args.days,
        max_pages=args.max_pages,
        target_user=args.target_user or None,
        max_recommend=args.max_recommend,
        min_similarity=args.min_similarity,
        dry_run=args.dry_run,
        api_key=args.api_key or None,
        model=args.model or None,
        bot_prefix=args.bot_prefix,
        use_calendar=not args.no_calendar,
        mock_calendar=args.mock_calendar
    )


if __name__ == "__main__":
    main()
