"""HTTP boundary: validate inputs before invoking the retrieval pipeline."""

import json
import os
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from .rag import Store


class DocumentInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    text: str = Field(min_length=1, max_length=200_000)
    tag: str = Field(default="", max_length=80)

    @field_validator("title", "text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("This field cannot be blank.")
        return value


class QuestionInput(BaseModel):
    question: str = Field(min_length=1, max_length=2_000)
    tag: str = Field(default="", max_length=80)
    conversation: str = Field(min_length=1, max_length=80)


def create_app(path: Path | None = None) -> FastAPI:
    # The factory allows tests to use a temporary database without touching user data.
    store = Store(path or Path(os.environ.get("RAG_DATABASE", "data/research.sqlite3")))
    app = FastAPI(title="Research Assistant Learning Lab")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "mode": "extractive-tfidf"}

    @app.get("/api/documents")
    def documents() -> list[dict[str, str]]:
        return store.documents()

    @app.post("/api/documents", status_code=201)
    def add_document(document: DocumentInput) -> dict[str, str]:
        try:
            identifier = store.add(document.title, document.text, document.tag)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        return {"id": identifier}

    @app.get("/api/documents/{identifier}", response_class=PlainTextResponse)
    def source(identifier: str) -> str:
        document = store.document(identifier)
        if document is None:
            raise HTTPException(404, "Document not found.")
        # Plain text prevents uploaded HTML from becoming executable source pages.
        return document["text"]

    @app.get("/api/history/{conversation}")
    def history(conversation: str) -> list[dict[str, str]]:
        if len(conversation) > 80:
            raise HTTPException(422, "Conversation identifier is too long.")
        return store.history(conversation)

    @app.post("/api/ask")
    def ask(question: QuestionInput) -> StreamingResponse:
        try:
            result = store.answer(question.question, question.tag, question.conversation)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

        def events():
            # SSE frames are complete JSON objects separated by blank lines.
            # Retrieval finishes first; chunks stream the extractive answer, not
            # generated LLM tokens. The UI explicitly labels this distinction.
            answer = result["answer"]
            yield f"data: {json.dumps({'sources': result['sources']})}\n\n"
            for start in range(0, len(answer), 100):
                yield f"data: {json.dumps({'delta': answer[start:start + 100]})}\n\n"
            yield f"data: {json.dumps({'done': True, 'mode': result['mode']})}\n\n"

        return StreamingResponse(events(), media_type="text/event-stream")

    # A single origin serves both assets and API: no permissive CORS needed.
    frontend = Path(__file__).resolve().parents[1] / "frontend" / "dist"
    if frontend.exists():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    return app


app = create_app()
