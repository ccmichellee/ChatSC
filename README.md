# Local iMessage Chatbot Proof-of-Concept (POC)

A lightweight, zero-dependency Python bot that receives and responds to native iMessages directly on macOS. Configured as an AI assistant ("Tommy") to help USC students navigate campus clubs, hackathons (like HackSC), career fairs, and Trojan events.

---

## Architecture Overview

```
[Student iPhone] ──(iMessage)──► [Mac Messages.app] ──► [~/Library/Messages/chat.db]
                                                                  │
                                                          (imessage_reader.py)
                                                                  ▼
                                                      [bot.py: Agentic Loop]
                                                                  │
                                    ┌─────────────────────────────┼─────────────────────────────┐
                                    ▼                             ▼                             ▼
                          [student_memory.py]               [llm_client.py]                [tools.py]
                           Embedded Vector DB                 Muse Ember            Context-Aware Search
                           (memory.db SQLite)            Multi-hop Reasoning         Events, Clubs, Profile
                                    │                             │                             │
                                    └─────────────────────────────┼─────────────────────────────┘
                                                                  │
                                                          (imessage_sender.py)
                                                                  ▼
                                                          [Mac Messages.app] ──► [Student iPhone]
```

### Components:
- **`student_memory.py`**: Embedded SQLite Vector Store (`memory.db`) with native cosine similarity. Stores student profile context, campus events, and clubs.
- **`tools.py`**: Semantic search tools (`search_campus_events`, `search_campus_clubs`, `get_student_profile`) available to the agent.
- **`seed_memory.py`**: Populates the vector store with real USC events (like AI@USC with Sweetgreen dinner, HackSC) and clubs (CAIS++, LavaLab, ACM, TroyLabs).
- **`llm_client.py`**: Muse Ember agentic tool-calling loop. Injects student profile, executes tool calls autonomously, and synthesizes concise iMessage replies.
- **`imessage_reader.py`**: Reads incoming messages safely with zero leaks.
- **`imessage_sender.py`**: Sends replies via AppleScript.
- **`bot.py`**: Main application loop with multi-layer safety isolation.

---

## Quick Start

### 1. Run in Dry-Run Mode (Safe Verification)
Simulate receiving messages without actually sending outbound iMessages:
```bash
python3 bot.py --dry-run
```

### 2. Run with Whitelist (Recommended for Testing)
Only reply to your own phone number or specific test contact:
```bash
python3 bot.py --whitelist "+1XXXXXXXXXX"
```

### 3. Run with Trigger Prefix
Only respond when a message starts with `!bot`:
```bash
python3 bot.py --trigger "!bot"
```

### 4. Run Live (Open to All New Messages)
```bash
python3 bot.py
```

---

## macOS Permissions Checklist

This POC relies on two standard macOS permissions:
1. **Full Disk Access**: Required to read `~/Library/Messages/chat.db`.
   - *System Settings > Privacy & Security > Full Disk Access > Enable for Terminal / IDE*.
2. **Automation Permission**: Required to allow `osascript` to control Messages.app.
   - *System Settings > Privacy & Security > Automation > Enable Messages for Terminal / IDE*.

---

## Running with Meta's Llama API

1. **Set your API Key**:
   ```bash
   export LLAMA_API_KEY="your_meta_llama_api_key_here"
   ```
   *(Or pass `--api-key "your_key"` directly on the command line)*

2. **Start the Bot (Safely isolated to your number & email)**:
   ```bash
   python3 bot.py --allow-self --whitelist "+12135550100,student@usc.edu"
   ```
   *Default model is automatically set to **`muse-ember-1.0`** (Muse Ember, privacy-preserving tier).*

3. **Optional Model Override**:
   If you ever want to switch to a different model:
   ```bash
   python3 bot.py --allow-self --whitelist "+12135550100,student@usc.edu" --model "Llama-3.3-70B-Instruct"
   ```

4. **Test Commands**:
   - `ping` → Instant `Pong! 🏓` health check
   - `help` → Displays instructions
   - Any other prompt (e.g., *"What are 3 quick tips for a hackathon?"*) → Answered by Meta Llama!

---

## Proactive Event Ingestion Pipeline & Cron Wake-up

The system includes an automated event pipeline (`pipeline_events.py`) that crawls USC events, updates the vector database, and wakes up Tommy to proactively text relevant events to students without waiting for them to ask.

### Architecture

```
[Cron / Schedule Trigger]
           │
           ▼
[crawl_usc_events.py] ──(Crawls calendar.usc.edu + engage.usc.edu)──► [memory.db: campus_events]
                                                              │
                                                      (Vector & Signal Match)
                                                              ▼
                                                   [student_profiles & Dedup]
                                                              │
                                                        (Matches Found)
                                                              ▼
                                                [llm_client.py: Tommy Wake-Up]
                                                              │
                                                        (1-2 sentence text)
                                                              ▼
                                                    [imessage_sender.py]
                                                              │
                                                              ▼
                                                   [Student iPhone via iMessage]
                                                              │
                                                              ▼
                                                [sent_recommendations: Dedup Log]
```

### 1. Run Pipeline Manually (Dry-Run Mode)
```bash
python3 pipeline_events.py --dry-run --target-user "+12135550100"
```

### 2. Run Pipeline Live (Crawl + Proactive Recommend)
```bash
python3 pipeline_events.py --days 60 --target-user "+12135550100"
```

### 3. Setting up Recurring Cron Schedule (macOS Crontab)
To run the crawler and proactive wake-up every day at 9:00 AM:
```bash
crontab -e
```
Add the following line (replace with your absolute Python and repo paths):
```cron
0 9 * * * cd /path/to/ChatSC && python3 pipeline_events.py >> /path/to/ChatSC/pipeline.log 2>&1
```

### Anti-Spam Gating Policy:
- **Deduplication**: Recommended events are stored in `sent_recommendations (phone_or_email, event_id)` and are strictly never re-sent.
- **Signal Relevance**: Only events matching student coursework (e.g. `CS 572`), clubs (`AI@USC`, `HackSC`), or core interests (`Autonomous Agents`, `AI`, `Hackathons`, `Free Food`) are selected.
- **Throttling**: Limited to 1-2 top events per wake-up cycle.


