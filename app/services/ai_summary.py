"""
Hybrid AI Summary Service
=========================
Primary:  Ollama (local, llama3) — private, no cloud dependency
Fallback: Gemini API (cloud)    — only if Ollama is unreachable

Flow: clean results -> build prompt -> try Ollama -> try Gemini -> return
"""
import os
import json
import hashlib
import logging
import httpx

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
#  Constants / default config
# --------------------------------------------------------------------------- #
OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
GEMINI_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL   = (
    f"https://generativelanguage.googleapis.com/v1beta/models"
    f"/gemini-2.0-flash:generateContent?key={GEMINI_KEY}"
)

TIMEOUT_OLLAMA = 30.0   # local model may need warmup
TIMEOUT_GEMINI = 10.0
MAX_SNIPPET_CHARS = 2400  # keeps token usage efficient

# --------------------------------------------------------------------------- #
#  Prompt builder
# --------------------------------------------------------------------------- #
SUMMARY_PROMPT = """You are a helpful search assistant. Given a user query and top search results, write a precise, accurate, and well-structured summary.

Rules:
- Focus strictly on the query. Do not add unrelated information.
- Format your response EXACTLY like this:
  First, write exactly ONE sentence as the main takeaway or direct answer.
  Then, provide 3 to 4 concise bullet points highlighting key insights, facts, or steps from the results.
- Be factual. Do not invent facts not present in the results.
- Keep tone neutral, professional, and informative.
- Max 150 words total. Do not repeat the query.

Query: {query}

Search Results:
{context}

Summary:"""


def _build_context(results: list) -> str:
    """Extract and clean snippets from result dicts, limited to MAX_SNIPPET_CHARS."""
    lines = []
    total = 0
    for i, r in enumerate(results[:8], 1):
        title   = (r.get("title") or "").strip()
        content = (r.get("content") or r.get("text") or "").strip()
        # take up to 400 chars per snippet
        snippet = content[:400] if content else title
        if not snippet:
            continue
        entry = f"[{i}] {title}: {snippet}"
        if total + len(entry) > MAX_SNIPPET_CHARS:
            break
        lines.append(entry)
        total += len(entry)
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
#  LRU query-level cache (backed by ai_summary_cache module)
# --------------------------------------------------------------------------- #
def _cache_key(query: str) -> str:
    return hashlib.sha256(query.lower().strip().encode()).hexdigest()[:16]


# Simple module-level dict cache (lightweight, no dependency)
_cache: dict = {}
_CACHE_MAX = 64


def _get_cached(key: str):
    return _cache.get(key)


def _set_cached(key: str, value: str):
    if len(_cache) >= _CACHE_MAX:
        # evict oldest (first) key
        oldest = next(iter(_cache))
        del _cache[oldest]
    _cache[key] = value


# --------------------------------------------------------------------------- #
#  Inference backends
# --------------------------------------------------------------------------- #
def _call_ollama(prompt: str) -> str:
    """Call local Ollama API. Raises on any failure."""
    url = f"{OLLAMA_URL}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3, "top_p": 0.9, "num_predict": 350},
    }
    resp = httpx.post(url, json=payload, timeout=TIMEOUT_OLLAMA)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "").strip()


def _call_gemini(prompt: str) -> str:
    """Call Gemini API. Raises on any failure."""
    if not GEMINI_KEY:
        raise ValueError("GEMINI_API_KEY not configured")
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    resp = httpx.post(
        GEMINI_URL,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=TIMEOUT_GEMINI,
    )
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()


# --------------------------------------------------------------------------- #
#  Public interface
# --------------------------------------------------------------------------- #
class HybridSummaryEngine:
    """Local-first summariser: Ollama → Gemini → error message."""

    def generate(self, query: str, results: list) -> dict:
        """
        Returns:
            {
                "summary": str,
                "source":  "ollama" | "gemini" | "error",
                "cached":  bool
            }
        """
        if not query or not results:
            return {"summary": "No results to summarise.", "source": "error", "cached": False}

        key = _cache_key(query)
        cached = _get_cached(key)
        if cached:
            return {"summary": cached, "source": "cache", "cached": True}

        context = _build_context(results)
        if not context:
            return {"summary": "Could not extract content from results.", "source": "error", "cached": False}

        prompt = SUMMARY_PROMPT.format(query=query, context=context)

        # --- Try Ollama first ---
        try:
            summary = _call_ollama(prompt)
            _set_cached(key, summary)
            logger.info("AI summary: Ollama OK for query=%r", query[:60])
            return {"summary": summary, "source": "ollama", "cached": False}
        except Exception as e:
            logger.warning("Ollama unavailable (%s), falling back to Gemini.", e)

        # --- Fallback: Gemini ---
        try:
            summary = _call_gemini(prompt)
            _set_cached(key, summary)
            logger.info("AI summary: Gemini fallback OK for query=%r", query[:60])
            return {"summary": summary, "source": "gemini", "cached": False}
        except Exception as e:
            logger.error("Gemini also failed: %s", e)
            return {
                "summary": "AI summary is temporarily unavailable. Please try again later.",
                "source": "error",
                "cached": False,
            }


# Singleton engine instance
_engine = HybridSummaryEngine()


def get_ai_summary(query: str, results: list) -> str:
    """Backward-compatible helper. Returns plain summary string."""
    result = _engine.generate(query, results)
    return result["summary"]


def get_ai_summary_with_meta(query: str, results: list) -> dict:
    """Full result with source and cache metadata."""
    return _engine.generate(query, results)
