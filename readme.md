# Research Assistant Learning Lab

**[Live browser demo](https://sneakzttv.github.io/AI-Research-Assistant/)**

A document-Q&A portfolio demo with a React/TypeScript learning interface. Follow
all eight interactive lessons while ingesting documents, retrieving evidence,
inspecting citations, filtering metadata, and displaying answers progressively.
Educational source comments explain the mechanics throughout.

**Honest scope:** an offline **TF-IDF retrieval + extractive QA baseline**, not a
semantic RAG/LLM system. No API keys, model downloads, third-party services or
CDNs. Lexical overlap does not prove relevance or truth.

## Two modes

| | GitHub Pages / browser-only | Local full-stack (default) |
| --- | --- | --- |
| Runtime | Static files; retrieval runs in TypeScript | React UI + FastAPI/Python retrieval |
| Persistence | localStorage in this browser profile and origin only | SQLite in `data/research.sqlite3` (`RAG_DATABASE` overrides it) |
| Answer display | Client-side progressive display of an already-computed answer; no SSE | Server-sent JSON SSE frames of an already-computed answer |
| Original citations | Original plain text shown in-app, never an `/api` link | Plain-text source pages from FastAPI |
| History | Browser-persisted conversation log | SQLite-persisted log, tab-local conversation ID |
| Reset | **Clear browser data** deletes this app's library and all saved turns | Stop the app and delete only `data/research.sqlite3` |

The demo explicitly labels **Browser-only mode: data stays in this browser, no
server**. It does not upload pasted documents. Different devices, profiles and
origins do not share data. Browser storage is not encrypted or a backup; clearing
site data/private browsing may erase it, and quota/security errors are surfaced.
GitHub Pages serves app assets, not an API. Avoid confidential documents on shared
browsers. There is no service worker or guaranteed offline asset cache.

## Run locally: full-stack

Requires Python 3.11+ and Node 22+.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Set-Location frontend
npm.cmd ci
npm.cmd run build
Set-Location ..
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>. Click **Fill with sample text**, **Ingest document**,
then **Retrieve and stream answer**. Use Next lesson to learn the full pipeline.
For frontend development run `npm.cmd run dev` in a second terminal from
[frontend](frontend); Vite proxies `/api` to FastAPI. The default build uses `/`
as its base and preserves the existing backend/Docker behavior.

On Linux/macOS use `.venv/bin/python` and `npm` instead of the Windows commands.

## Run locally: browser-only

No Python backend is needed. From `frontend`:

```powershell
npm.cmd ci
npm.cmd run dev -- --mode pages
# Or build the same static files as Pages and preview them:
npm.cmd run build:pages
npm.cmd exec vite preview -- --mode pages --host 127.0.0.1
```

Open <http://127.0.0.1:5173/AI-Research-Assistant/> for development or
<http://127.0.0.1:4173/AI-Research-Assistant/> for preview.
`--mode pages` loads `frontend/.env.pages` (`VITE_STATIC=true`). The typed data
source interface selects browser storage rather than HTTP, and Vite sets the
base to `/AI-Research-Assistant/` only for this static build. You can also set
`VITE_STATIC=true` in the build environment; unset it for full-stack builds.
These public build flags are not secrets.

## GitHub Pages deployment

[pages.yml](.github/workflows/pages.yml) runs on pushes to `main` and manual
`workflow_dispatch`. It installs locked frontend dependencies, runs TypeScript
unit tests, builds the browser-only frontend, uploads `frontend/dist` with
`actions/upload-pages-artifact@v3`, and deploys with `actions/deploy-pages@v4`.
It uses Pages/OIDC permissions and the `pages` concurrency group, not API keys.
Repository **Settings > Pages > Source** must be **GitHub Actions** for deployment.
The workflow does not deploy Python or SQLite. The separate test workflow checks
the backend, TS tests, and both production build modes on pushes and PRs.

## What is implemented

- Plain-text paste with a title and tag; bounded, validated inputs.
- Unicode case-folded word tokens and 120-word windows with 25-word overlap.
- Per-query TF-IDF: `idf = log((1 + chunk_count) / (1 + document_frequency)) + 1`;
  cosine similarity ranks the top three **positive** matches, with stable ties.
- Exact, case-sensitive tag filtering **before** the index is built.
- Verbatim extractive chunks with numbered citations and original-source access.
- Per-conversation persistent history (a log, **not** context for retrieval).
- Eight interactive lessons and an evidence inspector in both modes.

The original [embedding experiments](backend) remain learning material. They need
optional Sentence Transformers/scikit-learn dependencies and are not used by this
application.

## Limitations

**LangChain, ChromaDB, pretrained semantic embeddings, generative LLM answers,
PDF upload, and conversational follow-up reasoning are not integrated.** Do not
list them as completed resume features. Synonyms without shared words may not
match; irrelevant shared words can match. Answers are excerpts, not fact checks.

Browser retrieval recomputes the index on the main thread for each question;
localStorage is synchronous and capacity-limited. This is a small-text learning
lab, not a large-corpus or multi-user service. Concurrent tabs can overwrite
browser changes; there is no sync, export or cross-device recovery.

The local backend is trusted, single-user software with no authentication or
per-user authorization. Everyone with access to the server can see its documents;
do not expose its port publicly. Source text is rendered as text, not HTML.

## Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Set-Location frontend
npm.cmd ci
npm.cmd test
npm.cmd run build
npm.cmd run build:pages
```

Python tests cover retrieval, citations, persistence, tags, no evidence, chunk
boundaries, API validation and SSE completion. TypeScript tests use Node's built-in
`node:test` runner via `tsx`: Unicode folding, chunking, numeric IDF/cosine,
positive top-three ranking, citation identity, exact tags, extractive answers,
browser persistence, isolated history, progressive completion, clear/reset and
storage errors. Neither suite calls external services.

## Docker

`docker compose up --build` serves the local full-stack app on
<http://127.0.0.1:8000> and persists SQLite in a named volume. The image uses a
non-root runtime user. Docker is optional.

## Read the code in order

1. [Python retrieval](backend/rag.py) and [browser retrieval](frontend/src/retrieval.ts).
2. [HTTP API](backend/app.py) and [typed data adapters](frontend/src/data.ts).
3. [Interactive interface](frontend/src/main.tsx): mode-aware lessons and controls.
4. [Python tests](tests/test_rag.py) and [TS tests](frontend/tests/retrieval.test.ts).

MIT licensed; see [LICENSE](LICENSE).
