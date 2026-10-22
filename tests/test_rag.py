"""Learning checks: each test states a guarantee the demo actually makes."""

from pathlib import Path
import tempfile
import unittest

from fastapi.testclient import TestClient

from backend.app import create_app
from backend.rag import Store, chunks


class RetrievalTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "test.sqlite3"
        self.store = Store(self.path)

    def test_citations_and_persistence(self):
        identifier = self.store.add("Neural networks", "Networks learn using gradients.", "ml")
        self.store.add("Cooking", "Pizza uses flour and cheese.", "food")
        answer = self.store.answer("gradients", "ml", "lesson")
        self.assertEqual(answer["sources"][0]["document_id"], identifier)
        self.assertIn("[1] Networks learn using gradients.", answer["answer"])
        self.assertEqual(len(Store(self.path).history("lesson")), 1)
        self.assertEqual(self.store.history("different"), [])

    def test_filter_no_evidence_and_empty_question(self):
        self.store.add("Notes", "Networks use gradients.", "ml")
        self.assertEqual(self.store.search("gradients", "food"), [])
        self.assertIn("No matching evidence", self.store.answer("zebras", "", "x")["answer"])
        with self.assertRaises(ValueError):
            self.store.search("???")

    def test_chunk_overlap_and_invalid_size(self):
        self.assertEqual(chunks("a b c d e", 3, 1), ["a b c", "c d e"])
        with self.assertRaises(ValueError):
            chunks("text", 3, 3)

    def test_http_stream_sources_validation_and_history(self):
        # Temporary storage and an in-process HTTP client keep this deterministic.
        with TestClient(create_app(self.path)) as client:
            self.assertEqual(client.get("/api/health").status_code, 200)
            result = client.post("/api/documents", json={
                "title": "Lesson", "text": "Backpropagation computes gradients.", "tag": "ml"})
            self.assertEqual(result.status_code, 201)
            source = client.get("/api/documents/" + result.json()["id"])
            self.assertTrue(source.headers["content-type"].startswith("text/plain"))
            response = client.post("/api/ask", json={
                "question": "gradients", "conversation": "test", "tag": "ml"})
            self.assertEqual(response.status_code, 200)
            self.assertIn('"done": true', response.text)
            self.assertIn("Backpropagation", response.text)
            self.assertEqual(len(client.get("/api/history/test").json()), 1)
            self.assertEqual(client.post("/api/ask", json={
                "question": "???", "conversation": "test"}).status_code, 422)
            self.assertEqual(client.get("/api/documents/missing").status_code, 404)
            self.assertEqual(client.post("/api/documents", json={
                "title": " ", "text": "x"}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
