import argparse
import logging
import signal
import sys
import time
from typing import List, Optional

from imessage_reader import IMessageReader
from imessage_sender import send_message
from llm_client import LlamaClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("bot")


def normalize_contact(c: str) -> str:
    """Normalizes phone numbers and emails for strict whitelist matching."""
    if not c:
        return ""
    c = c.strip().lower()
    if "@" in c:
        return c
    digits = "".join(ch for ch in c if ch.isdigit() or ch == "+")
    return digits


def build_response(user_text: str, llama: Optional[LlamaClient] = None, current_user: str = "") -> str:
    """
    Generates response using Meta's Muse Spark 1.3 agent loop (with quick local fallback rules).
    """
    clean_text = user_text.strip()
    lower_text = clean_text.lower()

    if lower_text == "ping":
        return "Pong! 🏓 (iMessage Bot is online)"
    elif lower_text == "help":
        return "🤖 Tommy (USC Agent):\n• 'ping' - checks status\n• Ask about events, hackathons, clubs, or free food on campus!"
    elif lower_text.startswith("echo "):
        return f"Echo: {clean_text[5:].strip()}"

    if llama and llama.is_configured():
        return llama.generate_reply(clean_text, current_user=current_user)

    return f"Echo (Meta API key not configured): {clean_text}"


def main():
    parser = argparse.ArgumentParser(description="Local iMessage Chatbot POC")
    parser.add_argument(
        "--api-key",
        type=str,
        default="",
        help="Meta Llama API key (defaults to LLAMA_API_KEY or META_API_KEY env var)."
    )
    parser.add_argument(
        "--model",
        type=str,
        default="",
        help="Model name (defaults to LLAMA_MODEL env var or 'muse-ember-1.0')."
    )
    parser.add_argument(
        "--system-prompt",
        type=str,
        default="",
        help="Custom system prompt to guide the AI persona (defaults to USC Opportunities Navigator)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate sending without invoking AppleScript to actually deliver messages."
    )
    parser.add_argument(
        "--allow-self",
        action="store_true",
        help="Allow testing by texting yourself from your own iPhone/Apple ID."
    )
    parser.add_argument(
        "--allow-all-senders",
        action="store_true",
        help="Explicitly allow bot to reply to anyone (use with extreme caution!)."
    )
    parser.add_argument(
        "--whitelist",
        type=str,
        default="",
        help="Comma-separated phone numbers or emails allowed to interact with the bot (e.g., '+12135550100,user@icloud.com')."
    )
    parser.add_argument(
        "--trigger",
        type=str,
        default="",
        help="Optional prefix required to trigger the bot (e.g., '!bot' or '/ai'). Leave empty to respond to all incoming messages."
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=1.0,
        help="Polling interval in seconds (default: 1.0)."
    )
    parser.add_argument(
        "--bot-prefix",
        type=str,
        default="🤖 ",
        help="Prefix added to bot messages (prevents loopbacks and identifies the bot)."
    )
    args = parser.parse_args()

    whitelist: List[str] = [normalize_contact(w) for w in args.whitelist.split(",") if w.strip()]
    trigger_prefix: str = args.trigger.strip().lower()
    bot_prefix: str = args.bot_prefix

    # Initialize Meta Llama client
    llama = LlamaClient(
        api_key=args.api_key or None,
        model=args.model or None,
        system_prompt=args.system_prompt or None,
    )

    # Live-mode safety guardrail:
    if not args.dry_run and not whitelist and not args.allow_all_senders:
        logger.error(
            "🛑 SAFETY SHIELD ACTIVE: Running in LIVE mode without a whitelist could cause the bot to reply to other conversations or 2FA messages.\n"
            "   Please provide a whitelist, e.g.:\n"
            "   python3 bot.py --allow-self --whitelist '+12135550100,student@usc.edu'\n"
            "   (Or explicitly pass --allow-all-senders if intentionally open)."
        )
        sys.exit(1)

    reader = IMessageReader()

    # Get current latest message so we only respond to new incoming messages
    latest_rowid = reader.get_latest_rowid()

    logger.info("==================================================")
    logger.info("🚀 iMessage Chatbot POC initialized")
    logger.info(f"   Database: {reader.db_path}")
    logger.info(f"   Starting from ROWID: {latest_rowid}")
    logger.info(f"   Mode: {'[DRY RUN]' if args.dry_run else '[LIVE SENDING]'}")
    logger.info(f"   LLM: Meta Llama API (Model: {llama.model}, Configured: {llama.is_configured()})")
    if not llama.is_configured():
        logger.info("   💡 Note: LLAMA_API_KEY not set. Set export LLAMA_API_KEY='...' or pass --api-key.")
    logger.info(f"   Trigger Prefix: '{trigger_prefix or '(none - all messages in whitelist)'}'")
    logger.info(f"   Isolated Whitelist: {whitelist if whitelist else '(all senders allowed)'}")
    logger.info(f"   Safeguards: Group Chats BLOCKED | 2FA Shortcodes BLOCKED")
    logger.info("   Press Ctrl+C to stop.")
    logger.info("==================================================")

    def handle_shutdown(signum, frame):
        logger.info("\nShutting down bot. Goodbye!")
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    current_rowid = latest_rowid

    while True:
        try:
            new_msgs = reader.get_new_messages(current_rowid)
            for msg in new_msgs:
                rowid = msg["rowid"]
                current_rowid = max(current_rowid, rowid)

                # 1. Automatic Group Chat Safeguard
                if msg.get("is_group"):
                    logger.debug(f"Blocked group chat message (row {rowid})")
                    continue

                # 2. Automatic Shortcode Safeguard (2FA, automated promo SMS)
                if msg.get("is_shortcode"):
                    logger.debug(f"Blocked automated shortcode (row {rowid}, sender {msg.get('sender')})")
                    continue

                # 3. Host message filtering
                if msg["is_from_me"] and not args.allow_self:
                    continue

                text = msg["text"].strip()
                sender = normalize_contact(msg["sender"])
                chat_id = normalize_contact(msg.get("chat_identifier") or "")
                chat_target = msg["chat_guid"] or msg["sender"]

                # 4. Skip empty messages or messages already prefixed with bot marker
                if not text:
                    continue
                if bot_prefix and text.startswith(bot_prefix.strip()):
                    continue

                # 5. Strict Whitelist & Chat Isolation Safeguard
                # Both sender and chat_identifier must match the whitelist if configured.
                # If you text a friend (+1555...), chat_id is +1555..., so it is 100% BLOCKED.
                if whitelist:
                    sender_allowed = sender in whitelist
                    chat_allowed = chat_id in whitelist if chat_id else False
                    if not (sender_allowed or chat_allowed):
                        logger.debug(f"Blocked non-whitelisted message: sender={sender} chat={chat_id}")
                        continue
                    if msg["is_from_me"] and not chat_allowed:
                        logger.debug(f"Blocked host message to non-whitelisted recipient: chat={chat_id}")
                        continue

                # 6. Check trigger prefix if configured
                user_content = text
                if trigger_prefix:
                    if not text.lower().startswith(trigger_prefix):
                        continue
                    # Strip trigger prefix
                    user_content = text[len(trigger_prefix):].strip()

                logger.info(f"📩 Received from {msg['sender']}: \"{text}\"")

                # Generate reply
                reply_body = build_response(user_content, llama=llama, current_user=msg['sender'])
                final_reply = f"{bot_prefix}{reply_body}"

                # Send reply
                logger.info(f"📤 Replying to {msg['sender']}: \"{final_reply}\"")
                send_message(chat_target, final_reply, dry_run=args.dry_run)

            time.sleep(args.poll_interval)
        except Exception as e:
            logger.error(f"Error in main polling loop: {e}", exc_info=True)
            time.sleep(args.poll_interval)


if __name__ == "__main__":
    main()
