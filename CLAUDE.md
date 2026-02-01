# Redliner — AI-Powered Word Document Redlining Assistant

## What this is

A Microsoft Word add-in that lets users ask an AI agent to review, modify, and redline documents via natural language. The agent streams responses back as SSE, including structured `microsoft_actions` events that the frontend renders as reviewable proposed changes. The user approves or rejects each change; approved changes execute against the Word document via Office JS with change tracking enabled.

---

## Project Structure

```text
redliner/
├── CLAUDE.md                   # This file — project spec for Claude Code
├── backend/                    # Python FastAPI server (uv project, Python 3.13)
│   ├── pyproject.toml          # uv project manifest
│   ├── .env                    # Anthropic API key (gitignored, see .env.example)
│   ├── .env.example            # Placeholder showing required env vars
│   ├── main.py                 # FastAPI app — routes, agent cache, SSE streaming
│   ├── agent/                  # Agent logic
│   │   ├── prompts.py          # System prompt for the redliner agent
│   │   └── utils.py            # Unicode placeholder conversion, thinking-tag stripping
│   └── sessions/               # FileSessionManager writes here (gitignored)
├── frontend/                   # Word add-in (React + TypeScript, webpack, Office JS)
│   ├── package.json
│   ├── webpack.config.js       # ts-loader for .tsx/.ts, babel-loader only for polyfill .js entry
│   ├── tsconfig.json           # strict mode, jsx: react, target es2017
│   ├── manifest.xml            # Office add-in manifest (points to localhost:3000)
│   ├── src/
│   │   └── taskpane/
│   │       ├── taskpane.html   # Shell page loaded by Word
│   │       ├── styles.css      # Global styles (layout, bubbles, mod-review, input)
│   │       ├── index.tsx       # React entry — Office.onReady, mounts App
│   │       ├── taskpane.ts     # Word document I/O (paragraph mapping, action execution)
│   │       ├── components/
│   │       │   ├── App.tsx           # Root — no auth, renders ChatInterface directly
│   │       │   ├── ChatInterface.tsx # State orchestration: messages, pending actions, send flow
│   │       │   ├── ChatInput.tsx     # Prompt textarea + send button
│   │       │   ├── ChatMessageList.tsx # Renders message bubbles, tool badges, ModificationReview
│   │       │   ├── ModificationReview.tsx # Expandable approve/reject UI for proposed changes
│   │       │   └── useChatAPI.ts     # Hook — POST to localhost backend, parses SSE stream
│   │       └── microsoft-actions/    # One file per Word action type
│   │           ├── replace.ts
│   │           ├── append.ts
│   │           ├── prepend.ts
│   │           ├── delete.ts
│   │           ├── highlight.ts
│   │           ├── format_bold.ts
│   │           ├── format_italic.ts
│   │           └── strikethrough.ts
└── sample/                     # Reference implementation (AWS version) — read-only, do not modify
```

---

## Running Locally

### Backend

```bash
cd backend
cp .env.example .env          # Add your ANTHROPIC_API_KEY
uv sync                       # Install deps
uv run uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The server runs on `http://127.0.0.1:8000`. The single route is `POST /invoke`.

### Frontend

```bash
cd frontend
npm install
npm run dev-server            # webpack dev server on https://localhost:3000
```

Then sideload the Word add-in using `manifest.xml` in desktop Word.

---

## Architecture Decisions

### No AWS, no auth

The sample uses Cognito for authentication and AgentCore Runtime as the hosted agent endpoint. We've removed both. The frontend talks directly to the local FastAPI server. No bearer tokens, no user pool. `App.jsx` renders `ChatInterface` unconditionally.

### Anthropic model via Strands

Instead of `BedrockModel`, we use `AnthropicModel` from `strands-agents[anthropic]`. The API key comes from the `ANTHROPIC_API_KEY` env var, loaded via `python-dotenv`. The model instance is created once at module level — it's stateless (just a client wrapper).

### Session management: in-memory cache + FileSessionManager

Two-layer design:

1. **In-memory cache** (`_agent_cache: dict[str, Agent]`): the fast path. Each session ID maps to an `Agent` instance. Subsequent requests for the same session reuse it directly — no disk I/O, conversation history already loaded.

2. **FileSessionManager** (backing store): each Agent is constructed with a `FileSessionManager(session_id=X, storage_dir="sessions/")`. Strands automatically persists conversation state to disk after each invocation. If the process restarts, the cache is empty, but when the next request arrives for that session the `FileSessionManager` restores the full history from disk during agent construction.

The session ID is sent by the frontend in the `x-session-id` request header. The frontend generates it once on mount (`crypto.randomUUID()`).

### No knowledge base, no KB options

The sample's `knowledge_agent` tool and `kb_retrieve` tool performed vector search against a Bedrock Knowledge Base. Both are removed. The agent has a single tool: `microsoft_actions_tool`.

Consequences flowing from this:

- The prompt (`prompts.py`) has no KB scenarios. Only: converse-only, modify-only, and mixed (converse + modify). No `kb_options` field in the `microsoft_actions` JSON schema.
- The prompt examples that involved KB (examples 2, 4, 6 from the sample) are removed.
- `KBOptions.jsx` is removed entirely.
- `ChatMessageList.jsx` and `ModificationReview.jsx` have no `kb_options` branching — actions either have `new_text` or they don't.
- The `action: "none"` case (converse-only KB response) no longer exists. If the agent is just conversing, it does not call `microsoft_actions_tool` at all.

### SSE event filtering (critical)

The backend's streaming generator does NOT pass raw Strands events to the frontend. It filters and transforms them into four distinct event types the frontend understands:

| Event type | When emitted | Frontend effect |
| --- | --- | --- |
| `content` | Text chunks from the agent (batched in groups of 3) | Appended to the current assistant message bubble |
| `tool_use` | A tool invocation starts | Renders a tool-use badge in the chat |
| `microsoft_actions` | The agent called `microsoft_actions_tool` — the tool input is parsed as JSON | Triggers the `ModificationReview` UI |
| `end_turn` | The model's stop reason is `end_turn` | Clears the loading state |

This filtering is the same logic as the sample's `agent_invocation` generator, just running in a FastAPI `StreamingResponse` async generator instead of a `BedrockAgentCoreApp` entrypoint.

### Plain CSS instead of CloudScape

All CloudScape imports are removed. The UI is styled with a single `styles.css` file — no component library, no Tailwind, no PostCSS pipeline. This keeps webpack config simple (just `style-loader` + `css-loader`) and avoids pulling in a heavy design system for a taskpane add-in. The styling covers: layout, chat bubbles (user/assistant), tool badges, loading indicator, the chat input textarea + send button, and the modification review panel (expandable header, per-modification checkboxes and expand/collapse).

### microsoft-actions/ typed

The eight Word action modules (`replace`, `append`, `prepend`, `delete`, `highlight`, `format_bold`, `format_italic`, `strikethrough`) and `taskpane.ts` are ported from the sample with TypeScript types added. Each action module declares a `MicrosoftAction` interface and types its `context`/`paragraphs` parameters against the Office JS typings (`Word.RequestContext`, `Word.ParagraphCollection`). The logic is identical to the sample — they use Office JS directly with no external dependencies. The sample's `microsoft-actions/utils.js` (`renderTextWithLineBreaks`) is removed; it was only used for KB options rendering which no longer exists.

---

## Security

This is a local dev tool, but that doesn't mean "anything goes" on the network side. These rules must be followed when writing backend or frontend code:

- **Bind to 127.0.0.1 only.** The FastAPI server must listen on `127.0.0.1`, never `0.0.0.0`. It has no authentication — binding to all interfaces would expose the agent (and whatever documents get sent to it) to anything on the local network. The run command in this spec uses `--host 127.0.0.1` explicitly; do not change this.
- **Never commit the API key.** `ANTHROPIC_API_KEY` lives in `.env`, which is gitignored. The `.env.example` file ships with a placeholder value only. No code should hardcode or log the key.
- **Don't log request bodies.** The request body contains the full Word document content. Log at INFO level for flow tracing (e.g. input lengths, event types) but never the full document text or user input.
- **CORS is localhost-only.** The webpack dev server already sets `Access-Control-Allow-Origin: *` for the Office JS iframe requirement, but the backend should not add permissive CORS headers. The frontend only talks to `127.0.0.1:8000`; if you need to add CORS middleware to FastAPI, restrict the origin to `https://localhost:3000`.
- **Sessions dir is gitignored.** `backend/sessions/` contains persisted conversation history (which includes document content). It must stay in `.gitignore`.
- **No outbound network calls except to Anthropic.** The backend's only external dependency is the Anthropic API. It should not make requests to any other external service.

---

## Key Conventions

- **Backend**: single `main.py` at `backend/` root for the FastAPI app. Agent prompts and utils live in `backend/agent/`. Sessions persist to `backend/sessions/` (gitignored).
- **Frontend**: mirrors the sample's `src/taskpane/` structure. Components live in `components/`. Word action modules live in `microsoft-actions/`.
- **Env vars**: backend uses `.env` via `python-dotenv`. Only `ANTHROPIC_API_KEY` is required. A `.env.example` ships with a placeholder.
- **Session ID**: generated by the frontend, sent as `x-session-id` header on every request. The backend uses it as the key for both the in-memory agent cache and the `FileSessionManager`.
- **Paragraph indexing**: 0-based, `p0`, `p1`, `p2`... throughout. The frontend builds this mapping from the Word document before sending. The agent references these indices in action `loc` fields. Actions are applied in descending paragraph order to avoid index shifting.
