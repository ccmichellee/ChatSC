import os
import sqlite3
import datetime
from typing import Optional, Dict, Any, List

CHAT_DB_PATH = os.path.expanduser("~/Library/Messages/chat.db")
APPLE_EPOCH = datetime.datetime(2001, 1, 1, tzinfo=datetime.timezone.utc).timestamp()

def decode_attributed_body(body_bytes: bytes) -> Optional[str]:
    """
    Extracts plain text from NSAttributedString / typedstream blob
    commonly used in macOS Sonoma and newer.
    """
    if not body_bytes:
        return None
    try:
        idx = body_bytes.find(b"NSString")
        if idx == -1:
            return None
        
        part = body_bytes[idx:]
        p_idx = part.find(b"+")
        if p_idx == -1:
            return None
        
        raw = part[p_idx + 1:]
        end = raw.find(b"\x86")
        if end == -1:
            end = len(raw)
            
        b0 = raw[0]
        if b0 < 0x80:
            text_bytes = raw[1:end]
        elif b0 == 0x81:
            text_bytes = raw[2:end]
        elif b0 == 0x82:
            text_bytes = raw[3:end]
        else:
            text_bytes = raw[1:end]
            
        decoded = text_bytes.decode("utf-8", errors="ignore")
        # Strip object replacement character and extra null bytes
        cleaned = decoded.replace("\ufffc", "").strip("\x00 \t\n\r")
        return cleaned if cleaned else None
    except Exception:
        return None


class IMessageReader:
    def __init__(self, db_path: str = CHAT_DB_PATH):
        self.db_path = db_path

    def get_connection(self) -> sqlite3.Connection:
        # Connect in read-only URI mode to avoid locking chat.db
        uri_path = f"file:{self.db_path}?mode=ro"
        return sqlite3.connect(uri_path, uri=True)

    def get_latest_rowid(self) -> int:
        """Returns the current highest message ROWID."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT MAX(ROWID) FROM message")
            row = cur.fetchone()
            return row[0] if (row and row[0] is not None) else 0
        finally:
            conn.close()

    def get_new_messages(self, after_rowid: int) -> List[Dict[str, Any]]:
        """
        Fetches incoming messages (is_from_me = 0) with ROWID > after_rowid.
        """
        query = """
        SELECT 
            m.ROWID,
            m.is_from_me,
            m.text,
            m.attributedBody,
            m.date,
            m.service,
            h.id AS sender_id,
            c.chat_identifier,
            c.guid AS chat_guid,
            c.style AS chat_style
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE m.ROWID > ?
        ORDER BY m.ROWID ASC
        """
        results = []
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute(query, (after_rowid,))
            rows = cur.fetchall()
        finally:
            conn.close()

        for r in rows:
            (rowid, is_from_me, text, attr_body, date_val, service, sender_id, chat_identifier, chat_guid, chat_style) = r
            
            # Resolve text
            final_text = text
            if not final_text and attr_body:
                final_text = decode_attributed_body(attr_body)

            # Convert Apple nanoseconds to UTC datetime
            timestamp = None
            if date_val:
                try:
                    timestamp = datetime.datetime.fromtimestamp(APPLE_EPOCH + (date_val / 1e9), tz=datetime.timezone.utc)
                except Exception:
                    pass

            is_group = bool(chat_style == 43 or (chat_guid and chat_guid.startswith("any;+;")))
            is_shortcode = bool(sender_id and sender_id.isdigit() and len(sender_id) <= 6)

            results.append({
                "rowid": rowid,
                "is_from_me": bool(is_from_me),
                "text": final_text or "",
                "sender": sender_id or "unknown",
                "chat_identifier": chat_identifier,
                "chat_guid": chat_guid,
                "chat_style": chat_style,
                "is_group": is_group,
                "is_shortcode": is_shortcode,
                "service": service,
                "timestamp": timestamp,
            })

        return results
