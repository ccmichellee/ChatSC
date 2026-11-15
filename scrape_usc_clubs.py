import urllib.request
import re
import html
import time
import logging
from typing import List, Dict, Any, Set
from student_memory import MemoryStore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("club_scraper")

BASE_URL = "https://engage.usc.edu/club_signup"

TARGET_QUERIES = [
    # Targeted categories
    {"group_type": "86402"},  # Viterbi School of Engineering
    {"category_tags": "2178293"},  # Design Teams
    {"category_tags": "6551692"},  # Marshall Student Organizations
    {"category_tags": "6551774"},  # Career
    {"category_tags": "2178291"},  # Academic
    # High-signal interest search queries
    {"search": "AI"},
    {"search": "artificial intelligence"},
    {"search": "hackathon"},
    {"search": "hacksc"},
    {"search": "computer"},
    {"search": "software"},
    {"search": "robotics"},
    {"search": "data"},
    {"search": "machine learning"},
    {"search": "cybersecurity"},
    {"search": "product"},
    {"search": "design"},
    {"search": "consulting"},
    {"search": "finance"},
    {"search": "venture"},
    {"search": "startup"},
    {"search": "entrepreneur"},
    {"search": "incubator"},
    {"search": "makers"},
    {"search": "engineering"},
    {"search": "aerospace"},
    {"search": "biomedical"},
    {"search": "game development"},
    {"search": "cais"},
    {"search": "acm"},
    {"search": "lavalab"},
    {"search": "troylabs"},
]


def fetch_clubs_from_params(params: Dict[str, str]) -> List[Dict[str, Any]]:
    query_str = "&".join(f"{k}={urllib.parse.quote(v)}" for k, v in params.items())
    url = f"{BASE_URL}?{query_str}"
    
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            page = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return []

    clubs = []
    blocks = re.findall(
        r"<div class=\"row\" role=\"group\" aria-label=[\"\x27](.*?)[\"\x27]>([\s\S]*?)(?=<div class=\"row\" role=\"group\"|<div class=\"footer\"|\Z)",
        page
    )

    for raw_name, content in blocks:
        clean_name = html.unescape(raw_name).strip()
        # Clean up '( RSO )' or extra spaces
        clean_name = re.sub(r"\(\s*RSO\s*\)", "", clean_name).strip()

        # Category
        cm = re.search(r"<p class=\"h5 media-heading grey-element\">(.*?)</p>", content, re.DOTALL)
        cat = html.unescape(re.sub(r"<[^>]+>", " ", cm.group(1)).strip()) if cm else "Student Organization"
        cat = " ".join(cat.split())

        # Mission
        mm = re.search(r"<strong>Mission</strong><br\s*/?>\s*(.*?)</p>", content, re.DOTALL)
        mission = html.unescape(re.sub(r"<[^>]+>", " ", mm.group(1)).strip()) if mm else ""
        mission = " ".join(mission.split())

        # Membership Benefits
        bm = re.search(r"<strong>Membership Benefits</strong><br\s*/?>\s*(.*?)</p>", content, re.DOTALL)
        benefits = html.unescape(re.sub(r"<[^>]+>", " ", bm.group(1)).strip()) if bm else ""
        benefits = " ".join(benefits.split())

        # Website
        wm = re.search(r"href=[\"\x27]([^\"]+)[\"\x27][^>]*><span class=\"mdi mdi-web\">", content)
        website = wm.group(1).strip() if wm else ""

        # Compose full description
        desc_parts = []
        if mission and mission != "...":
            desc_parts.append(mission)
        if benefits and benefits != "...":
            desc_parts.append(f"Benefits: {benefits}")
        if website:
            desc_parts.append(f"Website: {website}")

        full_desc = " | ".join(desc_parts) if desc_parts else f"USC Registered Student Organization ({cat})."

        clubs.append({
            "name": clean_name,
            "category": cat,
            "description": full_desc,
            "meeting_times": "Check EngageSC / website for current semester schedules"
        })

    return clubs


def main():
    import urllib.parse
    store = MemoryStore()
    seen_names: Set[str] = set()
    total_added = 0

    logger.info("Starting EngageSC campus club crawler...")

    for i, params in enumerate(TARGET_QUERIES):
        query_desc = ", ".join(f"{k}={v}" for k, v in params.items())
        logger.info(f"[{i+1}/{len(TARGET_QUERIES)}] Querying EngageSC: {query_desc}")
        
        clubs = fetch_clubs_from_params(params)
        new_for_query = 0

        for c in clubs:
            name_key = c["name"].lower()
            if name_key in seen_names or not c["name"]:
                continue
            seen_names.add(name_key)

            store.add_club(
                name=c["name"],
                category=c["category"],
                description=c["description"],
                meeting_times=c["meeting_times"]
            )
            total_added += 1
            new_for_query += 1

        logger.info(f"   Found {len(clubs)} clubs ({new_for_query} new unique). Total unique so far: {total_added}")
        time.sleep(0.3)  # Polite crawling delay

    logger.info("==================================================")
    logger.info(f"🎉 Successfully crawled and indexed {total_added} unique USC clubs into memory.db!")
    logger.info("==================================================")


if __name__ == "__main__":
    main()
