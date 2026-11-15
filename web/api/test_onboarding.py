"""Session-scoped onboarding persistence and verification-boundary checks."""
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException, Request, Response
from pydantic import ValidationError
from student_memory import MemoryStore
from web.api import main


def request_with_cookie(cookie=""):
    headers = [(b"host", b"testserver")]
    if cookie:
        headers.append((b"cookie", cookie.encode()))
    return Request({
        "type": "http", "http_version": "1.1", "method": "POST", "scheme": "https",
        "path": "/api/onboarding", "raw_path": b"/api/onboarding", "query_string": b"",
        "headers": headers, "client": ("127.0.0.1", 8000), "server": ("testserver", 443),
    })


class OnboardingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = MemoryStore(os.path.join(self.temp.name, "onboarding.db"))
        with self.store.get_connection() as conn:
            conn.execute("CREATE TABLE web_sessions (token TEXT PRIMARY KEY, student_key TEXT NOT NULL)")
        self.patch = patch.object(main, "store", self.store)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.addCleanup(self.temp.cleanup)

    def payload(self, **updates):
        values = dict(
            phone="(213) 555-0147", email="Student@USC.edu",
            interests=["AI and data"], goals=["Explore internships and jobs"],
            notes="Beginner-friendly summer opportunities", gmail_consent=True,
            availability=[dict(day=0, start="10:00", end="11:00", title="CSCI 104")],
            frequency="twice-weekly", name="Avery",
        )
        values.update(updates)
        return main.StudentInput(**values)

    def test_profile_persists_preferences_but_never_claims_verification(self):
        response = Response()
        main.onboarding(self.payload(), request_with_cookie(), response)
        cookie = response.headers["set-cookie"].split(";", 1)[0]
        user = main.session_user(request_with_cookie(cookie))
        profile = main.profile_for(user)
        self.assertEqual(profile["email"], "student@usc.edu")
        self.assertEqual(profile["goals"], ["Explore internships and jobs"])
        self.assertEqual(profile["interests"], ["AI and data"])
        self.assertEqual(profile["availability"][0]["start"], "10:00")
        self.assertEqual(profile["frequency"], "twice-weekly")
        self.assertTrue(profile["gmail_consent"])
        self.assertFalse(profile["consent"])
        self.assertFalse(profile["email_verified"])
        self.assertFalse(profile["phone_verified"])
        self.assertNotIn("phone", profile)
        saved = self.store.get_student_profile(user)
        self.assertIn("Explore internships and jobs", saved["interests"])
        self.assertIn("Beginner-friendly summer opportunities", saved["interests"])
        extra = json.loads(saved["raw_summary"])
        self.assertEqual(extra["phone"], "12135550147")
        self.assertFalse(extra["email_verified"])

    def test_rejects_malformed_phone_and_email(self):
        for value in ["letters 2135550147", "+44 2071231234", "1115550100", "2131550100"]:
            with self.subTest(phone=value):
                response = Response()
                with self.assertRaises(HTTPException):
                    main.onboarding(self.payload(phone=value), request_with_cookie(), response)
        for email in ["not-an-address", "student@", "student @usc.edu"]:
            with self.subTest(email=email):
                with self.assertRaises(ValidationError):
                    self.payload(email=email)

    def test_preference_save_does_not_require_messaging_consent(self):
        response = Response()
        main.onboarding(self.payload(), request_with_cookie(), response)
        with self.store.get_connection() as conn:
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM student_profiles").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
