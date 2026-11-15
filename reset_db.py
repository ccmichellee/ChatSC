#!/usr/bin/env python3
"""
Quick utility to reset the conversation and recommendation history in memory.db.
Use between demo video recording takes to return Tommy to day-one state.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "memory.db")

def reset_database():
    if not os.path.exists(DB_PATH):
        print(f"⚠️ Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    with conn:
        # Clear recommendation tracking so all campus opportunities are fresh
        deleted = conn.execute("DELETE FROM sent_recommendations").rowcount
        conn.execute("DELETE FROM sqlite_sequence WHERE name = 'sent_recommendations'")

    conn.close()
    print(f"✨ Reset complete! Cleared {deleted} past recommendation record(s).")
    print("   Tommy is now in day-one state with all events fresh and unrecommended.")

if __name__ == "__main__":
    reset_database()
