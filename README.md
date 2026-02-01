# Redliner

AI-powered Word document redlining assistant. Ask the agent to review or modify your document — it proposes changes, you approve or reject them, and approved edits are applied with change tracking enabled.

---

## Setup

### Prerequisites

- **Node.js** (18+) and **npm** — for the frontend
- **Python 3.13** and **uv** — for the backend
- **Microsoft Word** (desktop, macOS or Windows) — to sideload and run the add-in

### 1. Backend

```bash
cd backend
cp .env.example .env          # paste your ANTHROPIC_API_KEY into .env
uv sync                       # install dependencies
```

### 2. Frontend

```bash
cd frontend
npm install
```

---

## Running

You need **two terminals** — one for the backend, one for the frontend. Start the frontend first, because it generates the SSL certs the backend reuses.

### Terminal 1 — Frontend

```bash
cd frontend
npm start
```

The webpack dev server starts on `https://localhost:3000` and generates dev certs at `~/.office-addin-dev-certs/`.

### Terminal 2 — Backend

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

## Mock mode (no API key needed)

If you don't have an `ANTHROPIC_API_KEY` yet, you can run the backend in mock mode. It returns a hardcoded SSE response — a short conversational message followed by a proposed replacement on paragraph `p0` — so you can test the full frontend flow (message bubbles, tool badge, modification review, approve/reject) without hitting the Anthropic API.

Start the backend with `MOCK=1`:

```bash
cd backend
MOCK=1 uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload \
  --ssl-keyfile ~/.office-addin-dev-certs/localhost.key \
  --ssl-certfile ~/.office-addin-dev-certs/localhost.crt
```

The frontend needs no changes. Type anything in the taskpane and it will receive the mock response.

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
