import argparse
import datetime
import html
import json
import logging
import os
import re
import sys
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from student_memory import MemoryStore
from llm_client import LlamaClient

logger = logging.getLogger("crawl_instagram_events")

# Default curated list of USC student organizations active on Instagram
DEFAULT_USC_CLUBS = [
    "hackscofficial",        # HackSC
    "caisplusplus",          # CAIS++ (AI / Machine Learning)
    "ai.usc",                # AI@USC
    "usclavalab",            # LavaLab Product Incubator
    "usc_acm",               # Association for Computing Machinery
    "usc_shpe",              # Society of Hispanic Professional Engineers
    "uscscope",              # SCOPE Software Development
    "trojanmarketinggroup",  # Trojan Marketing Group
    "usc_viterbi",           # USC Viterbi School
]

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE = "https://graph.facebook.com"

FREE_FOOD_REGEX = re.compile(
    r"\b(free food|free lunch|free dinner|pizza|refreshments|boba|catered|catering|snacks|breakfast|sweetgreen|meal provided|tacos|ice cream|burrito|burritos|chick-fil-a|cava|donuts|coffee|food provided|lunch provided|dinner provided)\b",
    re.IGNORECASE
)

EVENT_INDICATOR_REGEX = re.compile(
    r"\b(workshop|info session|general meeting|gbm|mixer|hackathon|demo day|speaker|symposium|social|showcase|panel|networking|fireside chat|kickoff|rsvp|register|tickets|join us)\b",
    re.IGNORECASE
)

CAMPUS_LOCATIONS = [
    "TCC", "Tutor Campus Center", "SGM", "SAL", "Salvatori", "THH", "Taper Hall",
    "Ginsburg Hall", "RTH", "Ronald Tutor Hall", "LVL", "Leventhal", "DML", "Doheny",
    "VKC", "Von KleinSmid", "KAP", "Kaprielian", "Annenberg", "ANN", "Fertitta",
    "JFF", "USC Village", "McCarthy Quad", "Bovard Auditorium", "HSH", "Hedco"
]


def extract_event_from_caption_heuristic(
    caption: str,
    timestamp_str: str,
    permalink: str,
    club_handle: str
) -> Optional[Dict[str, Any]]:
    """
    Fast rule-based extraction fallback when an LLM is unavailable.
    Detects if an Instagram post describes an upcoming campus event.
    """
    clean_text = " ".join(caption.split())
    if not clean_text or not EVENT_INDICATOR_REGEX.search(clean_text):
        return None

    # Title extraction: take first non-empty line or first sentence
    lines = [line.strip() for line in caption.split("\n") if line.strip()]
    first_line = lines[0] if lines else "USC Club Event"
    # Clean emojis or hashtags from first line
    title_candidate = re.sub(r"[#@][\w]+", "", first_line).strip(" !.:-")
    title = f"@{club_handle}: {title_candidate[:60]}" if title_candidate else f"@{club_handle} Campus Event"

    # Date / Time extraction
    date_match = re.search(
        r"\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*@?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))?",
        clean_text,
        re.IGNORECASE
    )
    if date_match:
        date_str = date_match.group(0).strip()
    else:
        # Fallback to post timestamp date
        date_str = timestamp_str[:10] if timestamp_str else "Upcoming"

    # Location extraction
    location = "USC Campus"
    for loc in CAMPUS_LOCATIONS:
        if re.search(r"\b" + re.escape(loc) + r"\b", clean_text, re.IGNORECASE):
            location = loc
            break

    # Free food check
    has_free_food = bool(FREE_FOOD_REGEX.search(clean_text))

    # Tags
    tags = ["Instagram", f"@{club_handle}"]
    if has_free_food:
        tags.append("Free Food")
    if any(k in clean_text.lower() for k in ["hackathon", "hacksc", "hack"]):
        tags.append("Hackathon")
    if any(k in clean_text.lower() for k in ["ai", "machine learning", "tech"]):
        tags.append("AI/Tech")
    if any(k in clean_text.lower() for k in ["workshop", "gbm", "meeting"]):
        tags.append("Club Meeting")

    description = f"{clean_text[:280]}... [Instagram: {permalink}]"

    return {
        "title": title,
        "date_str": date_str,
        "location": location,
        "description": description,
        "has_free_food": has_free_food,
        "tags": tags,
        "permalink": permalink,
    }


def parse_instagram_event_with_llm(
    caption: str,
    timestamp_str: str,
    permalink: str,
    club_handle: str,
    llama_client: Optional[LlamaClient] = None
) -> Optional[Dict[str, Any]]:
    """
    Parses an Instagram post caption using Muse Ember (or rule-based fallback)
    to extract structured event metadata.
    """
    if not caption or len(caption.strip()) < 15:
        return None

    if not llama_client or not llama_client.is_configured():
        return extract_event_from_caption_heuristic(caption, timestamp_str, permalink, club_handle)

    prompt = (
        f"You are a structured data extraction engine for USC campus events.\n"
        f"Analyze the following Instagram caption from student organization @{club_handle} (posted on {timestamp_str}):\n\n"
        f"\"\"\"\n{caption}\n\"\"\"\n\n"
        f"Determine if this post is an announcement for an upcoming campus event, meeting, workshop, social, or hackathon.\n"
        f"If it is NOT an event (e.g. just a photo recap, meme, officer spotlight, or generic quote), reply with exactly: {{\"is_event\": false}}\n\n"
        f"If it IS an event, return a valid JSON object matching this schema:\n"
        f"{{\n"
        f"  \"is_event\": true,\n"
        f"  \"title\": \"Concise event title prefixed by club, e.g. @{club_handle}: Spring Kickoff\",\n"
        f"  \"date_str\": \"Human readable date & time, e.g. Thursday, Nov 20 @ 6:00 PM\",\n"
        f"  \"location\": \"Specific USC room/hall or 'USC Campus'\",\n"
        f"  \"description\": \"Clean 1-2 sentence summary of what attendees will do\",\n"
        f"  \"has_free_food\": true/false,\n"
        f"  \"tags\": [\"Instagram\", \"@{club_handle}\", \"Category Tags\"]\n"
        f"}}\n"
        f"Output ONLY raw JSON. No markdown backticks, no explanatory comments."
    )

    try:
        raw_output = llama_client.generate_reply(prompt, use_tools=False)
        # Strip potential markdown code fences
        clean_json = raw_output.strip()
        if clean_json.startswith("```"):
            clean_json = re.sub(r"^```(?:json)?\s*", "", clean_json)
            clean_json = re.sub(r"\s*```$", "", clean_json)

        data = json.loads(clean_json)
        if not data.get("is_event"):
            return None

        # Build final record
        title = data.get("title") or f"@{club_handle} Campus Event"
        date_str = data.get("date_str") or (timestamp_str[:10] if timestamp_str else "Upcoming")
        location = data.get("location") or "USC Campus"
        description = data.get("description") or caption[:200]
        if permalink and permalink not in description:
            description = f"{description} [Instagram: {permalink}]"
        has_free_food = bool(data.get("has_free_food", False)) or bool(FREE_FOOD_REGEX.search(caption))
        tags = data.get("tags") or ["Instagram", f"@{club_handle}"]

        return {
            "title": title,
            "date_str": date_str,
            "location": location,
            "description": description,
            "has_free_food": has_free_food,
            "tags": tags,
            "permalink": permalink,
        }
    except Exception as e:
        logger.warning(f"LLM event extraction failed for @{club_handle}: {e}. Falling back to heuristic.")
        return extract_event_from_caption_heuristic(caption, timestamp_str, permalink, club_handle)


def auto_resolve_instagram_business_account(
    account_id: Optional[str],
    access_token: str
) -> Optional[str]:
    """
    Attempts to automatically find and return the true Instagram Business Account ID (starts with 1784...)
    from the authenticated entity (/me), provided account_id, or connected Facebook Pages (/me/accounts).
    """
    if not access_token:
        return account_id

    # Check 1: Query /me (handles Page Access Tokens directly)
    url = f"{GRAPH_API_BASE}/{GRAPH_API_VERSION}/me?fields=id,name,instagram_business_account{{id,username}}&access_token={access_token}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            me_data = json.loads(resp.read().decode("utf-8"))
        ig_biz = me_data.get("instagram_business_account")
        if ig_biz and ig_biz.get("id"):
            resolved_id = str(ig_biz["id"])
            username = ig_biz.get("username", "unknown")
            logger.info(
                f"🔗 Auto-detected connected Instagram Business Account from Page '{me_data.get('name')}': "
                f"{resolved_id} (@{username})"
            )
            return resolved_id
    except Exception:
        pass

    # Check 2: If account_id provided, inspect if it is a Facebook Page linking to an Instagram Business account
    if account_id:
        url = f"{GRAPH_API_BASE}/{GRAPH_API_VERSION}/{account_id}?fields=id,name,instagram_business_account{{id,username}}&access_token={access_token}"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            ig_biz = data.get("instagram_business_account")
            if ig_biz and ig_biz.get("id"):
                resolved_id = str(ig_biz["id"])
                username = ig_biz.get("username", "unknown")
                logger.info(
                    f"🔗 Auto-resolved Facebook Page ID '{account_id}' to connected Instagram Business Account ID: {resolved_id} (@{username})"
                )
                return resolved_id
        except Exception:
            pass

    # Check 3: Look up user's managed Facebook Pages via /me/accounts (for User Access Tokens)
    url = f"{GRAPH_API_BASE}/{GRAPH_API_VERSION}/me/accounts?fields=id,name,instagram_business_account{{id,username}}&access_token={access_token}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        pages = data.get("data", [])
        for p in pages:
            ig_biz = p.get("instagram_business_account")
            if ig_biz and ig_biz.get("id"):
                resolved_id = str(ig_biz["id"])
                username = ig_biz.get("username", "unknown")
                logger.info(
                    f"🔗 Auto-detected connected Instagram Business Account from Page '{p.get('name')}': {resolved_id} (@{username})"
                )
                return resolved_id
    except Exception as e:
        logger.debug(f"Could not auto-resolve from /me/accounts: {e}")

    return account_id


def diagnose_instagram_setup(
    account_id: Optional[str] = None,
    access_token: Optional[str] = None
) -> None:
    """
    Diagnostic tool to inspect Meta access token and help identify the
    exact Instagram Business Account ID and necessary permissions.
    """
    account_id = account_id or os.environ.get("INSTAGRAM_ACCOUNT_ID")
    access_token = access_token or os.environ.get("INSTAGRAM_ACCESS_TOKEN")

    print("\n🔍 Meta / Instagram Graph API Configuration Diagnostics")
    print("=" * 65)

    if not access_token:
        print("❌ INSTAGRAM_ACCESS_TOKEN is NOT set.")
        print("   Set it with: export INSTAGRAM_ACCESS_TOKEN=\"your_token\"")
        print("=" * 65 + "\n")
        return

    print(f"✅ Access Token present (starts with {access_token[:10]}...)")
    print(f"ℹ️ Currently configured INSTAGRAM_ACCOUNT_ID: {account_id or '(none)'}\n")

    # 1. Query /me
    is_page_token = False
    try:
        url = f"{GRAPH_API_BASE}/{GRAPH_API_VERSION}/me?fields=id,name,instagram_business_account{{id,username}}&access_token={access_token}"
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            me_data = json.loads(resp.read().decode("utf-8"))
        entity_name = me_data.get('name')
        entity_id = me_data.get('id')
        print(f"👤 Authenticated Entity: {entity_name} (ID: {entity_id})")

        ig_biz = me_data.get("instagram_business_account")
        if ig_biz:
            ig_id = ig_biz.get("id")
            ig_user = ig_biz.get("username")
            print(f"   👉 Connected Instagram Business Account: @{ig_user} (ID: {ig_id})")
            print(f"   🎯 FIX: Run the following in your terminal:")
            print(f"      export INSTAGRAM_ACCOUNT_ID=\"{ig_id}\"\n")
            print("=" * 65 + "\n")
            return
        else:
            print("   ℹ️ This token belongs to Facebook Page / Entity: " + str(entity_name))
            is_page_token = True
    except urllib.error.HTTPError as e:
        print(f"❌ Failed to query /me (HTTP {e.code}): {e.read().decode('utf-8', errors='ignore')}")
        print("=" * 65 + "\n")
        return
    except Exception as e:
        print(f"❌ Network error querying /me: {e}")
        print("=" * 65 + "\n")
        return

    # 2. If it's a User token, query /me/accounts (Facebook Pages)
    if not is_page_token:
        try:
            url = f"{GRAPH_API_BASE}/{GRAPH_API_VERSION}/me/accounts?fields=id,name,instagram_business_account{{id,username}}&access_token={access_token}"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                pages_data = json.loads(resp.read().decode("utf-8"))
            pages = pages_data.get("data", [])
            print(f"📄 Facebook Pages found: {len(pages)}")

            for p in pages:
                p_name = p.get("name")
                p_id = p.get("id")
                ig_biz = p.get("instagram_business_account")
                if ig_biz:
                    ig_id = ig_biz.get("id")
                    ig_user = ig_biz.get("username")
                    print(f"   • Page: '{p_name}' (ID: {p_id})")
                    print(f"     👉 Linked Instagram Business Account: @{ig_user} (ID: {ig_id})")
                    print(f"     🎯 FIX: Run the following in your terminal:")
                    print(f"        export INSTAGRAM_ACCOUNT_ID=\"{ig_id}\"\n")
                    print("=" * 65 + "\n")
                    return
                else:
                    print(f"   • Page: '{p_name}' (ID: {p_id}) -> No Instagram account connected.")
        except Exception:
            pass

    # 3. Check current account_id if set
    if account_id:
        print(f"\n🔎 Testing current INSTAGRAM_ACCOUNT_ID '{account_id}':")
        try:
            url = f"{GRAPH_API_BASE}/{GRAPH_API_VERSION}/{account_id}?fields=id,name,username,instagram_business_account{{id,username}}&access_token={access_token}"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                node_data = json.loads(resp.read().decode("utf-8"))

            ig_biz = node_data.get("instagram_business_account")
            if ig_biz:
                ig_id = ig_biz.get("id")
                ig_user = ig_biz.get("username")
                print(f"   👉 Node '{node_data.get('name')}' has linked Instagram Account: @{ig_user} (ID: {ig_id})")
                print(f"   🎯 FIX: Run the following in your terminal:")
                print(f"      export INSTAGRAM_ACCOUNT_ID=\"{ig_id}\"\n")
                print("=" * 65 + "\n")
                return
            elif "username" in node_data:
                print(f"   ✅ Node is already a valid Instagram User node: @{node_data.get('username')}")
            else:
                print(f"   ⚠️ Node '{node_data.get('name')}' (ID: {account_id}) is a Facebook Page, but has no Instagram account linked.")
        except urllib.error.HTTPError as e:
            print(f"   ❌ Node query failed (HTTP {e.code}): {e.read().decode('utf-8', errors='ignore')}")
        except Exception as e:
            print(f"   ❌ Node query error: {e}")

    # Instructions for linking
    print("\n⚠️ Why this causes error #100:")
    print("   Meta's 'business_discovery' API can ONLY be queried from an Instagram Professional Account node (starts with 1784...).")
    print(f"   Your Facebook Page '{entity_name}' does not have an Instagram Business account connected yet.\n")
    print("   📋 How to link your Instagram account to your Facebook Page:")
    print("   1. In your mobile Instagram app:")
    print("      • Go to Settings > 'Account type and tools' > 'Switch to professional account' (Creator or Business - free).")
    print("   2. In your Facebook Page:")
    print("      • Go to Facebook > your Page 'Chatsc' > Settings > 'Linked Accounts' > 'Instagram'.")
    print("      • Click 'Connect Account' and log into your professional Instagram account.")
    print("   3. Once connected, re-run:")
    print("      python3 crawl_instagram_events.py --diagnose")
    print("      (It will immediately print your new Instagram ID to export!)")
    print("=" * 65 + "\n")


def fetch_business_discovery_posts(
    club_handle: str,
    account_id: str,
    access_token: str,
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Queries Meta's Instagram Graph API Business Discovery endpoint for a target public business account.
    """
    fields = (
        f"business_discovery.username({club_handle}){{"
        f"name,username,biography,website,"
        f"media.limit({limit}){{id,caption,media_type,permalink,timestamp,media_url}}"
        f"}}"
    )
    query_params = urllib.parse.urlencode({
        "fields": fields,
        "access_token": access_token
    })
    url = f"{GRAPH_API_BASE}/{GRAPH_API_VERSION}/{account_id}?{query_params}"

    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ChatSC-EventCrawler/1.0",
            "Accept": "application/json"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        biz = data.get("business_discovery", {})
        media_obj = biz.get("media", {})
        return media_obj.get("data", [])
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        if "Tried accessing nonexisting field (business_discovery)" in err_msg:
            logger.error(
                f"❌ Instagram Graph API Error (#100) for @{club_handle}: "
                f"The provided account ID '{account_id}' is NOT an Instagram Business Account ID. "
                f"Run 'python3 crawl_instagram_events.py --diagnose' to locate your true Instagram ID."
            )
        else:
            logger.error(f"Instagram Graph API error for @{club_handle} (HTTP {e.code}): {err_msg}")
        return []
    except Exception as e:
        logger.error(f"Network error querying Instagram Business Discovery for @{club_handle}: {e}")
        return []


def get_mock_instagram_posts() -> Dict[str, List[Dict[str, Any]]]:
    """Provides high-fidelity mock Instagram posts from USC clubs for testing and local verification."""
    return {
        "hackscofficial": [
            {
                "id": "ig_mock_1",
                "caption": "⚡️ HACKSC 2026 OFFICIAL KICKOFF! ⚡️\nReady to build the future of AI agents? Join us this Friday at 6:00 PM in Ginsburg Hall (GTH 101) for our opening ceremony, team matching, and free Sweetgreen dinner for all registered hackers! 🥗💻 RSVP link in bio!",
                "timestamp": datetime.datetime.now().isoformat(),
                "permalink": "https://www.instagram.com/p/mock_hacksc_1/",
                "media_type": "IMAGE"
            },
            {
                "id": "ig_mock_2",
                "caption": "Throwback to our amazing organizing team retreat! So pumped for next semester ✌️❤️ #HackSC #Trojans",
                "timestamp": datetime.datetime.now().isoformat(),
                "permalink": "https://www.instagram.com/p/mock_hacksc_recap/",
                "media_type": "IMAGE"
            }
        ],
        "caisplusplus": [
            {
                "id": "ig_mock_3",
                "caption": "🤖 CAIS++ Workshop: Deep Dive into Multi-Agent Workflows & LLM Fine-Tuning!\nJoin us Tuesday, Nov 18 @ 7:00 PM in Ronald Tutor Hall (RTH 105). We will have hands-on GPU labs and hot pizza provided! 🍕 Open to all USC undergraduate and graduate students.",
                "timestamp": datetime.datetime.now().isoformat(),
                "permalink": "https://www.instagram.com/p/mock_cais_1/",
                "media_type": "IMAGE"
            }
        ],
        "usclavalab": [
            {
                "id": "ig_mock_4",
                "caption": "🚀 LavaLab Fall Cohort Demo Day!\n10 student startups taking the stage to pitch to top Silicon Beach and VC investors. Thursday at 7:30 PM in Bovard Auditorium. Catered reception with refreshments and appetizers after the pitches! 🥂",
                "timestamp": datetime.datetime.now().isoformat(),
                "permalink": "https://www.instagram.com/p/mock_lavalab_1/",
                "media_type": "IMAGE"
            }
        ],
        "usc_acm": [
            {
                "id": "ig_mock_5",
                "caption": "🎮 ACM Fall Game Night & Board Games Mixer!\nTake a break from midterm crunch. Wednesday at 8:00 PM in Salvatori Computer Science Center (SAL 126). Free boba drinks for the first 50 attendees! 🧋",
                "timestamp": datetime.datetime.now().isoformat(),
                "permalink": "https://www.instagram.com/p/mock_acm_1/",
                "media_type": "IMAGE"
            }
        ]
    }


def crawl_instagram_events(
    clubs: Optional[List[str]] = None,
    account_id: Optional[str] = None,
    access_token: Optional[str] = None,
    store: Optional[MemoryStore] = None,
    days_limit: int = 14,
    dry_run: bool = False,
    mock: bool = False,
    llama_client: Optional[LlamaClient] = None
) -> int:
    """
    Crawls recent posts from USC club Instagram business accounts,
    filters and parses event posts, and indexes them into memory.db.
    """
    if store is None and not dry_run:
        store = MemoryStore()

    target_clubs = clubs if clubs else DEFAULT_USC_CLUBS
    account_id = account_id or os.environ.get("INSTAGRAM_ACCOUNT_ID")
    access_token = access_token or os.environ.get("INSTAGRAM_ACCESS_TOKEN")

    if access_token and not mock:
        account_id = auto_resolve_instagram_business_account(account_id, access_token)

    logger.info(f"📸 Checking Instagram event feeds for {len(target_clubs)} campus clubs...")

    has_credentials = bool(account_id and access_token)
    if not has_credentials and not mock:
        logger.warning(
            "⚠️ INSTAGRAM_ACCOUNT_ID or INSTAGRAM_ACCESS_TOKEN not detected in environment.\n"
            "   To enable live Meta Graph API crawling, set:\n"
            "     export INSTAGRAM_ACCOUNT_ID=\"your_ig_user_id\"\n"
            "     export INSTAGRAM_ACCESS_TOKEN=\"your_meta_user_token\"\n"
            "   (Running in mock mode for testing demonstration.)"
        )
        mock = True

    if llama_client is None:
        llama_client = LlamaClient()

    total_indexed = 0
    mock_data = get_mock_instagram_posts() if mock else {}

    for club in target_clubs:
        logger.info(f"   Analyzing @{club}...")
        if mock:
            posts = mock_data.get(club, [])
        else:
            posts = fetch_business_discovery_posts(club, account_id, access_token, limit=5)

        for post in posts:
            caption = post.get("caption", "")
            timestamp = post.get("timestamp", "")
            permalink = post.get("permalink", f"https://instagram.com/{club}")

            event_data = parse_instagram_event_with_llm(
                caption=caption,
                timestamp_str=timestamp,
                permalink=permalink,
                club_handle=club,
                llama_client=llama_client
            )

            if not event_data:
                continue

            logger.info(f"   ✨ Detected Event: {event_data['title']} ({event_data['date_str']} @ {event_data['location']})")
            if dry_run:
                logger.info(f"      [DRY-RUN] Would index: {event_data['title']}")
                total_indexed += 1
            else:
                store.upsert_event(
                    title=event_data["title"],
                    date_str=event_data["date_str"],
                    location=event_data["location"],
                    description=event_data["description"],
                    has_free_food=event_data["has_free_food"],
                    tags=event_data["tags"]
                )
                total_indexed += 1

    logger.info(f"📸 Instagram Event Crawl Complete: {total_indexed} event(s) processed.")
    return total_indexed


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest USC campus club events from Instagram via Meta Graph API.")
    parser.add_argument("--clubs", type=str, default="", help="Comma-separated club handles (e.g. 'hackscofficial,caisplusplus').")
    parser.add_argument("--account-id", type=str, default="", help="Instagram Professional Account ID.")
    parser.add_argument("--access-token", type=str, default="", help="Meta User / System Access Token.")
    parser.add_argument("--mock", action="store_true", help="Run with mock data to test parsing & indexing.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and log without committing to memory.db.")
    parser.add_argument("--diagnose", action="store_true", help="Inspect Meta token and report connected Facebook Pages and Instagram Business Account IDs.")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if args.diagnose:
        diagnose_instagram_setup(
            account_id=args.account_id or None,
            access_token=args.access_token or None
        )
        sys.exit(0)

    club_list = [c.strip().lstrip("@") for c in args.clubs.split(",") if c.strip()] if args.clubs else None
    crawl_instagram_events(
        clubs=club_list,
        account_id=args.account_id or None,
        access_token=args.access_token or None,
        mock=args.mock,
        dry_run=args.dry_run
    )
