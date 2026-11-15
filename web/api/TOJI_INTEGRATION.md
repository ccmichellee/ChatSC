# Connecting Toji

The website collects signups and provides a chat transport. It does not send iMessages,
run a second AI agent, or subscribe a number to a carrier/SMS provider.
Chat has an explicit placeholder until configured. No real student data is seeded.

## Required from the operator

1. A strong, random `TOJI_SIGNUPS_API_KEY` secret, also installed in the Python bot.
   This is a private key you choose, not a provider's AI key. Never put it in a
   `VITE_` variable, browser code, URL, Git, or chat message.
2. `TOJI_BACKEND_URL`: the complete HTTPS POST endpoint of your existing agent.
   Leave unset for preview replies. Optional `TOJI_BACKEND_API_KEY` secret is sent
   as a Bearer token if your agent requires authentication.
3. Reviewed Privacy Policy and Terms: operator identity, contact/deletion request
   channel, retention period, processors, messaging frequency/rates, eligibility,
   and applicable consent requirements. Current linked pages are marked DRAFT.
4. A running iMessage/text bot, including welcome-message handling, opt-out/STOP,
   suppression lists, and verified ownership before sensitive cross-device access.
   The signup receipt is not proof that a message was delivered.

Configure these server-side; no AI provider key is needed by the website itself.
The existing database remains SQLite. Before a production launch, ensure that
database lives on durable storage in the hosting environment; don't assume local
workspace files persist across deployments or replicas.

## Pull new signups

`GET /api/signups?after_id=0&limit=100` with header `X-API-Key`.
Missing/wrong key: 401; missing server configuration: 503 (closed, not public).
Response has `Cache-Control: no-store`:

```python
import os
import requests

result = requests.get(
    os.environ["CHATSC_SIGNUPS_URL"],  # complete website /api/signups URL
    params={"after_id": durable_cursor, "limit": 100},
    headers={"X-API-Key": os.environ["TOJI_SIGNUPS_API_KEY"]},
    timeout=20,
)
result.raise_for_status()
batch = result.json()
for signup in batch["signups"]:
    # Persist by signup["id"] before sending; retries must be idempotent.
    # Verify consent, consult your STOP suppression list, then queue the welcome.
    # Normalize bot lookup to signup["phone"] (+1 E.164).
    # Store signup["profile_id"] <-> verified messaging identity mapping.
    process_signup_idempotently(signup)
# Advance only after the batch is durably processed. Page again until empty.
save_cursor_durably(batch["next_after_id"])
```

Rows include id, profile_id, first_name, normalized phone, interests, classes,
consent, exact consent_text, consent_version, and UTC created_at. Submitting again
adds a consent snapshot; it is not permission to resend welcome messages on every
poll. Deduplicate welcome delivery by verified number and signup IDs. This feed is
never fetched by frontend code. It is not a public admin page.

## Agent transport contract

`POST /api/chat` accepts `{ "message": "Find clubs for me" }`.
The server creates/resumes a secure HttpOnly, SameSite=Strict browser cookie.
Optional session_id must match that cookie; optional phone must match that
browser's signup. Neither field is authentication by itself. The response contains
only `{reply, session_id, placeholder}`—never signup data or a phone.

The website sends this JSON to the configured full `TOJI_BACKEND_URL`:

```json
{
  "message": "Find clubs for me",
  "session_id": "opaque-browser-profile-id",
  "profile_id": "opaque-browser-profile-id",
  "phone": null,
  "profile": {"first_name": "", "interests": [], "classes": ""}
}
```

After signup, `phone` is the claimed +1 number from the server's private record,
and the profile carries the signup interests/classes. Use the same verified
profile mapping in the text bot and web agent to share saved interests and memory.
Never retrieve another student's profile just because a visitor types a number.
No automatic merging of existing phone profiles occurs without verification.
Unverified signup requests can contain a mistyped or someone else's number.

Return HTTP 200 JSON `{ "reply": "Toji's reply" }`. Timeouts, redirects, malformed,
oversized, and failed upstream replies show a generic retryable error, not a fake
successful AI reply. No message history is stored by this website; the connected
agent should maintain history by the verified profile/session ID.

In the existing bot's authenticated adapter, call the existing
`LlamaClient.generate_reply(message, history=history, current_user=resolved_identity)`.
Reuse `student_memory.py` and `tools.py`; do not implement another search/AI loop.
Upsert the specific supplied profile in the agent's memory first and map verified
phone identity to it. Important: the existing LlamaClient falls back to the first
stored student when current_user has no matching profile. Prevent that fallback
by creating an empty isolated guest profile for anonymous sessions before calling
it, or explicitly remove that fallback in the bot before exposing its adapter.
Do not give a guest access to an unrelated stored student's memory.

## Privacy and launch limits

- Website session IDs are opaque; phone/name are not stored in localStorage.
- Consent is unchecked by default and enforced on the server.
- Signup fields are validated, SQL is parameterized, and errors omit request data.
- Basic per-process rate limits cover public signup/chat routes. A production edge
  rate limiter/CAPTCHA may be needed for abuse across replicas; phone verification
  is needed before enabling private profile lookup across devices.
- STOP processing, welcome delivery, and shared conversation history belong to the
  connected bot. They are not silently simulated by this website.

Run isolated checks: `python -m unittest web.api.test_toji -v`.
