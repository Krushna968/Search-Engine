# AI Summary — Hybrid LLM Architecture

## What Was Built

An **AI-powered search summarizer** integrated into the Whoogle search results page. When a user performs a search, a sidebar card appears offering an on-demand, context-aware summary of the top results.

## How It Works

```
User Search → Search Results Page (immediate)
                  ↓
         User clicks "Generate AI Summary"
                  ↓
         Browser calls /ai_summary endpoint
                  ↓
           ┌──────────────┐
           │  LRU Cache   │ ← Cache hit? Return instantly
           └──────┬───────┘
                  │ Cache miss
                  ↓
         ┌─────────────────────┐
         │  Ollama (LLama 3)   │ ← Local, private, primary
         │  localhost:11434    │
         └────────┬────────────┘
                  │ Fail / timeout
                  ↓
         ┌─────────────────────┐
         │  Gemini 2.0 Flash   │ ← Cloud fallback only
         │  generativelanguage │
         └────────┬────────────┘
                  │
                  ↓
         Summary displayed in sidebar
```

## Models Used

| Model | Role | Location |
|-------|------|----------|
| `llama3` | Primary summarizer | Local (Ollama) |
| `gemini-2.0-flash` | Cloud fallback | Google API |

## Local Setup

### 1. Ensure Ollama is running
```bash
ollama serve
```

### 2. Pull the model (one-time)
```bash
ollama pull llama3
```

### 3. Configure environment (`whoogle.env`)
```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3
GEMINI_API_KEY=<your-key>   # optional cloud fallback
```

### 4. Run the app
```bash
python -m flask run --port 5001
```

## Feature Behavior

- **Generate button**: Summary is not auto-generated; user triggers it. This avoids LLM cost on irrelevant queries.
- **Refresh button**: Forces cache bypass, regenerates summary.
- **Source badge**: Shows whether summary came from Ollama, Gemini, or cache.
- **Loading spinner**: Shown while LLM generates (up to 30s for Ollama, 10s for Gemini).
- **Cache**: LRU cache (64 entries) keyed by SHA-256 of the lowercase query. Same query = instant response.

## Extending for Vision / Multimodal

To add image summarization later:
1. Add `OLLAMA_VISION_MODEL=llava` to env
2. Add a `_call_ollama_vision(prompt, image_b64)` function in `ai_summary.py`
3. Pass image data via a new `/ai_summary_image` endpoint
4. The existing architecture and cache layer remain unchanged

## File Map

| File | Purpose |
|------|---------|
| `app/services/ai_summary.py` | Core HybridSummaryEngine + cache |
| `app/static/js/ai_summary.js` | Async fetch, UI state management |
| `app/routes.py` | `/ai_summary` API endpoint |
| `app/templates/display.html` | Side-panel AI summary card |
| `whoogle.env` | API keys and model config |
