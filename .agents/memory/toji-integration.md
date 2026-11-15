---
name: Toji integration boundaries
description: Product constraints for the Toji signup and web-chat integration
---

Toji recommends USC clubs, events, and opportunities over iMessage and website chat.
The website should collect consented signups and connect to the existing Python
agent, rather than rebuilding the AI, search tools, or message delivery.

**Why:** The user explicitly requested reusing the existing agent and a configurable
backend connection, with honest placeholder replies until it is connected.

**How to apply:** Keep messaging delivery and shared conversation memory in the
existing bot. Do not treat a visitor typing a phone number as verification or
permission to reveal an existing profile. Preserve explicit consent records and
make unconnected messaging/AI states clear.
