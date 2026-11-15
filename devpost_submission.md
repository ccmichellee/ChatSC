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

## Architecture & Tech Stack

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

### 1. Zero-Install Interface: Native macOS iMessage Bridge
- **Ingestion (`imessage_reader.py`)**: Interrogates `~/Library/Messages/chat.db` in read-only URI mode (`file:...mode=ro`) to eliminate database locks. Decodes macOS Sonoma+ binary `NSAttributedString` typedstream blobs in real time.
- **Dispatch (`imessage_sender.py`)**: Uses targeted AppleScript compilation via `osascript` to deliver conversational bubbles back to the student's iPhone.
- **Privacy & Isolation Guardrails**: A multi-tiered filter strictly rejects non-whitelisted senders, automated 2FA shortcodes, and group chats (`any;+;`), preventing cross-chat leaks.

### 2. Agent Core: Meta Muse Ember & Autonomous Tool Loop
- **Model**: `muse-ember-1.0` (Meta Muse Ember), selected for low-latency reasoning and strict privacy compliance (zero retention for model retraining).
- **Autonomous Execution Loop (`llm_client.py`)**: Implements an agentic function-calling loop. When a student texts Tommy, the model inspects memory context, invokes custom tools (`search_campus_events`, `search_campus_clubs`, `check_student_calendar`), evaluates returns, and synthesizes concise, 1–3 sentence texts with Trojan personality.
- **Proactive Wake-Up (`pipeline_events.py`)**: Runs autonomously on schedule triggers. Instead of waiting for queries, Tommy scouts fresh events, checks student calendar openings, and sends proactive outreach texts before opportunities pass.

### 3. Embedded Vector Database & Hybrid Search Engine
- **Storage (`student_memory.py`)**: A zero-dependency, self-contained embedded SQLite vector store (`memory.db`).
- **Semantic Embeddings**: Uses deterministic sub-word n-gram hashing and token frequency with L2 unit normalization.
- **In-Database Vector Similarity**: Registers a custom C-level cosine similarity function directly into the SQLite connection (`cosine_sim(embedding, ?)`), allowing real-time vector ranking directly inside SQL queries.
- **Hybrid Ranking**: Blends semantic similarity with BM25 keyword root matching, Viterbi engineering boosts, and conversational stopword pruning so tech students get premier clubs (**CAIS++**, **LavaLab**, **ACM**, **TroyLabs**) rather than generic campus clubs.
- **Anti-Spam Dedup**: Tracks sent recommendations in a relational `sent_recommendations` table to prevent repeat notifications.

### 4. Real-Time Schedule Intelligence & Conflict Engine
- **macOS Calendar Sync (`calendar_reader.py`)**: Bridges directly to macOS `Calendar.app` via AppleScript, reading student class schedules and personal appointments without requiring external OAuth credentials.
- **Recurrence Series Expansion**: Solves a core AppleScript limitation (where recurring event series are hidden by initial start dates) by expanding recurring course schedules (`CSCI 402`, `CSCI 591`, `CSCI 572`) dynamically across the target window.
- **Timezone Normalization**: Automatically calculates system offsets and normalizes all events into Los Angeles Pacific Time (PST / UTC-8).
- **Academic Holiday Engine**: Built-in awareness of official USC academic calendar breaks (e.g., Thanksgiving Break, Black Friday campus closures) to suppress non-existent class conflicts.
- **Interval Overlap Resolver**: Executes mathematical interval collision checking (`max(start1, start2) < min(end1, end2)`) to give students instant heads-ups when talks overlap with class.

### 5. Multi-Source Campus Event Aggregation
- **Handshake Pipeline (`crawl_handshake_events.py`)**: Ingests employer tech talks (Google, Meta, AWS, Citadel) and engineering career fairs via RFC 5545 iCalendar (`.ics`) feed parsing and authenticated session API scraping.
- **EngageSC Scraper (`crawl_usc_events.py`)**: Crawls USC’s CampusGroups mobile endpoints for club activities, speaker sessions, and workshops.
- **USC Calendar API**: Pulls university-wide symposiums, guest lectures, and campus department events.
- **Free Food Detection Engine**: Employs regex pattern matching across all feeds to flag catered lunches, Sweetgreen buffets, boba socials, and pizza nights.
