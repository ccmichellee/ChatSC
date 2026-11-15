import os
import json
import logging
import urllib.request
import urllib.error
from typing import Optional, List, Dict, Any

from tools import TOOLS_SPEC, execute_tool
from student_memory import MemoryStore

logger = logging.getLogger("llm_client")

DEFAULT_SYSTEM_PROMPT = (
    "You are Tommy, an energetic and knowledgeable AI assistant texting USC students and Trojans over iMessage. "
    "Your mission is to help them navigate USC opportunities, including student clubs (RSOs), campus events, "
    "hackathons (like HackSC), career fairs, workshops, and Trojan life.\n"
    "Tone & Style for iMessage:\n"
    "• Keep replies concise, conversational, and direct (1-3 sentences max).\n"
    "• Be warm, encouraging, and Trojan-spirited (sprinkle in 'Fight On!' or ✌️ naturally).\n"
    "• Schedule Awareness: When recommending an event, pay attention to its schedule availability. If there is a calendar conflict, give a soft heads-up (e.g. 'Heads up: overlaps with [Event], but if you are free...'); if they are free, highlight that their schedule is clear!\n"
    "• Campus Time Zone: All USC campus events and courses are based in Los Angeles Pacific Time (PST).\n"
    "• Mention resources like EngageSC, Trojan Event Services, or campus landmarks when helpful.\n"
    "• Avoid markdown headers, dense bullet lists, or robotic greetings."
)

DEFAULT_BASE_URL = "https://api.meta.ai/v1"

DEFAULT_MODEL = "muse-ember-1.0"

MODEL_ALIASES = {
    "muse ember": "muse-ember-1.0",
    "muse-ember": "muse-ember-1.0",
    "muse ember 1.0": "muse-ember-1.0",
    "muse-ember-1.0": "muse-ember-1.0",
    "muse spark 1.3 contributor": "muse-spark-1.3-contributor",
    "muse spark 1.3": "muse-spark-1.3",
    "llama-3.3-70b": "Llama-3.3-70B-Instruct",
}

def resolve_model_name(name: Optional[str]) -> str:
    if not name:
        return DEFAULT_MODEL
    clean = name.strip()
    return MODEL_ALIASES.get(clean.lower(), clean)


class LlamaClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("LLAMA_API_KEY") or os.getenv("META_API_KEY") or ""
        self.base_url = (base_url or os.getenv("LLAMA_BASE_URL") or os.getenv("META_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        raw_model = model or os.getenv("LLAMA_MODEL") or os.getenv("META_MODEL") or ""
        self.model = resolve_model_name(raw_model)
        self.system_prompt = system_prompt or os.getenv("LLAMA_SYSTEM_PROMPT") or DEFAULT_SYSTEM_PROMPT

    def is_configured(self) -> bool:
        return bool(self.api_key.strip())

    def generate_reply(
        self,
        user_text: str,
        history: Optional[List[Dict[str, str]]] = None,
        current_user: str = "",
        use_tools: bool = True
    ) -> str:
        """
        Agentic execution loop using Meta's Muse Spark / Ember models:
        1. Injects student profile context from memory.
        2. Calls model (with tool definitions if use_tools=True).
        3. Executes tool calls autonomously and loops until a final answer is synthesized.
        """
        if not self.is_configured():
            logger.warning("LLAMA_API_KEY / META_API_KEY is not set.")
            return "⚠️ Meta API key not set. Please export LLAMA_API_KEY='your-key'."

        endpoint = f"{self.base_url}/chat/completions"

        # Build personalized system prompt with student context
        system_content = self.system_prompt
        if current_user:
            try:
                store = MemoryStore()
                profile = store.get_student_profile(current_user)
                if not profile:
                    students = store.list_all_students()
                    if students:
                        profile = store.get_student_profile(students[0]["phone_or_email"])
                if profile:
                    system_content += (
                        f"\n\nStudent Profile Context in Memory:\n"
                        f"• Name: {profile['name']} ({profile['year']}, {profile['school']})\n"
                        f"• Major: {profile['major']}\n"
                        f"• Current Courses: {', '.join(profile['courses'])}\n"
                        f"• Affiliated Clubs: {', '.join(profile['clubs'])}\n"
                        f"• Key Interests: {', '.join(profile['interests'])}\n"
                        f"• Background Summary: {profile['raw_summary']}\n"
                        f"Use this profile context naturally. If you need live event or club details, call the tools!"
                    )
            except Exception as e:
                logger.debug(f"Could not load student profile: {e}")

        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_content}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_text})

        max_hops = 3 if use_tools else 1

        # Multi-turn tool execution loop
        for hop in range(max_hops):
            payload: Dict[str, Any] = {
                "model": self.model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 2500,
            }
            if use_tools:
                payload["tools"] = TOOLS_SPEC

            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                endpoint,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key.strip()}",
                    "User-Agent": "curl/8.7.1",
                },
                method="POST"
            )

            try:
                with urllib.request.urlopen(req, timeout=45) as resp:
                    resp_json = json.loads(resp.read().decode("utf-8"))
                    choice = resp_json["choices"][0]
                    message = choice.get("message", {})
                    tool_calls = message.get("tool_calls")

                    # If model generated tool calls, execute them and continue loop
                    if use_tools and tool_calls:
                        messages.append(message)
                        for tc in tool_calls:
                            func = tc["function"]
                            tool_name = func["name"]
                            tool_args = json.loads(func.get("arguments", "{}"))
                            logger.info(f"🛠️ Agent called tool: {tool_name}({tool_args})")
                            tool_output = execute_tool(tool_name, tool_args, current_user)
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": tool_output
                            })
                        continue

                    # Otherwise, we have the final textual response
                    reply = message.get("content") or ""
                    if not reply.strip():
                        # If reasoning_content contains text, use the final paragraph
                        reasoning = message.get("reasoning_content") or ""
                        if reasoning.strip():
                            reply = reasoning.strip().split("\n\n")[-1]

                    if not reply.strip():
                        finish_reason = choice.get("finish_reason")
                        logger.warning(f"Empty model content (finish_reason={finish_reason}). Synthesizing safe fallback.")

                        # Extract any events from tool calls in conversation history
                        tool_events = []
                        for m in messages:
                            if m.get("role") == "tool":
                                try:
                                    t_data = json.loads(m.get("content", ""))
                                    if isinstance(t_data, list):
                                        for ev in t_data:
                                            if isinstance(ev, dict) and ev.get("title"):
                                                food = " (free food!)" if ev.get("has_free_food") else ""
                                                tool_events.append(f"{ev['title']} ({ev.get('date', '')} @ {ev.get('location', '')}{food})")
                                except Exception:
                                    pass

                        if tool_events:
                            return f"Hey! Here are a couple campus events coming up next week: {' and '.join(tool_events[:2])}. Let me know if you want RSVP links or details! Fight On! ✌️"
                        else:
                            return "Hey! I'm checking campus events and club meetings for you right now. Let me know what kinds of workshops or hackathons you're looking for! Fight On! ✌️"

                    return reply.strip()

            except urllib.error.HTTPError as e:
                error_body = e.read().decode("utf-8", errors="ignore")
                logger.error(f"Meta Llama API HTTP {e.code}: {error_body}")
                return f"⚠️ Meta API Error ({e.code}): {e.reason}"
            except urllib.error.URLError as e:
                logger.error(f"Meta Llama API network error: {e}")
                return "⚠️ Network error connecting to Meta API."
            except Exception as e:
                logger.error(f"Unexpected error in Meta Llama API: {e}")
                return f"⚠️ Error: {str(e)}"

        return "Hey! I looked up a few campus opportunities for you. Let me know if you want to explore more hackathons, clubs, or tech events! Fight On! ✌️"
