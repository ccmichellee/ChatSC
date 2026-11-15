import os
import json
import sqlite3
import math
import struct
import hashlib
import re
from typing import Optional, Dict, Any, List

DB_PATH = os.path.join(os.path.dirname(__file__), "memory.db")
EMBED_DIM = 128


def compute_text_embedding(text: str, dim: int = EMBED_DIM) -> bytes:
    """
    Computes a deterministic semantic text embedding vector in pure Python.
    Uses sub-word n-gram hashing + token frequency with L2 unit normalization.
    Fast (<0.1ms) with zero external dependencies.
    """
    if not text:
        vec = [0.0] * dim
        return struct.pack(f"{dim}f", *vec)

    tokens = [t.strip().lower() for t in text.replace("\n", " ").split() if t.strip()]
    vec = [0.0] * dim

    for token in tokens:
        # Token hash
        h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        vec[idx] += 1.0

        # Sub-word char trigrams
        if len(token) >= 3:
            for i in range(len(token) - 2):
                tri = token[i:i+3]
                h_tri = int(hashlib.md5(tri.encode("utf-8")).hexdigest(), 16)
                idx_tri = h_tri % dim
                vec[idx_tri] += 0.5

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]

    return struct.pack(f"{dim}f", *vec)


def cosine_sim(blob1: bytes, blob2: bytes) -> float:
    """Calculates cosine similarity between two serialized float vectors."""
    if not blob1 or not blob2:
        return 0.0
    n1 = len(blob1) // 4
    n2 = len(blob2) // 4
    if n1 != n2 or n1 == 0:
        return 0.0
    v1 = struct.unpack(f"{n1}f", blob1)
    v2 = struct.unpack(f"{n2}f", blob2)
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a * a for a in v1))
    norm2 = math.sqrt(sum(b * b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


class MemoryStore:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.create_function("cosine_sim", 2, cosine_sim)
        return conn

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        try:
            cur = conn.cursor()
            
            # 1. Student Profiles
            cur.execute('''
            CREATE TABLE IF NOT EXISTS student_profiles (
                phone_or_email TEXT PRIMARY KEY,
                name TEXT,
                major TEXT,
                school TEXT,
                year TEXT,
                courses_json TEXT,
                past_events_json TEXT,
                clubs_json TEXT,
                interests_json TEXT,
                raw_summary TEXT,
                embedding BLOB,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            ''')

            # 2. Campus Events
            cur.execute('''
            CREATE TABLE IF NOT EXISTS campus_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                date_str TEXT,
                location TEXT,
                description TEXT,
                has_free_food INTEGER DEFAULT 0,
                tags_json TEXT,
                embedding BLOB
            )
            ''')

            # 3. Campus Clubs (RSOs)
            cur.execute('''
            CREATE TABLE IF NOT EXISTS campus_clubs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                category TEXT,
                description TEXT,
                meeting_times TEXT,
                embedding BLOB
            )
            ''')

            # 4. Proactive Sent Recommendations Log (Dedup)
            cur.execute('''
            CREATE TABLE IF NOT EXISTS sent_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_or_email TEXT NOT NULL,
                event_id INTEGER NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(phone_or_email, event_id)
            )
            ''')

            # Unique index on campus_events for upsert deduplication
            cur.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_events_title_date ON campus_events(title, date_str)
            ''')

            conn.commit()
        finally:
            conn.close()

    def save_student_profile(self, phone_or_email: str, profile: Dict[str, Any]):
        """Saves or updates a student profile with semantic embedding."""
        name = profile.get("name", "Trojan")
        major = profile.get("major", "Computer Science")
        school = profile.get("school", "USC Viterbi")
        year = profile.get("year", "Student")
        courses = json.dumps(profile.get("courses", []))
        past_events = json.dumps(profile.get("past_events", []))
        clubs = json.dumps(profile.get("clubs", []))
        interests = json.dumps(profile.get("interests", []))
        raw_summary = profile.get("raw_summary", "")

        semantic_text = f"{name} {major} {school} {year} {courses} {clubs} {interests} {raw_summary}"
        embedding = compute_text_embedding(semantic_text)

        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
            INSERT INTO student_profiles (
                phone_or_email, name, major, school, year,
                courses_json, past_events_json, clubs_json, interests_json,
                raw_summary, embedding, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(phone_or_email) DO UPDATE SET
                name=excluded.name,
                major=excluded.major,
                school=excluded.school,
                year=excluded.year,
                courses_json=excluded.courses_json,
                past_events_json=excluded.past_events_json,
                clubs_json=excluded.clubs_json,
                interests_json=excluded.interests_json,
                raw_summary=excluded.raw_summary,
                embedding=excluded.embedding,
                updated_at=CURRENT_TIMESTAMP
            ''', (phone_or_email, name, major, school, year, courses, past_events, clubs, interests, raw_summary, embedding))
            conn.commit()
        finally:
            conn.close()

    def get_student_profile(self, phone_or_email: str) -> Optional[Dict[str, Any]]:
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
            SELECT name, major, school, year, courses_json, past_events_json, clubs_json, interests_json, raw_summary
            FROM student_profiles
            WHERE phone_or_email = ?
            ''', (phone_or_email,))
            row = cur.fetchone()
            if not row:
                return None
            return {
                "name": row[0],
                "major": row[1],
                "school": row[2],
                "year": row[3],
                "courses": json.loads(row[4] or "[]"),
                "past_events": json.loads(row[5] or "[]"),
                "clubs": json.loads(row[6] or "[]"),
                "interests": json.loads(row[7] or "[]"),
                "raw_summary": row[8],
            }
        finally:
            conn.close()

    def upsert_event(
        self,
        title: str,
        date_str: str,
        location: str,
        description: str,
        has_free_food: bool = False,
        tags: Optional[List[str]] = None
    ) -> int:
        """Upserts a campus event with deterministic sub-word embedding vector."""
        tags_json = json.dumps(tags or [])
        text = f"{title} {description} {location} {tags_json}"
        embedding = compute_text_embedding(text)
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
            INSERT INTO campus_events (title, date_str, location, description, has_free_food, tags_json, embedding)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(title, date_str) DO UPDATE SET
                location=excluded.location,
                description=excluded.description,
                has_free_food=excluded.has_free_food,
                tags_json=excluded.tags_json,
                embedding=excluded.embedding
            ''', (title, date_str, location, description, int(has_free_food), tags_json, embedding))
            conn.commit()

            cur.execute('SELECT id FROM campus_events WHERE title = ? AND date_str = ?', (title, date_str))
            row = cur.fetchone()
            return row[0] if row else 0
        finally:
            conn.close()

    def add_event(self, title: str, date_str: str, location: str, description: str, has_free_food: bool = False, tags: Optional[List[str]] = None):
        return self.upsert_event(title, date_str, location, description, has_free_food, tags)

    def add_club(self, name: str, category: str, description: str, meeting_times: str = ""):
        text = f"{name} {category} {description}"
        embedding = compute_text_embedding(text)
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
            INSERT INTO campus_clubs (name, category, description, meeting_times, embedding)
            VALUES (?, ?, ?, ?, ?)
            ''', (name, category, description, meeting_times, embedding))
            conn.commit()
        finally:
            conn.close()

    def search_events(self, query: str, free_food_only: bool = False, top_k: int = 4) -> List[Dict[str, Any]]:
        query_vec = compute_text_embedding(query)
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            if free_food_only:
                cur.execute('''
                SELECT id, title, date_str, location, description, has_free_food, tags_json,
                       cosine_sim(embedding, ?) AS score
                FROM campus_events
                WHERE has_free_food = 1
                ORDER BY score DESC LIMIT ?
                ''', (query_vec, top_k))
            else:
                cur.execute('''
                SELECT id, title, date_str, location, description, has_free_food, tags_json,
                       cosine_sim(embedding, ?) AS score
                FROM campus_events
                ORDER BY score DESC LIMIT ?
                ''', (query_vec, top_k))
            
            rows = cur.fetchall()
            return [
                {
                    "title": r[1],
                    "date": r[2],
                    "location": r[3],
                    "description": r[4],
                    "has_free_food": bool(r[5]),
                    "tags": json.loads(r[6] or "[]"),
                    "match_score": round(r[7], 3)
                }
                for r in rows
            ]
        finally:
            conn.close()

    def search_clubs(self, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        query_vec = compute_text_embedding(query)
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
            SELECT id, name, category, description, meeting_times,
                   cosine_sim(embedding, ?) AS score
            FROM campus_clubs
            ORDER BY score DESC LIMIT ?
            ''', (query_vec, top_k))
            rows = cur.fetchall()
            return [
                {
                    "name": r[1],
                    "category": r[2],
                    "description": r[3],
                    "meeting_times": r[4],
                    "match_score": round(r[5], 3)
                }
                for r in rows
            ]
        finally:
            conn.close()

    def record_recommendation(self, phone_or_email: str, event_id: int):
        """Records that an event was proactively recommended to a student to prevent duplicate texts."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
            INSERT INTO sent_recommendations (phone_or_email, event_id)
            VALUES (?, ?)
            ON CONFLICT(phone_or_email, event_id) DO NOTHING
            ''', (phone_or_email.strip().lower(), event_id))
            conn.commit()
        finally:
            conn.close()

    def has_been_recommended(self, phone_or_email: str, event_id: int) -> bool:
        """Checks if a recommendation has already been sent to this student."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('''
            SELECT 1 FROM sent_recommendations
            WHERE phone_or_email = ? AND event_id = ?
            ''', (phone_or_email.strip().lower(), event_id))
            return cur.fetchone() is not None
        finally:
            conn.close()

    def list_all_students(self) -> List[Dict[str, Any]]:
        """Returns all registered student profiles."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('SELECT phone_or_email, name, major, school, year FROM student_profiles')
            rows = cur.fetchall()
            return [
                {
                    "phone_or_email": r[0],
                    "name": r[1],
                    "major": r[2],
                    "school": r[3],
                    "year": r[4],
                }
                for r in rows
            ]
        finally:
            conn.close()

    def get_unnotified_events_for_student(
        self,
        phone_or_email: str,
        min_similarity: float = 0.48,
        limit: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Finds campus events that strongly align with the student's profile embedding
        and interest signals, and have NOT yet been recommended to this student.
        """
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            norm_id = phone_or_email.strip().lower()

            cur.execute('''
            SELECT embedding, courses_json, clubs_json, interests_json, major
            FROM student_profiles
            WHERE LOWER(phone_or_email) = ?
            ''', (norm_id,))
            prof_row = cur.fetchone()
            if not prof_row or not prof_row[0]:
                return []

            student_vec = prof_row[0]
            courses = json.loads(prof_row[1] or "[]")
            clubs = json.loads(prof_row[2] or "[]")
            interests = json.loads(prof_row[3] or "[]")
            major = prof_row[4] or ""

            # High-priority student signal buckets
            course_terms = [c.lower() for c in courses]
            club_terms = [cl.lower() for cl in clubs]
            interest_terms = [i.lower() for i in interests]

            # Stop words that should NEVER be matched as standalone single words
            GENERIC_STOPWORDS = {
                "information", "systems", "system", "science", "engineering", "study",
                "studies", "and", "the", "for", "with", "from", "this", "that", "all",
                "you", "usc", "food", "free", "general", "department", "school"
            }

            cur.execute('''
            SELECT id, title, date_str, location, description, has_free_food, tags_json,
                   cosine_sim(embedding, ?) AS score
            FROM campus_events
            WHERE id NOT IN (
                SELECT event_id FROM sent_recommendations WHERE LOWER(phone_or_email) = ?
            )
            ''', (student_vec, norm_id))

            rows = cur.fetchall()
            scored_candidates = []
            for r in rows:
                title, date_str, location, desc, has_food, tags_raw, base_sim = r[1], r[2], r[3], r[4], bool(r[5]), r[6], r[7]
                ev_full = f"{title} {desc} {tags_raw}".lower()

                reasons: List[str] = []
                score = 0.0

                # 1. Course signal match (phrase-level & course codes)
                for c in course_terms:
                    # Clean course code (e.g., 'cs 572', 'cs 402')
                    code_m = re.findall(r'\b(?:cs|csci|ee|ise|dsci)\s*\d{3}\b', c)
                    for code in code_m:
                        if re.search(r'\b' + re.escape(code) + r'\b', ev_full):
                            score += 0.5
                            reasons.append(f"Course: {code.upper()}")

                    # Compound topic phrases (skip generic single words)
                    clean_c = c.split(":", 1)[-1].strip() if ":" in c else c
                    phrases = [
                        p.strip() for p in re.split(r'[,;&]|\band\b', clean_c)
                        if len(p.strip()) >= 5 and p.strip() not in GENERIC_STOPWORDS
                    ]
                    for phrase in phrases:
                        if phrase in ev_full or re.search(r'\b' + re.escape(phrase) + r'\b', ev_full):
                            score += 0.45
                            reasons.append(f"Course Topic: {phrase}")

                # 2. Club signal match
                for cl in club_terms:
                    # Clean acronyms from original club string (e.g., SHPE, VGSA, AI@USC)
                    clean_cl = re.sub(r'\(.*?\)', '', cl).strip().lower()
                    if len(clean_cl) >= 4 and clean_cl not in GENERIC_STOPWORDS:
                        if clean_cl in ev_full or re.search(r'\b' + re.escape(clean_cl) + r'\b', ev_full):
                            score += 0.45
                            reasons.append(f"Club: {clean_cl}")

                # 3. Interest topics & Tech signals
                interest_signals = [
                    ("harman polymathic", ["harman academy", "polymathic", "harman fellow"]),
                    ("shpe / hispanic engineers", ["shpe", "hispanic professional engineers"]),
                    ("ai & autonomous agents", ["autonomous agents", "artificial intelligence", "machine learning", "generative ai", "llm"]),
                    ("systems programming", ["operating system", "operating systems", "kernel", "systems programming"]),
                    ("hackathons & makeathons", ["hackathon", "makeathon", "hacksc"]),
                    ("swe & fullstack", ["fullstack", "software engineering", "software engineer", "swe"]),
                    ("free food perks", ["free food", "sweetgreen", "cava", "chick-fil-a", "pizza", "burrito", "donuts", "refreshments"])
                ]

                for label, kws in interest_signals:
                    for kw in kws:
                        if re.search(r'\b' + re.escape(kw) + r'\b', ev_full):
                            score += 0.35
                            reasons.append(f"Interest: {kw}")
                            break

                # General AI acronym
                if re.search(r'\b(ai|ml)\b', ev_full) and not any("ai" in r.lower() for r in reasons):
                    score += 0.3
                    reasons.append("Tech: AI/ML")

                # 4. Free food indicator
                if has_food:
                    score += 0.2
                    if not any("food" in r.lower() or "pizza" in r.lower() for r in reasons):
                        reasons.append("Free Food")

                # Composite score
                composite = (base_sim * 0.2) + score

                if score >= 0.4 or base_sim >= min_similarity:
                    scored_candidates.append({
                        "id": r[0],
                        "title": title,
                        "date": date_str,
                        "location": location,
                        "description": desc,
                        "has_free_food": has_food,
                        "tags": json.loads(tags_raw or "[]"),
                        "match_score": round(composite, 3),
                        "matched_reasons": list(dict.fromkeys(reasons)),
                        "base_similarity": round(base_sim, 3)
                    })

            scored_candidates.sort(key=lambda x: x["match_score"], reverse=True)
            return scored_candidates[:limit]
        finally:
            conn.close()
