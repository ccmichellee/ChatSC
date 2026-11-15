"""Isolated API regression checks; no real signups, messages, credentials, or network."""
import asyncio
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from student_memory import MemoryStore
from web.api.toji import build_router, normalize_phone


class TojiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(os.path.join(self.temp.name, "test.db"))
        with self.store.get_connection() as conn:
            conn.execute("CREATE TABLE web_sessions (token TEXT PRIMARY KEY, student_key TEXT NOT NULL)")
        self.app = FastAPI()
        self.app.include_router(build_router(self.store))
        self.env = patch.dict(os.environ, {
            "TOJI_SIGNUPS_API_KEY": "test-only-not-a-real-key",
            "TOJI_BACKEND_URL": "", "TOJI_BACKEND_API_KEY": "",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        self.addCleanup(self.temp.cleanup)

    def call(self, method, path, body=None, cookie="", key="", origin=None):
        async def run():
            headers = [(b"host", b"testserver"), (b"content-type", b"application/json")]
            if cookie:
                headers.append((b"cookie", cookie.encode()))
            if key:
                headers.append((b"x-api-key", key.encode()))
            if origin:
                headers.append((b"origin", origin.encode()))
            path_only, _, query = path.partition("?")
            scope = {"type": "http", "asgi": {"version": "3.0"}, "method": method,
                     "scheme": "https", "path": path_only, "raw_path": path_only.encode(),
                     "query_string": query.encode(), "root_path": "", "headers": headers,
                     "client": ("127.0.0.1", 1234), "server": ("testserver", 443)}
            messages = []
            async def receive():
                return {"type": "http.request", "body": json.dumps(body).encode() if body else b"", "more_body": False}
            async def send(message):
                messages.append(message)
            await self.app(scope, receive, send)
            start = next(m for m in messages if m["type"] == "http.response.start")
            data = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
            cookies = [v.decode().split(";")[0] for k, v in start["headers"] if k == b"set-cookie"]
            return start["status"], json.loads(data), cookies[0] if cookies else cookie
        return asyncio.run(run())

    def signup(self, **changes):
        return {"first_name": "Test Student", "phone": "(213) 555-0100", "consent": True,
                "interests": ["hackathons"], "classes": "CSCI 104 Monday 10–11", **changes}

    def test_phone_validation(self):
        self.assertEqual(normalize_phone("1 (213) 555-0100"), "+12135550100")
        for invalid in ["123", "+44 20 1234 5678", "111-111-1111", "2135550100ext1"]:
            with self.assertRaises(ValueError):
                normalize_phone(invalid)

    def test_consent_and_validation(self):
        self.assertEqual(self.call("POST", "/api/signups", self.signup(consent=False))[0], 422)
        for data in [self.signup(first_name=" "), self.signup(phone="bad"), self.signup(consent="true")]:
            self.assertEqual(self.call("POST", "/api/signups", data)[0], 422)
        self.assertEqual(self.call("POST", "/api/chat", {"message": " "})[0], 422)
        self.assertEqual(self.call("POST", "/api/signups", self.signup(), origin="https://evil.test")[0], 403)
        with self.store.get_connection() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM toji_signups").fetchone()[0], 0)

    def test_feed_is_private_paginated_and_persistent(self):
        status, receipt, cookie = self.call("POST", "/api/signups", self.signup())
        self.assertEqual(status, 201)
        self.assertEqual(set(receipt), {"message"})
        self.assertNotIn("213", json.dumps(receipt))
        self.assertEqual(self.call("GET", "/api/signups")[0], 401)
        self.assertEqual(self.call("GET", "/api/signups", key="wrong")[0], 401)
        status, feed, _ = self.call("GET", "/api/signups?limit=1", key="test-only-not-a-real-key")
        self.assertEqual(status, 200)
        row = feed["signups"][0]
        self.assertEqual(row["phone"], "+12135550100")
        self.assertEqual(row["interests"], ["hackathons"])
        self.assertTrue(row["consent"])
        self.assertIn("STOP", row["consent_text"])
        self.assertTrue(row["created_at"])
        profile = self.store.get_student_profile(row["profile_id"])
        self.assertEqual(profile["interests"], ["hackathons"])
        self.assertEqual(self.call("GET", f"/api/signups?after_id={row['id']}", key="test-only-not-a-real-key")[1]["signups"], [])
        # A new router/store connection still sees the saved record.
        fresh = MemoryStore(self.store.db_path)
        with fresh.get_connection() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM toji_signups").fetchone()[0], 1)
        with patch.dict(os.environ, {"TOJI_SIGNUPS_API_KEY": ""}):
            self.assertEqual(self.call("GET", "/api/signups")[0], 503)

    def test_chat_session_and_phone_isolation(self):
        _, first, cookie = self.call("POST", "/api/chat", {"message": "Find clubs"})
        self.assertTrue(first["placeholder"])
        self.assertEqual(self.call("POST", "/api/chat", {"message": "Hi", "session_id": first["session_id"]})[0], 403)
        self.assertEqual(self.call("POST", "/api/chat", {"message": "Hi", "phone": "2135550100"}, cookie=cookie)[0], 403)
        self.call("POST", "/api/signups", self.signup(), cookie=cookie)
        status, reply, _ = self.call("POST", "/api/chat", {"message": "Hi", "phone": "2135550100"}, cookie=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(reply["session_id"], first["session_id"])
        self.assertNotIn("213", json.dumps(reply))
        # Supplying the same phone never authenticates a second browser.
        self.assertEqual(self.call("POST", "/api/chat", {"message": "Hi", "phone": "2135550100"})[0], 403)

    def test_configured_transport_and_failure(self):
        _, _, cookie = self.call("POST", "/api/signups", self.signup())
        class AgentReply:
            status_code = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def raise_for_status(self): pass
            def iter_content(self, size): yield b'{"reply":"Connected reply"}'
        with patch.dict(os.environ, {"TOJI_BACKEND_URL": "https://agent.example.test/chat"}):
            with patch("web.api.toji.requests.post", return_value=AgentReply()) as post:
                status, reply, _ = self.call("POST", "/api/chat", {"message": "Hi"}, cookie=cookie)
                self.assertEqual(status, 200)
                self.assertFalse(reply["placeholder"])
                payload = post.call_args.kwargs["json"]
                self.assertEqual(payload["phone"], "+12135550100")
                self.assertEqual(payload["profile"]["interests"], ["hackathons"])
                self.assertEqual(payload["profile_id"], reply["session_id"])
            with patch("web.api.toji.requests.post", side_effect=ValueError("private upstream detail")):
                status, reply, _ = self.call("POST", "/api/chat", {"message": "Hi"}, cookie=cookie)
                self.assertEqual(status, 502)
                self.assertNotIn("private", json.dumps(reply))

    def test_rate_limit(self):
        for _ in range(10):
            self.assertEqual(self.call("POST", "/api/signups", self.signup(consent=False))[0], 422)
        self.assertEqual(self.call("POST", "/api/signups", self.signup())[0], 429)


if __name__ == "__main__":
    unittest.main()
