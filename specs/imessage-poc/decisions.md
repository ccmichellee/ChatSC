# Architectural & Design Decisions

## Decision 1: Initial Chatbot Backend & Response Strategy

- **Date**: 2026-11-14
- **Decision**: Start with an Echo / Rule-based test backend before integrating an LLM.
- **Context**: The user wants to build a local proof-of-concept (Option 1: Direct Python + AppleScript + `chat.db` monitoring). Prior to selecting or configuring third-party LLM providers or local model weights, we must verify that macOS Full Disk Access permissions (for SQLite access) and Automation / AppleScript permissions (for sending iMessages) work seamlessly.
- **Next Steps**: Once the bidirectional iMessage bridge is confirmed working with the echo test, prompt to select the desired LLM provider (Ollama, OpenAI, Claude, Gemini, etc.).

## Decision 2: Conversation Isolation & Anti-Leak Safety Policy

- **Date**: 2026-11-14
- **Decision**: Strict Chat Isolation & Whitelist Enforcement.
- **Rules Enforced**:
  1. The bot is locked strictly to explicitly whitelisted chat identifiers / contacts (e.g. `+12135550100` or `student@usc.edu`).
  2. Both `msg["sender"]` and `msg["chat_identifier"]` must belong to the whitelist. If the user messages another contact (e.g. friend, family, coworker), the bot will completely ignore the message even with `--allow-self` enabled.
  3. Automatic Group Chat Block: Any chat with group format (`any;+;` or multiple participants) is strictly blocked.
  4. Automatic Shortcode Block: Automated SMS shortcodes (5-6 digit services like 2FA codes) are automatically rejected.
  5. Fail-Safe: In live mode, running without an explicit whitelist or target chat is blocked to prevent accidental public replies.

## Decision 3: LLM Provider Selection - Meta Llama API

- **Date**: 2026-11-14
- **Decision**: Integrate Meta's Llama API as the LLM backend.
- **Specification**:
  - Endpoint: `https://api.llama.com/v1` (OpenAI-compatible chat completions standard `/chat/completions`).
  - Auth: `LLAMA_API_KEY` or `META_API_KEY` passed via environment variable or `.env`.
  - Fallback/Flexibility: Zero external dependencies using Python's standard `urllib.request` with configurable model ID (defaulting to latest available Llama instruction model, e.g. `Llama-3.3-70B-Instruct` or user-specified).
  - Short persona prompt for iMessage: Concise, conversational, natural texts (no bloated AI essay formatting, optimized for SMS/iMessage).

## Decision 4: Model Tier Selection - Muse Spark 1.3 Contributor

- **Date**: 2026-11-14
- **Decision**: Set the active LLM model to `muse-spark-1.3-contributor` (Meta's Muse Spark 1.3 Contributor tier).
- **Approved by User**: Explicit user request ("can you set the model to 'Muse Spark 1.3 Contributor' ?").
- **Specification**:
  - Model ID: `muse-spark-1.3-contributor` (with fallback mapping from `"Muse Spark 1.3 Contributor"`).
  - Characteristics: Multi-step reasoning and cost efficiency via contributor tier.

## Decision 5: Persona & System Prompt - USC Opportunities Navigator

- **Date**: 2026-11-14
- **Decision**: Configure the system prompt to establish a specialized USC campus opportunities assistant persona ("Tommy").
- **Persona Directives**:
  - Helps USC students navigate clubs (RSOs), hackathons (HackSC), workshops, career fairs, and campus events.
  - Keeps responses concise (1-3 sentences max) tailored for rapid reading over iMessage.
  - Enthusiastic Trojan tone with natural 'Fight On!' or ✌️ expressions when relevant.
  - Avoids markdown headers or robotic AI formatting.
  - Supports runtime overrides via `--system-prompt` or `LLAMA_SYSTEM_PROMPT`.

## Decision 6: Student Memory & Vector Store - Embedded Vector DB (SQLite-Vector)

- **Date**: 2026-11-14
- **Decision**: Implement an Embedded Semantic / Vector Database (`memory.db`) using SQLite with binary vector embeddings and cosine similarity scoring.
- **Approved by User**: Selected "Embedded Vector / Semantic DB (e.g., ChromaDB / sqlite-vec)" via decision prompt.
- **Specification**:
  - Storage file: `memory.db` (local SQLite database).
  - Schema:
    - `student_profiles`: `phone_or_email` (PK), `name`, `major`, `school`, `year`, `interests_json`, `raw_bio`, `embedding` (BLOB), `updated_at`.
    - `campus_events`: `id` (PK), `title`, `description`, `date_str`, `location`, `tags_json`, `has_free_food`, `embedding` (BLOB).
    - `campus_clubs`: `id` (PK), `name`, `category`, `description`, `tags_json`, `embedding` (BLOB).
  - Semantic Matching: Cosine similarity vector search function registered directly into SQLite (`cosine_sim(embedding, query_vector)`).
  - Embeddings Engine: Local `nomic-embed-text` (or API fallback) to convert student interests and event descriptions into semantic vector space.

## Decision 7: Model Tier Switch - Muse Ember (Privacy-Preserving)

- **Date**: 2026-11-14
- **Decision**: Switch default model from `muse-spark-1.3-contributor` to `muse-ember-1.0` (Muse Ember).
- **Rationale**: The user requested switching models because the "Contributor" tier opts in to data-sharing for model training. Muse Ember (`muse-ember-1.0`) provides full privacy without training data retention, along with lower latency for real-time iMessage interactions.
- **Specification**:
  - Model ID: `muse-ember-1.0` (with alias resolution for `"Muse Ember"`).
  - API Endpoint: `https://api.meta.ai/v1/chat/completions`.
  - Tool Calling: Fully verified and active.

## Decision 8: Campus Club Crawling & Vector Store Ingestion (EngageSC)

- **Date**: 2026-11-14
- **Decision**: Populate `campus_clubs` directly from USC's official student organization directory (EngageSC / CampusGroups) via automated scraping and vector embedding.
- **Specification**:
  - Source: `https://engage.usc.edu/club_signup`
  - Extraction Fields: Organization Name, Category (Academic, Pre-Professional, Design Teams, etc.), Mission Statement, Membership Benefits, and EngageSC Website URL.
  - Vector Representation: Deterministic 128-dimensional sub-word n-gram semantic embedding per club for cosine similarity queries.
  - Record Count: 306 clubs successfully indexed in `memory.db`.

## Decision 9: Event Ingestion Pipeline Architecture & Cron Wake-up

- **Date**: 2026-11-14
- **Decision**: Standalone Event Ingestion & Proactive Recommender Pipeline (`pipeline_events.py`).
- **Approved by User**: Selected "Hybrid Pipeline: Standalone event crawler & proactive recommender script (runnable via macOS crontab or daemon), tracking recommendations in a new `sent_recommendations` table to prevent duplicates".
- **Specification**:
  - Event Sources: USC Calendar Open API (`https://calendar.usc.edu/api/2/events`) + EngageSC Events (`https://engage.usc.edu/events`).
  - Storage & Vectorization: Store events in `campus_events` in `memory.db` with sub-word n-gram embeddings.
  - Execution Modes: Can be triggered via standalone CLI, cron, or Antigravity `/schedule`.
  - Proactive Wake-up: Automatically queries unnotified events, evaluates student profile affinity, invokes Tommy (`muse-ember-1.0`) to craft a proactive personalized SMS pitch, and dispatches via `imessage_sender.send_message`.

## Decision 10: Proactive Notification Gating Policy & Deduplication

- **Date**: 2026-11-14
- **Decision**: Strict Semantic Match & Dedup Policy.
- **Approved by User**: Selected "Strict Semantic Match & Dedup: Minimum cosine similarity score (>= 0.48) against student profile, max 1-2 top events per wake-up, strictly never re-notifying for the same event".
- **Gating Rules**:
  1. **Deduplication Gate**: New table `sent_recommendations (phone_or_email, event_id, sent_at)`. An event cannot be sent to the same recipient more than once.
  2. **Relevance Threshold Gate**: Must have a cosine similarity $\ge 0.48$ against the student's profile embedding or direct keyword overlap with active courses/clubs/interests.
  3. **Volume Throttle**: Maximum 1 to 2 high-confidence recommendations per cron wake-up to prevent spam.
  4. **Tone Directive**: Spontaneous, conversational Trojan outreach ("Hey there, heads up — saw an event happening at Ginsburg Hall you might like...").

## Decision 11: EngageSC Events Ingestion Integration

- **Date**: 2026-11-14
- **Decision**: Ingest live student organization events from EngageSC (`https://engage.usc.edu/events`) into the events vector database.
- **Specification**:
  - Endpoint: `https://engage.usc.edu/mobile_ws/v17/mobile_events_list?range={offset}&limit={limit}`
  - Extraction: Parsed event name, date/time span, hosting RSO/department, category, location, admission price, flyer summary, RSVP link (`https://engage.usc.edu/rsvp_boot?id=...`), and free food indicators.
  - Multi-Source Aggregation: Unified with official USC Calendar API in `crawl_usc_events.py`.
  - Ingestion Result: 131 EngageSC club events + 267 USC Calendar events = 398 total campus events indexed into `memory.db`.

## Decision 12: Instagram Club Events Ingestion via Meta Business Discovery API

- **Date**: 2026-11-15
- **Decision**: Ingest campus club events from Instagram via Meta Graph API (Business Discovery) and Muse Ember LLM extraction.
- **Approved by User**: Selected "(Recommended) Official Meta Graph API (Business Discovery)".
- **Specification**:
  - **API Endpoint**: `GET https://graph.facebook.com/v21.0/{ig_user_id}?fields=business_discovery.username({handle}){media{caption,media_url,timestamp,permalink,media_type}}`
  - **Authentication**: `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_ACCOUNT_ID` injected via environment variables.
  - **Club Targets**: Target list of USC student organizations / club handles (e.g. `hackscofficial`, `ai.usc`, `caisplusplus`, `usc_acm`, `usclavalab`, etc.).
  - **LLM Extraction**: Post captions are evaluated by `muse-ember-1.0` to determine if a post announces an upcoming event and extract structured fields: `title`, `description`, `date_str`, `location`, `tags`, `has_free_food`, and `rsvp_url` (or permalink).
  - **Database Integration**: Validated events are stored in `memory.db`'s `campus_events` table with generated vector embeddings, feeding directly into Tommy's proactive recommendation pipeline.









