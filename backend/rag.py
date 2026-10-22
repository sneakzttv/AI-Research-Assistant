"""Small, inspectable retrieval pipeline with durable documents and citations."""

from collections import Counter
from contextlib import closing
from dataclasses import asdict, dataclass
import math
from pathlib import Path
import re
import sqlite3
import uuid


def tokens(text: str) -> list[str]:
    # Case folding makes "Learning" and "learning" share a feature.
    return re.findall(r"\b\w+\b", text.casefold())


def chunks(text: str, size: int = 120, overlap: int = 25) -> list[str]:
    # Overlap preserves context at boundaries without returning the entire document.
    if size < 1 or overlap < 0 or overlap >= size:
        raise ValueError("Require size > overlap >= 0.")
    words = text.split()
    result = []
    for start in range(0, len(words), size - overlap):
        result.append(" ".join(words[start:start + size]))
        if start + size >= len(words):
            break
    return result


@dataclass
class Source:
    document_id: str
    title: str
    tag: str
    chunk: int
    text: str
    score: float


class Store:
    def __init__(self, path: Path):
        # Each operation opens its own connection so FastAPI worker threads do not
        # share SQLite connections. Parameter binding keeps text out of SQL syntax.
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(self.connect()) as db, db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL,
                    tag TEXT NOT NULL, text TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS turns (
                    id INTEGER PRIMARY KEY, conversation TEXT NOT NULL,
                    question TEXT NOT NULL, answer TEXT NOT NULL);
            """)

    def connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.path)
        db.row_factory = sqlite3.Row
        return db

    def add(self, title: str, text: str, tag: str) -> str:
        if not title.strip() or not tokens(text):
            raise ValueError("A title and searchable document text are required.")
        identifier = str(uuid.uuid4())
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO documents VALUES (?, ?, ?, ?)",
                       (identifier, title.strip(), tag.strip(), text.strip()))
        return identifier

    def documents(self) -> list[dict[str, str]]:
        with closing(self.connect()) as db:
            return [dict(row) for row in db.execute(
                "SELECT id, title, tag FROM documents ORDER BY rowid")]

    def document(self, identifier: str) -> dict[str, str] | None:
        with closing(self.connect()) as db:
            row = db.execute("SELECT * FROM documents WHERE id = ?",
                             (identifier,)).fetchone()
            return dict(row) if row else None

    def search(self, question: str, tag: str = "", limit: int = 3) -> list[Source]:
        # This offline baseline is TF-IDF, not a pretrained semantic embedding.
        # IDF downweights frequent corpus words; cosine normalizes chunk length.
        if not tokens(question):
            raise ValueError("Enter a question containing words.")
        with closing(self.connect()) as db:
            rows = db.execute("SELECT * FROM documents WHERE (? = '' OR tag = ?)",
                              (tag, tag)).fetchall()
        candidates = [
            Source(row["id"], row["title"], row["tag"], index + 1, text, 0.0)
            for row in rows for index, text in enumerate(chunks(row["text"]))
        ]
        counts = [Counter(tokens(item.text)) for item in candidates]
        frequency = Counter(word for count in counts for word in count)
        idf = {word: math.log((1 + len(counts)) / (1 + count)) + 1
               for word, count in frequency.items()}

        def vector(count: Counter[str]) -> dict[str, float]:
            return {word: value * idf[word] for word, value in count.items()
                    if word in idf}

        query = vector(Counter(tokens(question)))
        query_norm = math.sqrt(sum(value * value for value in query.values()))
        for item, count in zip(candidates, counts):
            features = vector(count)
            norm = math.sqrt(sum(value * value for value in features.values()))
            dot = sum(value * features.get(word, 0) for word, value in query.items())
            item.score = dot / (norm * query_norm) if norm and query_norm else 0
        return sorted((item for item in candidates if item.score > 0),
                      key=lambda item: item.score, reverse=True)[:limit]

    def answer(self, question: str, tag: str, conversation: str) -> dict:
        sources = self.search(question, tag)
        # Extractive answers cannot invent facts: the displayed excerpts are copied
        # verbatim. Matching a word is not evidence of factual relevance, however.
        answer = "\n\n".join(
            f"[{index}] {source.text}" for index, source in enumerate(sources, 1)
        ) or "No matching evidence found. Add a document or rephrase your question."
        with closing(self.connect()) as db, db:
            db.execute("INSERT INTO turns (conversation, question, answer) VALUES (?, ?, ?)",
                       (conversation, question, answer))
        return {"answer": answer, "sources": [asdict(source) for source in sources],
                "mode": "extractive-tfidf", "conversation": conversation}

    def history(self, conversation: str) -> list[dict[str, str]]:
        with closing(self.connect()) as db:
            return [dict(row) for row in db.execute(
                "SELECT question, answer FROM turns WHERE conversation = ? ORDER BY id",
                (conversation,))]
