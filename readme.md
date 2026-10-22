# Research Assistant Learning Lab

A runnable, local document-Q&A portfolio demo with a React/TypeScript learning
interface and FastAPI backend. Follow eight interactive lessons while ingesting
documents, retrieving evidence, inspecting citations, filtering metadata, and
watching streamed answers. Source comments explain the mechanics throughout.

**Honest scope:** this is an offline **TF-IDF retrieval + extractive QA baseline**,
not a completed semantic RAG/LLM system. It runs without API keys or model
downloads. It does not claim that lexical overlap proves relevance or truth.

## Run locally

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
For frontend development, run `npm.cmd run dev` in a second terminal from
[frontend](frontend); Vite proxies `/api` to the backend.

On Linux/macOS use `.venv/bin/python` and `npm` instead of the Windows commands.

## What is implemented

| Surface | Actual behavior |
| --- | --- |
| Ingestion | Plain-text paste, title and tag; bounded validated API inputs |
| Chunking | 120-word windows with 25-word overlap |
| Retrieval | Per-query TF-IDF index and cosine similarity; top three positive matches |
| Answers | Verbatim extracted chunks with numbered citations and original-source links |
| Streaming | SSE chunks of an already-computed extractive answer, not live LLM tokens |
| Metadata | Exact tag match applied before retrieval |
| History | SQLite-backed per-conversation log; history does not affect retrieval |
| Learning | Eight interactive lessons, evidence inspector, descriptive source comments |
| Storage | SQLite in `data/research.sqlite3`; configurable with `RAG_DATABASE` |

The original [embedding experiments](backend) are preserved as learning material.
They require their own optional Sentence Transformers/scikit-learn dependencies;
they are not invoked by this application.

## Resume alignment and limitations

React, TypeScript, Python, FastAPI, citations, source links, streaming, metadata
filters, and persistent history are implemented. **LangChain, ChromaDB,
pretrained semantic embeddings, generative LLM answers, PDF upload, and
conversational follow-up reasoning are not integrated.** These should not be
described as completed features on a resume. Synonyms without shared words can
fail to match; irrelevant text with shared words can match.

This is a trusted, single-user local learning app, not a public multi-user service.
There is no authentication or per-user authorization. All documents are visible
to anyone with access to the server. Do not ingest confidential material or expose
the port publicly. Source pages return plain text rather than executable HTML.
To reset local data, stop the app and remove only `data/research.sqlite3`.

## Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Set-Location frontend
npm.cmd run build
```

Tests cover retrieval, citation identity, persistence, metadata filtering,
no-evidence results, chunk overlap, API validation, and SSE completion.
CI runs backend tests and the TypeScript/production build.

## Docker

With Docker installed, `docker compose up --build` serves the app on
<http://127.0.0.1:8000> and persists SQLite in a named volume.
The image uses a non-root runtime user. Docker is optional; local Python/Node is
the primary development path.

## Read the code in order

1. [Retrieval core](backend/rag.py): tokenization, chunking, TF-IDF, cosine, SQLite.
2. [HTTP API](backend/app.py): validation, source pages, SSE events.
3. [Interactive interface](frontend/src/main.tsx): lessons, stream decoding, state.
4. [Tests](tests/test_rag.py): executable examples of the guarantees.

MIT licensed; see [LICENSE](LICENSE).
