import unittest
from imessage_reader import decode_attributed_body, IMessageReader
from imessage_sender import send_message
from bot import build_response, normalize_contact
from llm_client import LlamaClient, resolve_model_name


class TestIMessagePOC(unittest.TestCase):
    def test_model_resolution(self):
        self.assertEqual(resolve_model_name(None), "muse-ember-1.0")
        self.assertEqual(resolve_model_name("Muse Ember"), "muse-ember-1.0")
        self.assertEqual(resolve_model_name("muse-ember-1.0"), "muse-ember-1.0")
        self.assertEqual(resolve_model_name("Muse Spark 1.3 Contributor"), "muse-spark-1.3-contributor")

    def test_llama_client_unconfigured(self):
        client = LlamaClient(api_key="")
        self.assertFalse(client.is_configured())
        self.assertIn("USC", client.system_prompt)
        self.assertIn("HackSC", client.system_prompt)
        reply = client.generate_reply("hello")
        self.assertIn("Meta API key not set", reply)

    def test_llama_client_configured(self):
        client = LlamaClient(api_key="test-key-123")
        self.assertTrue(client.is_configured())

    def test_normalize_contact(self):
        self.assertEqual(normalize_contact("+1 (213) 555-0100"), "+12135550100")
        self.assertEqual(normalize_contact("  TROJAN.STUDENT@USC.EDU  "), "trojan.student@usc.edu")
        self.assertEqual(normalize_contact("+12135550100"), "+12135550100")

    def test_build_response(self):
        self.assertIn("Pong!", build_response("ping"))
        self.assertIn("Pong!", build_response("Ping"))
        self.assertIn("Tommy (USC Agent)", build_response("help"))
        self.assertEqual(build_response("echo hello world"), "Echo: hello world")
        self.assertIn("hey there", build_response("hey there"))

    def test_reader_access(self):
        reader = IMessageReader()
        rowid = reader.get_latest_rowid()
        self.assertIsInstance(rowid, int)
        self.assertGreater(rowid, 0)

    def test_sender_dry_run(self):
        result = send_message("any;-;+1234567890", "test message", dry_run=True)
        self.assertTrue(result)

    def test_decode_attributed_body_empty(self):
        self.assertIsNone(decode_attributed_body(b""))
        self.assertIsNone(decode_attributed_body(None))

    def test_event_extraction(self):
        from crawl_usc_events import extract_event_fields
        sample = {
            "event": {
                "title": "AI Workshop with Pizza",
                "first_date": "2026-11-20",
                "location_name": "Ginsburg Hall",
                "room_number": "101",
                "description_text": "Come learn autonomous agents! Free pizza and refreshments provided.",
                "filters": {
                    "event_types": [{"name": "Workshop"}],
                    "event_topic": [{"name": "Artificial Intelligence"}]
                }
            }
        }
        res = extract_event_fields(sample)
        self.assertEqual(res["title"], "AI Workshop with Pizza")
        self.assertEqual(res["date_str"], "2026-11-20")
        self.assertEqual(res["location"], "Ginsburg Hall, 101")
        self.assertTrue(res["has_free_food"])
        self.assertIn("Workshop", res["tags"])
        self.assertIn("Artificial Intelligence", res["tags"])

    def test_sent_recommendations_dedup(self):
        from student_memory import MemoryStore
        store = MemoryStore()
        test_user = "test_student_dedup@usc.edu"
        event_id = 99999

        # Clean up before testing
        conn = store.get_connection()
        try:
            conn.execute("DELETE FROM sent_recommendations WHERE phone_or_email = ?", (test_user,))
            conn.commit()
        finally:
            conn.close()

        self.assertFalse(store.has_been_recommended(test_user, event_id))
        store.record_recommendation(test_user, event_id)
        self.assertTrue(store.has_been_recommended(test_user, event_id))

        # Re-recording should not throw error (idempotent)
        store.record_recommendation(test_user, event_id)
        self.assertTrue(store.has_been_recommended(test_user, event_id))

        # Clean up after test
        conn = store.get_connection()
        try:
            conn.execute("DELETE FROM sent_recommendations WHERE phone_or_email = ?", (test_user,))
            conn.commit()
        finally:
            conn.close()

    def test_engagesc_event_extraction(self):
        from crawl_usc_events import extract_engagesc_event_fields
        sample_item = {
            "fields": "date_separator,eventId,eventUid,eventName,eventDates,eventCategory,eventLocation,clubId,clubLogin,clubName,eventAttendees,eventPicture,eventPriceRange,eventButtonLabel,eventBadges,totalTicketsSoldValue,checkbox_id,displayAttendees,eventUrl,displayType,registered,waiting_list,eventTags,coHostId,custom_time_instruction,checkin,registrationStatus,printTicket,eventTimezone,ariaEventDetails,ariaEventDetailsWithLocation,parentEventIds,all_results_hidden,hybrid,eventPhotoDescription,eventFlyerDescription,list_item_acc_label,eventUrlLogo,eventUrlTitle,eventUrlButton,eventUrlLocation,eventNameAccLabel",
            "p0": "false",
            "p1": "415720",
            "p2": "abc123uid",
            "p3": "Chick-fil-A & Color",
            "p4": "<p style='margin:0;'>Sat, Nov 14, 2026</p><p style='margin:0;'>5 PM &ndash; 6 PM</p>",
            "p5": "Social Event / Reception",
            "p6": "Private Location (sign in to display)",
            "p9": "Cowlings and Ilium Residential Colleges",
            "p18": "/rsvp_boot?id=415720",
            "p19": "event",
            "p34": "Chicken sandwiches and coloring books"
        }
        res = extract_engagesc_event_fields(sample_item)
        self.assertIsNotNone(res)
        self.assertEqual(res["title"], "Chick-fil-A & Color")
        self.assertIn("Sat, Nov 14, 2026 5 PM - 6 PM", res["date_str"])
        self.assertTrue(res["has_free_food"])
        self.assertIn("EngageSC", res["tags"])
        self.assertIn("Cowlings and Ilium Residential Colleges", res["tags"])
        self.assertIn("https://engage.usc.edu/rsvp_boot?id=415720", res["description"])

    def test_instagram_event_heuristic_extraction(self):
        from crawl_instagram_events import extract_event_from_caption_heuristic

        # Test valid event caption
        event_caption = (
            "⚡️ HACKSC 2026 KICKOFF! ⚡️\n"
            "Join us this Friday at 6:00 PM in Ginsburg Hall for kickoff and free Sweetgreen dinner! 🥗\n"
            "RSVP link in bio!"
        )
        res = extract_event_from_caption_heuristic(
            caption=event_caption,
            timestamp_str="2026-11-20T18:00:00Z",
            permalink="https://instagram.com/p/test1/",
            club_handle="hackscofficial"
        )
        self.assertIsNotNone(res)
        self.assertIn("hackscofficial", res["title"])
        self.assertEqual(res["location"], "Ginsburg Hall")
        self.assertTrue(res["has_free_food"])
        self.assertIn("Instagram", res["tags"])
        self.assertIn("@hackscofficial", res["tags"])
        self.assertIn("Hackathon", res["tags"])

        # Test non-event post (recap/throwback)
        non_event_caption = "Throwback to our team retreat last weekend! Had so much fun bonding. ✌️❤️"
        res_non = extract_event_from_caption_heuristic(
            caption=non_event_caption,
            timestamp_str="2026-11-20T18:00:00Z",
            permalink="https://instagram.com/p/test2/",
            club_handle="hackscofficial"
        )
        self.assertIsNone(res_non)

    def test_instagram_crawl_mock(self):
        from crawl_instagram_events import crawl_instagram_events
        count = crawl_instagram_events(
            clubs=["hackscofficial", "caisplusplus"],
            mock=True,
            dry_run=True
        )
        self.assertEqual(count, 2)


    def test_calendar_conflict_evaluation(self):
        import datetime
        from calendar_reader import MacCalendarReader, parse_campus_event_interval

        reader = MacCalendarReader(mock=True)
        # Mock student schedule event: Wednesday, Nov 18 from 5 PM to 7:30 PM
        student_events = [
            {
                "calendar": "student@usc.edu",
                "summary": "Thanksgiving Celebration",
                "start_dt": datetime.datetime(2026, 11, 18, 17, 0),
                "end_dt": datetime.datetime(2026, 11, 18, 19, 30),
            }
        ]

        # 1. Direct overlap: Nov 18 @ 6 PM - 8 PM
        eval_conflict = reader.evaluate_conflict("Wed, Nov 18, 2026 6 PM - 8 PM", student_events)
        self.assertTrue(eval_conflict["has_conflict"])
        self.assertEqual(eval_conflict["status"], "conflict")
        self.assertEqual(eval_conflict["conflicting_event"], "Thanksgiving Celebration")

        # 2. Non-overlapping time on same day: Nov 18 @ 12 PM - 1 PM
        eval_free = reader.evaluate_conflict("Wed, Nov 18, 2026 12 PM - 1 PM", student_events)
        self.assertFalse(eval_free["has_conflict"])
        self.assertEqual(eval_free["status"], "free")
        self.assertIn("Thanksgiving Celebration (5:00 PM - 7:30 PM)", eval_free["busy_same_day"])

        # 3. Different day: Nov 19 @ 6 PM - 8 PM
        eval_diff_day = reader.evaluate_conflict("Thu, Nov 19, 2026 6 PM - 8 PM", student_events)
        self.assertFalse(eval_diff_day["has_conflict"])
        self.assertEqual(eval_diff_day["status"], "free")
        self.assertEqual(len(eval_diff_day["busy_same_day"]), 0)


if __name__ == "__main__":
    unittest.main()
