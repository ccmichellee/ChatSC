import subprocess
import logging
from typing import Optional

logger = logging.getLogger("imessage_sender")

APPLESCRIPT_SEND = '''
on run argv
    set target to item 1 of argv
    set msg to item 2 of argv
    tell application "Messages"
        try
            send msg to chat id target
            return "sent_by_chat_id"
        on error
            try
                set targetBuddy to participant target
                send msg to targetBuddy
                return "sent_by_participant"
            on error
                try
                    send msg to buddy target of (1st service whose service type is iMessage)
                    return "sent_by_imessage_buddy"
                on error errMsg
                    error errMsg
                end try
            end try
        end error
    end tell
end run
'''

def send_message(target: str, message: str, dry_run: bool = False) -> bool:
    """
    Sends an iMessage to a target chat GUID or participant phone/email.
    """
    if dry_run:
        logger.info(f"[DRY-RUN] Would send to {target}: {message}")
        return True

    if not target or not message:
        logger.warning("Target or message is empty, skipping.")
        return False

    try:
        cmd = ["osascript", "-e", APPLESCRIPT_SEND, target, message]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        logger.info(f"Successfully sent message to {target} ({result.stdout.strip()})")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to send message to {target}: {e.stderr.strip()}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error while sending to {target}: {e}")
        return False
