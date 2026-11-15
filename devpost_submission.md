# Devpost Submission — ChatSC (Tommy)

## Built With
`Python 3`, `Meta Muse Ember`, `macOS iMessage`, `AppleScript`, `SQLite`, `Vector Search`, `Handshake API`, `EngageSC`, `USC Calendar API`, `iCalendar (RFC 5545)`

---

## What It Does
**ChatSC (Tommy)** is a personalized, schedule-aware campus AI copilot that lives directly in native Apple iMessage. Instead of forcing students to manually search separate university portals (EngageSC for clubs, Handshake for recruiting, and school calendars for events), Tommy:
1. **Aggregates Campus Life**: Continuously ingests opportunities across EngageSC, Handshake employer sessions (Google, Meta, Citadel, AWS), and university calendars.
2. **Reaches Out Proactively**: Doesn't wait for students to ask — evaluates schedule openings and texts personalized opportunities before they fill up.
3. **Knows Your Schedule & Avoids Conflicts**: Directly reads macOS `Calendar.app` to recognize class blocks (`CSCI 402`, `CSCI 591`, `CSCI 572`), academic calendar holidays (Thanksgiving break closures), and personal appointments, giving soft conflict warnings when events overlap.
4. **Tailors Recommendations to Your Goals**: Recommends premier student organizations (**CAIS++**, **LavaLab**, **ACM at USC**, **TroyLabs**) matching the student's exact coursework, interests, and career ambitions.

---

## How We Built It

```
                      ┌───────────────────────────────────────────────┐
                      │              STUDENT (iPhone / Mac)           │
                      └───────────────────────┬───────────────────────┘
                                              │ Native iMessage
                                              ▼
                      ┌───────────────────────────────────────────────┐
                      │         macOS Messages.app (chat.db)          │
                      └───────┬───────────────────────────────▲───────┘
                              │ Read-only URI                 │ AppleScript
                        (imessage_reader.py)            (imessage_sender.py)
                              │                               │
                              ▼                               │
                      ┌───────────────────────────────────────┴───────┐
                      │              bot.py : AGENT ENGINE            │
                      │   • Dual-mode: Proactive & Conversational     │
                      │   • Multi-layer whitelist & privacy guards    │
                      └───────┬───────────────────────────────▲───────┘
                              │ Multi-hop Tool Calls          │
                              ▼                               │
                      ┌───────────────────────────────────────┴───────┐
                      │           llm_client.py : MUSE EMBER          │
                      │   • Privacy-preserving (zero data retention)  │
                      │   • Autonomous tool execution loop            │
                      └───────┬───────────────┬───────────────▲───────┘
                              │               │               │
            ┌─────────────────┴────┐   ┌──────┴────────┐   ┌──┴────────────────┐
            ▼                      ▼   ▼               ▼   ▼                   ▼
    [student_memory.py]        [calendar_reader.py]    [Data Crawlers]
    • Embedded SQLite Vector   • macOS Calendar.app    • EngageSC (CampusGroups)
    • Deterministic embeddings • PST Timezone engine   • USC Calendar API
    • Hybrid ranking (BM25+vec)• Conflict intervals    • Handshake (.ics & API)
    • Sent dedup tracking      • Academic holidays
```

We built ChatSC as a zero-install, privacy-first personal agent running locally on macOS:

- **Native iMessage Interface (`imessage_reader.py`, `imessage_sender.py`)**: Interrogates macOS `chat.db` in read-only URI mode (`file:...mode=ro`) to parse incoming texts in real time without database locks. Replies dispatch via compiled AppleScript (`osascript`) so students interact through their existing Messages app with zero setup.
- **Agent Core & Proactive Loop (`bot.py`, `llm_client.py`)**: Powered by Meta Muse Ember (`muse-ember-1.0`) in an autonomous tool loop. Tommy can query events, inspect schedules, search clubs, and proactively text students about high-value opportunities before they fill up.
- **Embedded SQLite Vector DB (`student_memory.py`)**: A zero-dependency SQLite store with a custom in-process C cosine similarity function and deterministic n-gram hashing. Blends vector semantic search with BM25 keyword matching and domain boosts so queries surface top student orgs (**CAIS++**, **LavaLab**, **ACM**, **TroyLabs**) rather than generic campus clubs.
- **macOS Calendar & Holiday Engine (`calendar_reader.py`)**: Syncs with local `Calendar.app` via AppleScript (no external OAuth needed). It expands recurring course series (`CSCI 402`, `CSCI 591`), normalizes timezones to Los Angeles Pacific Time, suppresses false conflicts during USC breaks (e.g., Thanksgiving), and flags event overlaps with interval math.
- **Multi-Source Campus Pipelines (`crawl_handshake_events.py`, `pipeline_events.py`)**: Crawls Handshake tech talks (Google, Meta, Citadel) via RFC 5545 `.ics` feeds and APIs, scrapes EngageSC student orgs, and parses the USC Calendar API, automatically tagging free food and career perks.
