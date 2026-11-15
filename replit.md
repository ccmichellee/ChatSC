# ChatSC

A responsive USC campus opportunity finder with live events, club discovery, a campus map, and class-schedule-aware recommendations.

## Run & Operate

- Managed API workflow: `artifacts/api-server: API Server` runs the Python FastAPI layer.
- Managed frontend workflow: `artifacts/chatsc: web` runs React + Vite at `/`.
- `pnpm --filter @workspace/chatsc run typecheck` checks the frontend.
- `pnpm --filter @workspace/api-spec run codegen` regenerates API hooks and schemas.
- Python dependencies are declared in `pyproject.toml` and `uv.lock`.
- No API keys or login are required.

## Project structure

- Original Python repository modules are retained unchanged at the root.
- `web/api/` contains the new FastAPI routes, metadata adapter, and crawler integration.
- `web/frontend` links to `artifacts/chatsc`, the React/Vite/Tailwind app.
- `data/opportunities.json` contains exactly 12 explicitly fictional sample listings.
- `lib/api-spec/openapi.yaml` is the web API contract.
- `memory.db` is the existing SQLite store, intentionally excluded from Git.

## User requirements

- Do not rewrite, delete, run, or import the macOS-only bot, iMessage reader, or iMessage sender.
- Keep the original Python source unchanged; add web functionality alongside it.
- Keep SQLite and reuse the original MemoryStore and crawlers, not PostgreSQL.
- Remind me and Verify are explicitly simulated UI controls. No SMS is sent.
- Label all fallback events, fallback clubs, and fictional opportunities “Sample data.”
- Never invent missing locations, event deadlines, requirements, or event durations.
- Preserve unparseable event dates for lists; exclude them from calendars and conflict checks.

## Web behavior

- Anonymous HTTP-only browser cookies scope saved profiles; phones are not public profile identifiers.
- Additional SQLite metadata tables preserve source links and crawl timestamps without changing original tables.
- Live crawler calls use `crawl_events(days=30, max_pages=2)` and tolerate unavailable sources.
- The original seed function supplies fallback records; additional clearly fictional dated samples support calendar previews.
- Event and schedule time zone is America/Los_Angeles; class-block day zero is Monday.
- The shared proxy routes `/api` to FastAPI and `/` to Vite; no browser-visible localhost URLs are used.
