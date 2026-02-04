# Redliner

AI-powered Word document redlining assistant. Ask the agent to review or modify your document — it proposes changes, you approve or reject them, and approved edits are applied with change tracking enabled.

---

## Setup

### Prerequisites

- **Node.js** (18+) and **npm** — for the frontend
- **Python 3.13** and **uv** — for the backend
- **Microsoft Word** (desktop, macOS or Windows) — to sideload and run the add-in
- **Anthropic Claude API Key** (or OpenAI, Gemini, etc.)

### 1. Backend

```bash
cd backend
cp .env.example .env                                        # Create .env
cp litellm_config.yaml.example litellm_config.yaml          # Create .env
uv sync                                                     # Install dependencies
uv pip install 'litellm[proxy]'                             # Install LiteLLM proxy
```

**Environment Configuration:**

Edit `.env` and configure your LLM API Keys and `LITELLM_MASTER_KEY`
```bash
ANTHROPIC_API_KEY=...
...
# LiteLLM Proxy authentication (must match litellm_config.yaml)
LITELLM_MASTER_KEY=...
```
To add further models, browse the available [LiteLLM model providers](https://models.litellm.ai/) and add them into `litellm_config.yaml`.
Make sure to pull in any additional LLM API Keys from `.env` into `litellm_config.yaml`.

### 2. Frontend

```bash
cd frontend
npm install
```

---

## Running

You need **three terminals** — one for the frontend, one for the proxy, one for the backend. Start the frontend first, because it generates the SSL certs the backend reuses.

### Terminal 1 — Frontend

```bash
cd frontend
npm start
```

The webpack dev server starts on `https://localhost:3000` and generates dev certs at `~/.office-addin-dev-certs/`.

### Terminal 2 — LiteLLM Proxy

```bash
cd backend
./start_proxy.sh
```

The proxy starts on `http://127.0.0.1:4000`. Configure available models in `backend/litellm_config.yaml`.

### Terminal 3 — Backend

```bash
cd backend
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload \
  --ssl-keyfile ~/.office-addin-dev-certs/localhost.key \
  --ssl-certfile ~/.office-addin-dev-certs/localhost.crt
```

The server starts on `https://localhost:8000`.

### Word — Sideload the add-in

1. In Word, go to **Insert → Add-ins → Manage Add-ins → From File**.
2. Select `frontend/manifest.xml`.
3. The "Redliner" taskpane appears on the right side of Word.

---

## Adding New Models

Edit `backend/litellm_config.yaml` and add the model to `model_list`.
Restart the proxy. The new models will automatically appear in the frontend's Settings page — no code changes needed.

---

## Mock mode (no API key needed)

If you don't have an API Key yet, you can run the backend in mock mode. It returns a hardcoded SSE response — a short conversational message followed by a proposed replacement on paragraph `p0` — so you can test the full frontend flow (message bubbles, tool badge, modification review, approve/reject) without hitting the Anthropic API.

Start the backend with `MOCK=1`:

```bash
cd backend
MOCK=1 uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload \
  --ssl-keyfile ~/.office-addin-dev-certs/localhost.key \
  --ssl-certfile ~/.office-addin-dev-certs/localhost.crt
```

The frontend needs no changes. Type anything in the taskpane and it will receive the mock response.

---

## How it works

### Architecture

```text
┌───────────────────────┐
│   Word Add-in (React) │  ← User types message, reviews proposed changes
│   Office.js taskpane  │    GET /models → fetches available models dynamically
└───────────┬───────────┘
            │ HTTPS
            │ POST /invoke (streams SSE)
            │ GET /sessions, GET /models, DELETE /sessions/{id}
┌───────────▼───────────┐
│  FastAPI Backend      │  ← Strands Agent + LiteLLM + in-memory cache
│  (Python, port 8000)  │    FileSessionManager for persistence
└───────────┬───────────┘
            │ HTTP
            │ /model/info (fetch catalog)
┌───────────▼───────────┐
│  LiteLLM Proxy        │  ← Model router, cost tracking, rate limits
│  (port 4000)          │    Configured via litellm_config.yaml
└───────────┬───────────┘
            │ HTTPS (to various providers)
┌───────────▼───────────┐
│   Model Providers     │  ← Anthropic, OpenAI, Gemini, Bedrock, etc.
│   (Claude, GPT, etc.) │    LiteLLM handles unified API interface
└───────────────────────┘
```

### Data flow (one request)

1. **User sends message** → Frontend extracts Word paragraphs (`p0`, `p1`, `p2`...), computes MD5 hash, wraps user input + doc in XML tags
2. **POST /invoke** → Backend looks up or creates Agent for session ID, calls `agent.stream(prompt)`
3. **Agent streams events** → Backend filters Strands events, emits SSE: `content` (text chunks), `tool_use` (badge), `microsoft_actions` (proposed changes), `end_turn`
4. **Frontend renders** → Text appends to assistant bubble, actions populate ModificationReview panel
5. **User clicks Apply** → Frontend re-reads doc, checks hash, executes selected actions via Office.js with change tracking on
6. **Word shows redlines** → Approved changes appear as tracked changes in the document

### microsoft_actions tool format

The agent calls `microsoft_actions_tool` with JSON. Each action:

```json
{
  "task": "Brief description",   // Short description shown to user
  "action": "replace",            // replace | append | delete | highlight | format_bold | format_italic | strikethrough | delete_row | insert_row
  "loc": "p3",                    // paragraph index (p0, p1, p2...) or table cell (t0.r1.c0.p0) or table row (t0.r1)
  "new_text": "Updated text.",    // required for replace/append, omitted for delete/formatting
  "rowData": [["col1", "col2"]]   // optional for insert_row: array of rows, each row is array of cell contents
}
```

**Example multi-action payload:**

```json
{
  "modifications": [
    {
      "task": "Update document title",
      "action": "replace",
      "loc": "p0",
      "new_text": "Confidentiality Agreement"
    },
    {
      "task": "Highlight vague term",
      "action": "highlight",
      "loc": "p5"
    },
    {
      "task": "Remove obsolete clause",
      "action": "delete",
      "loc": "p8"
    }
  ]
}
```

Actions support **table cells**, **within-paragraph edits** via `withinPara: {find: str, occurrence: int}`, and **row operations** (see Features section below for details).

---

## Debugging

### Backend logs

Logs are written to `backend/.logs/redliner.log` (not the terminal). Open it in any text editor or tail it:

```bash
tail -f backend/.logs/redliner.log
```

### Frontend (Word taskpane) DevTools

1. Follow the instructions [here](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/debug-add-ins-overview#debug-on-windows)
2. Right-click the Word-Addin and click **Inspect Element**

---

## Features

### Table-Aware Context

Redliner represents Word tables explicitly in the document context sent to the agent:

```text
p0: Introduction text
t0: [Table]
t0.r0.c0.p0: Header cell 1
t0.r0.c1.p0: Header cell 2
t0.r1.c0.p0: Data cell 1
t0.r1.c1.p0: Data cell 2
p5: Text after table
```

**Paragraph Numbering:** Regular paragraphs are numbered by their global position in the document. In the example above, `p0` is at position 0, the table cells occupy positions 1-4, so `p5` is the next paragraph at position 5.

**Cell Paragraphs:** The `p` in `t{n}.r{r}.c{c}.p{p}` represents the paragraph index within that specific cell (starting from 0 for each cell).

This allows the agent to:

- Understand table structure
- Modify specific cells
- Insert or delete entire rows
- Apply formatting to table content

### Within-Paragraph Edits

The agent can target specific text within paragraphs instead of replacing entire paragraphs:

```json
{
  "action": "replace",
  "loc": "p5",
  "new_text": "Section 3.2",
  "withinPara": {
    "find": "Section 3.1",
    "occurrence": 0
  }
}
```

This enables surgical edits like:

- Correcting cross-references
- Updating specific terms
- Formatting individual words or phrases

### Row-Level Operations

The agent can insert or delete entire table rows:

```json
{
  "task": "Remove obsolete data",
  "action": "delete_row",
  "loc": "t0.r2"
}

{
  "task": "Add missing row after header",
  "action": "insert_row",
  "loc": "t0.r0",
  "rowData": [["New cell 1", "New cell 2"]]
}
```