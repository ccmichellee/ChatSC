import json
import logging
import re
import secrets
import sys
import threading
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Literal

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field, field_validator
from web.api.store import PACIFIC, WebStore, conflicts
from web.api.refresh import refresh, seed_fallback
from web.api.toji import build_router
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO)
store = WebStore()


@asynccontextmanager
async def lifespan(app):
    if not store.events():
        seed_fallback(store)
    threading.Thread(target=refresh, args=(store,), daemon=True).start()
    yield


app = FastAPI(title="ChatSC API", lifespan=lifespan)
app.include_router(build_router(store))


@app.exception_handler(RequestValidationError)
async def private_validation_error(request: Request, exc: RequestValidationError):
    if request.url.path in ("/api/signups", "/api/chat"):
        return JSONResponse(status_code=422, content={
            "detail": "Please check the required fields, US phone number, and message length."
        }, headers={"Cache-Control": "no-store"})
    # Strip input values from validation errors throughout the API.
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()
    ]})


class ClassBlock(BaseModel):
    day: int = Field(ge=0, le=6)
    start: str
    end: str
    title: str = Field(max_length=100)

    @field_validator("start", "end")
    @classmethod
    def valid_time(cls, value):
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            raise ValueError("Use HH:mm")
        return value


class StudentInput(BaseModel):
    phone: str
    consent: bool = False
    interests: list[str] = Field(max_length=30)
    email: str = Field(default="", max_length=254)
    goals: list[str] = Field(default_factory=list, max_length=30)
    notes: str = Field(default="", max_length=1000)
    gmail_consent: bool = False
    availability: list[ClassBlock] = Field(max_length=40)
    frequency: Literal["daily", "weekly", "twice-weekly"]
    name: str = Field(default="Trojan", max_length=100)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if not value.strip():
            raise ValueError("Enter your first name.")
        return value.strip()

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if value and not re.fullmatch(r"[^@\s]{1,64}@[^@\s.]{1,190}(?:\.[^@\s.]{1,63})+", value):
            raise ValueError("Enter a valid email address.")
        return value

    @field_validator("goals")
    @classmethod
    def valid_goals(cls, values):
        if any(not value.strip() or len(value) > 100 for value in values):
            raise ValueError("Each goal must be between 1 and 100 characters.")
        return list(dict.fromkeys(value.strip() for value in values))


def session_user(request):
    token = request.cookies.get("chatsc_session", "")
    with store.get_connection() as conn:
        row = conn.execute("SELECT student_key FROM web_sessions WHERE token=?", (token,)).fetchone()
    return row[0] if row else None


def profile_for(user):
    profile = store.get_student_profile(user) if user else None
    extra = {}
    if profile:
        try:
            extra = json.loads(profile.get("raw_summary") or "{}")
        except ValueError:
            pass
    return dict(user=user or "", onboarded=bool(profile), name=profile.get("name", "Trojan") if profile else "Trojan",
                consent=extra.get("consent", False), interests=extra.get("interests", profile.get("interests", []) if profile else []),
                availability=extra.get("availability", []), frequency=extra.get("frequency", "weekly"),
                email=extra.get("email", ""), goals=extra.get("goals", []), notes=extra.get("notes", ""),
                email_verified=bool(extra.get("email_verified", False)),
                phone_verified=bool(extra.get("phone_verified", False)),
                gmail_consent=bool(extra.get("gmail_consent", False)))


@app.get("/api/healthz")
def health():
    return {"status": "ok"}


@app.get("/api/profile")
def profile(request: Request):
    return profile_for(session_user(request))


@app.post("/api/session/reset")
def reset_personalization(request: Request, response: Response):
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "Open ChatSC to reset your personalization.")
    token = request.cookies.get("chatsc_session", "")
    if token:
        with store.get_connection() as conn:
            conn.execute("DELETE FROM web_sessions WHERE token=?", (token,))
    response.delete_cookie(
        "chatsc_session", path="/", httponly=True, samesite="strict",
        secure=request.headers.get("x-forwarded-proto") == "https",
    )
    response.headers["Cache-Control"] = "no-store"
    return profile_for(None)


@app.post("/api/onboarding")
def onboarding(data: StudentInput, request: Request, response: Response):
    user = session_user(request)
    if not re.fullmatch(r"[0-9\s()+.\-]*", data.phone):
        raise HTTPException(422, "Enter a valid US phone number.")
    phone = re.sub(r"[^0-9]", "", data.phone)
    email = data.email
    if user and not phone:
        previous = store.get_student_profile(user)
        try:
            previous_extra = json.loads(previous.get("raw_summary") or "{}")
            phone = previous_extra.get("phone", "")
        except (ValueError, AttributeError):
            previous_extra = {}
            phone = ""
    else:
        previous = store.get_student_profile(user) if user else None
        try:
            previous_extra = json.loads(previous.get("raw_summary") or "{}") if previous else {}
        except (ValueError, AttributeError):
            previous_extra = {}
    if user and not email:
        email = previous_extra.get("email", "")
    if len(phone) not in (10, 11) or (len(phone) == 11 and not phone.startswith("1")):
        raise HTTPException(422, "Enter a valid US phone number.")
    if len(phone) == 10:
        phone = "1" + phone
    if phone[1] not in "23456789" or phone[4] not in "23456789":
        raise HTTPException(422, "Enter a valid US phone number.")
    if any(not i.strip() or len(i) > 100 for i in data.interests):
        raise HTTPException(422, "Interests must be between 1 and 100 characters.")
    if any(b.end <= b.start for b in data.availability):
        raise HTTPException(422, "Class blocks must end after they start.")
    if not user:
        user = secrets.token_urlsafe(24)
        token = secrets.token_urlsafe(32)
        with store.get_connection() as conn:
            conn.execute("INSERT INTO web_sessions VALUES (?,?)", (token, user))
        response.set_cookie("chatsc_session", token, httponly=True, samesite="strict", max_age=60 * 60 * 24 * 365,
                            secure=request.headers.get("x-forwarded-proto") == "https")
    previous_email = previous_extra.get("email", "")
    email_verified = bool(previous_extra.get("email_verified")) if email and email == previous_email else False
    # No OTP provider or Gmail OAuth is configured in this workspace. Never infer
    # that a typed email/phone is verified or that mailbox access was granted.
    phone_verified = bool(previous_extra.get("phone_verified")) if phone == previous_extra.get("phone") else False
    all_interests = list(dict.fromkeys([
        *data.interests, *data.goals,
        *([data.notes] if data.notes else []),
    ]))
    store.save_student_profile(user, dict(name=data.name, major="", school="USC", year="",
        interests=all_interests, courses=[], raw_summary=json.dumps(dict(phone=phone, consent=data.consent,
        email=email, email_verified=email_verified, phone_verified=phone_verified,
        interests=data.interests, goals=data.goals, notes=data.notes,
        gmail_consent=data.gmail_consent,
        availability=[b.model_dump() for b in data.availability], frequency=data.frequency))))
    return profile_for(user)


@app.get("/api/events")
def events(request: Request, q: str = "", tag: str = "", from_: str = Query("", alias="from"),
           to: str = "", free_food: bool = False):
    rows = store.events()
    if q:
        # Reuse the original semantic search to rank results, then apply the visible text filter.
        ranked = store.search_events(q, free_food_only=free_food, top_k=10000)
        ranks = {(e["title"], e["date"]): i for i, e in enumerate(ranked)}
        rows.sort(key=lambda e: ranks.get((e["title"], e["date_str"]), 10001))
        rows = [e for e in rows if q.lower() in " ".join([e["title"], e["description"], e["location"], *e["tags"]]).lower()]
    if tag:
        rows = [e for e in rows if tag.lower() in [t.lower() for t in e["tags"]] or tag.lower() == e["category"].lower()]
    if free_food:
        rows = [e for e in rows if e["free_food"]]
    for value in (from_, to):
        if value:
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(422, "Date filters must use YYYY-MM-DD.")
    if from_ or to:
        rows = [e for e in rows if e["start"] and (not from_ or e["start"][:10] >= from_) and (not to or e["start"][:10] <= to)]
    blocks = profile_for(session_user(request))["availability"]
    return [{**e, "conflict": conflicts(e, blocks)} for e in rows]


@app.get("/api/clubs")
def clubs(q: str = "", category: str = ""):
    rows = store.clubs()
    if q:
        ranked = store.search_clubs(q, top_k=10000)
        ranks = {c["name"]: i for i, c in enumerate(ranked)}
        rows.sort(key=lambda c: ranks.get(c["name"], 10001))
        rows = [c for c in rows if q.lower() in (c["name"] + " " + c["description"]).lower()]
    if category:
        rows = [c for c in rows if category.lower() == c["category"].lower()]
    return rows


@app.get("/api/opportunities")
def opportunities():
    return json.loads((ROOT / "data/opportunities.json").read_text())


@app.get("/api/recommendations")
def recommendations(request: Request, user: str = ""):
    current = session_user(request)
    if not current:
        return []
    if user and user != current:
        raise HTTPException(403, "Recommendations belong to this browser's profile.")
    matches = store.get_unnotified_events_for_student(current, min_similarity=0.1, limit=1000)
    scores = {e["id"]: e for e in matches}
    blocks = profile_for(current)["availability"]
    result = []
    for event in store.events():
        if event["id"] not in scores or conflicts(event, blocks):
            continue
        if event["start"] and datetime.fromisoformat(event["start"]).astimezone(PACIFIC) < datetime.now(PACIFIC):
            continue
        match = scores[event["id"]]
        result.append({**event, "conflict": False, "match_score": match["match_score"], "matched_reasons": match["matched_reasons"]})
    return sorted(result, key=lambda e: e["match_score"], reverse=True)[:12]


@app.post("/api/refresh")
def refresh_events():
    return refresh(store)


@app.get("/api/summary")
def summary():
    rows = store.events()
    club_rows = store.clubs()
    return dict(events=len(rows), clubs=len(club_rows), opportunities=len(opportunities()),
                free_food=sum(e["free_food"] for e in rows),
                tags=sorted({t for e in rows for t in e["tags"]}),
                categories=sorted({c["category"] for c in club_rows}),
                last_updated=max((e["updated_at"] for e in rows if e["updated_at"]), default=None),
                sample_data=bool(rows) and all(e["sample_data"] for e in rows))
