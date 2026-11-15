"""Private signup intake and a transport adapter, not a second AI implementation."""
import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
from collections import deque
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, StrictBool, field_validator

CONSENT_TEXT = ("I agree to receive iMessage/text messages from Toji with recommendations "
                "about clubs, events, and opportunities. Reply STOP anytime to unsubscribe.")
CONSENT_VERSION = "2026-11-14"
SUCCESS = "You’re in! Toji will text you shortly."


def normalize_phone(value: str) -> str:
    if not re.fullmatch(r"[0-9\s()+.\-]+", value):
        raise ValueError("Enter a valid US phone number.")
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if not re.fullmatch(r"[2-9][0-9]{2}[2-9][0-9]{6}", digits):
        raise ValueError("Enter a valid 10-digit US phone number.")
    return "+1" + digits


class SignupInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    phone: str = Field(max_length=30)
    interests: list[str] = Field(default_factory=list, max_length=30)
    classes: str = Field(default="", max_length=2000)
    consent: StrictBool

    @field_validator("first_name")
    @classmethod
    def name_not_blank(cls, value):
        if not value.strip():
            raise ValueError("First name is required.")
        return value.strip()

    @field_validator("phone")
    @classmethod
    def phone_valid(cls, value):
        return normalize_phone(value)

    @field_validator("interests")
    @classmethod
    def valid_interests(cls, values):
        if any(not v.strip() or len(v) > 100 for v in values):
            raise ValueError("Interests must be between 1 and 100 characters.")
        return list(dict.fromkeys(v.strip() for v in values))


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=30)

    @field_validator("message")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Please enter a message.")
        return value.strip()


def build_router(store):
    router = APIRouter()
    buckets = {}
    lock = threading.Lock()

    @contextmanager
    def database():
        # sqlite's transaction context manager commits but does not close.
        with closing(store.get_connection()) as conn:
            with conn:
                yield conn

    with database() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS toji_signups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT NOT NULL,
                first_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                interests TEXT NOT NULL,
                classes TEXT NOT NULL,
                consent INTEGER NOT NULL CHECK(consent=1),
                consent_text TEXT NOT NULL,
                consent_version TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS toji_signup_profile ON toji_signups(profile_id, id);
        """)

    def guard(request, action, maximum):
        # Cross-site forms cannot create a profile or incur agent charges.
        if request.headers.get("sec-fetch-site") == "cross-site":
            raise HTTPException(403, "Use the form on this website.")
        origin = request.headers.get("origin")
        allowed_hosts = {request.headers.get("host", ""), request.headers.get("x-forwarded-host", "")}
        if origin and urlparse(origin).netloc not in allowed_hosts:
            raise HTTPException(403, "Use the form on this website.")
        # Bounded, per-process abuse protection; never retain raw IPs in the bucket.
        address = request.client.host if request.client else "unknown"
        key = (action, hashlib.sha256(address.encode()).hexdigest())
        now = time.monotonic()
        with lock:
            for old in [k for k, q in buckets.items() if not q or q[-1] < now - 600]:
                del buckets[old]
            if key not in buckets and len(buckets) >= 10000:
                raise HTTPException(429, "Please try again later.")
            queue = buckets.setdefault(key, deque())
            while queue and queue[0] < now - 600:
                queue.popleft()
            if len(queue) >= maximum:
                raise HTTPException(429, "Please wait a few minutes and try again.")
            queue.append(now)

    def identity(request, response):
        token = request.cookies.get("chatsc_session", "")
        with database() as conn:
            row = conn.execute("SELECT student_key FROM web_sessions WHERE token=?", (token,)).fetchone()
            if row:
                return row[0]
            user, token = secrets.token_urlsafe(24), secrets.token_urlsafe(32)
            conn.execute("INSERT INTO web_sessions VALUES (?,?)", (token, user))
        response.set_cookie("chatsc_session", token, httponly=True, samesite="strict",
                            secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https",
                            max_age=60 * 60 * 24 * 365)
        return user

    @router.post("/api/signups", status_code=201)
    def signup(data: SignupInput, request: Request, response: Response):
        response.headers["Cache-Control"] = "no-store"
        guard(request, "signup", 10)
        if not data.consent:
            raise HTTPException(422, "Consent is required to sign up.")
        user = identity(request, response)
        previous = store.get_student_profile(user) or {}
        try:
            extra = json.loads(previous.get("raw_summary") or "{}")
        except ValueError:
            extra = {}
        extra.update(phone=data.phone, consent=True, classes=data.classes)
        # Never find/merge a profile by a publicly supplied phone number.
        # The bot receives this browser's profile_id and the claimed phone privately.
        store.save_student_profile(user, {
            **previous, "name": data.first_name, "school": "USC",
            "interests": data.interests, "courses": [c.strip() for c in data.classes.splitlines() if c.strip()],
            "raw_summary": json.dumps(extra),
        })
        with database() as conn:
            conn.execute("""INSERT INTO toji_signups
                (profile_id,first_name,phone,interests,classes,consent,consent_text,consent_version,created_at)
                VALUES (?,?,?,?,?,1,?,?,?)""",
                (user, data.first_name, data.phone, json.dumps(data.interests), data.classes,
                 CONSENT_TEXT, CONSENT_VERSION, datetime.now(timezone.utc).isoformat()))
        return {"message": SUCCESS}

    @router.get("/api/signups")
    def signups(request: Request, response: Response, after_id: int = Query(0, ge=0),
                limit: int = Query(100, ge=1, le=100)):
        response.headers["Cache-Control"] = "no-store"
        key = os.environ.get("TOJI_SIGNUPS_API_KEY", "")
        if not key:
            raise HTTPException(503, "Private signup feed is not configured.")
        supplied = request.headers.get("x-api-key", "")
        if not hmac.compare_digest(supplied.encode(), key.encode()):
            raise HTTPException(401, "API key required.")
        with database() as conn:
            conn.row_factory = __import__("sqlite3").Row
            rows = conn.execute("SELECT * FROM toji_signups WHERE id>? ORDER BY id LIMIT ?",
                                (after_id, limit)).fetchall()
        result = [{**dict(row), "interests": json.loads(row["interests"]), "consent": bool(row["consent"])}
                  for row in rows]
        return {"signups": result, "next_after_id": result[-1]["id"] if result else after_id}

    @router.post("/api/chat")
    def chat(data: ChatInput, request: Request, response: Response):
        response.headers["Cache-Control"] = "no-store"
        guard(request, "chat", 60)
        user = identity(request, response)
        if data.session_id and not hmac.compare_digest(data.session_id.encode(), user.encode()):
            raise HTTPException(403, "This session belongs to another browser.")
        with database() as conn:
            conn.row_factory = __import__("sqlite3").Row
            row = conn.execute("SELECT * FROM toji_signups WHERE profile_id=? ORDER BY id DESC LIMIT 1",
                               (user,)).fetchone()
        phone = row["phone"] if row else None
        if data.phone:
            try:
                matches = phone and normalize_phone(data.phone) == phone
            except ValueError:
                matches = False
            if not matches:
                raise HTTPException(403, "Use this browser's signup form to link your phone.")
        url = os.environ.get("TOJI_BACKEND_URL", "").strip()
        if not url:
            return {"reply": "I'm Toji! This is a preview—my campus assistant isn't connected yet. "
                    "You can browse Clubs, Events, and Opportunities on ChatSC while the team connects me. "
                    "I haven't searched or sent any texts.", "session_id": user, "placeholder": True}
        if urlparse(url).scheme != "https":
            raise HTTPException(503, "The agent connection requires an HTTPS URL.")
        profile = store.get_student_profile(user) or {}
        payload = {"message": data.message, "session_id": user, "profile_id": user, "phone": phone,
                   "profile": {"first_name": profile.get("name", ""),
                               "interests": profile.get("interests", []),
                               "classes": row["classes"] if row else ""}}
        headers = {"Content-Type": "application/json"}
        token = os.environ.get("TOJI_BACKEND_API_KEY", "")
        if token:
            headers["Authorization"] = "Bearer " + token
        try:
            # URL is operator-configured, never taken from a student's request.
            with requests.post(url, json=payload, headers=headers, timeout=(5, 35),
                               allow_redirects=False, stream=True) as upstream:
                upstream.raise_for_status()
                if upstream.status_code != 200:
                    raise ValueError("Unexpected agent response")
                raw = bytearray()
                for chunk in upstream.iter_content(4096):
                    raw.extend(chunk)
                    if len(raw) > 65536:
                        raise ValueError("Agent response too large")
                reply = json.loads(raw).get("reply")
                if not isinstance(reply, str) or not reply.strip() or len(reply) > 12000:
                    raise ValueError("Invalid agent reply")
        except (requests.RequestException, ValueError, AttributeError):
            # Do not leak an upstream error, credentials, phone, or request payload.
            raise HTTPException(502, "Toji is temporarily unavailable. Please try again.")
        return {"reply": reply, "session_id": user, "placeholder": False}

    return router
