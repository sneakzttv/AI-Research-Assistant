import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Document = { id: string; title: string; tag: string };
type Source = { document_id: string; title: string; chunk: number; text: string; score: number };
type Turn = { question: string; answer: string };
type Frame = { sources?: Source[]; delta?: string; done?: boolean };

// The tutorial is part of the application, not a separate wall of documentation.
// Each lesson points to a working control and asks the learner to observe a result.
const lessons = [
  ["1. Ingest a document", "Load the sample or paste your own text. Ingestion stores the original text and a metadata tag in SQLite. Try the sample now."],
  ["2. Split into chunks", "The retriever splits documents into 120-word windows with 25 words of overlap. Boundaries retain context. A citation shows its chunk number."],
  ["3. Turn words into vectors", "TF-IDF represents word frequency weighted by rarity across chunks. This offline baseline matches words, not meanings. Synonyms may not match."],
  ["4. Retrieve evidence", "Ask 'How does backpropagation train networks?' Cosine similarity compares vector directions. Higher scores mean greater word overlap, not truth."],
  ["5. Inspect citations", "The answer copies retrieved text with numbered citations. Open each original source and compare it. This is extractive QA, not an LLM-generated answer."],
  ["6. Filter metadata", "Set the tag filter to 'ml', then to 'food' and ask about gradients again. Filtering happens before retrieval and changes the available evidence."],
  ["7. Stream and remember", "The server streams JSON SSE frames; the browser appends each text delta. SQLite saves turns, but past turns do not influence retrieval. Start a new conversation to isolate history."],
  ["8. Test the limits", "Ask about something absent from the documents. No word overlap produces an explicit no-evidence answer. Shared words can still retrieve irrelevant text: always inspect sources."],
];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [title, setTitle] = useState("Backpropagation notes");
  const [text, setText] = useState("");
  const [tag, setTag] = useState("ml");
  const [filter, setFilter] = useState("");
  const [question, setQuestion] = useState("How does backpropagation train networks?");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [history, setHistory] = useState<Turn[]>([]);
  // The ID stays in this browser tab across refreshes, not in a global server session.
  const [conversation, setConversation] = useState(() => {
    const id = sessionStorage.getItem("conversation") || crypto.randomUUID();
    sessionStorage.setItem("conversation", id);
    return id;
  });
  const [lesson, setLesson] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    request<Document[]>("/api/documents").then(setDocuments).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    let current = true;
    request<Turn[]>(`/api/history/${conversation}`)
      .then((turns) => { if (current) setHistory(turns); })
      .catch((e: Error) => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [conversation]);

  async function ingest() {
    setBusy(true); setError(""); setNotice("");
    try {
      await request("/api/documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text, tag }),
      });
      setDocuments(await request<Document[]>("/api/documents"));
      setNotice("Document stored. You can now retrieve its chunks.");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function ask() {
    setBusy(true); setError(""); setAnswer(""); setSources([]);
    try {
      const response = await fetch("/api/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, tag: filter, conversation }),
      });
      if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
      if (!response.body) throw new Error("This browser cannot read response streams.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let complete = false;
      // Network reads can end mid-frame or mid-Unicode character. Keep partial
      // frames and let TextDecoder preserve incomplete UTF-8 sequences.
      function consume() {
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (!frame.startsWith("data: ")) continue;
          const event = JSON.parse(frame.slice(6)) as Frame;
          if (event.sources) setSources(event.sources);
          if (event.delta) setAnswer((old) => old + event.delta);
          if (event.done) complete = true;
        }
      }
      while (true) {
        const part = await reader.read();
        buffer += decoder.decode(part.value, { stream: !part.done });
        consume();
        if (part.done) break;
      }
      if (!complete) throw new Error("The answer stream ended before completion.");
      setHistory(await request<Turn[]>(`/api/history/${conversation}`));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return <main>
    <header><span className="badge">LOCAL AI LEARNING LAB</span>
      <h1>Research Assistant</h1><p>From document to evidence: learn retrieval by using it.</p>
      <p className="muted">Offline TF-IDF + extractive answers. No LLM, API key, or model download required.</p>
    </header>
    <aside aria-label="Interactive tutorial">
      <h2>{lessons[lesson][0]}</h2><p aria-live="polite">{lessons[lesson][1]}</p>
      <div className="row"><button disabled={lesson === 0} onClick={() => setLesson(lesson - 1)}>Previous</button>
        <span>Lesson {lesson + 1} / {lessons.length}</span>
        <button disabled={lesson === lessons.length - 1} onClick={() => setLesson(lesson + 1)}>Next lesson</button></div>
      <progress value={lesson + 1} max={lessons.length} aria-label="Tutorial progress" />
    </aside>
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="grid">
      <section><h2>1. Document library</h2>
        <p>Paste plain text. Documents persist locally until you delete the database.</p>
        <button disabled={busy} onClick={() => {
          setTitle("Backpropagation notes"); setTag("ml");
          setText("Neural networks learn by minimizing a loss function. Backpropagation computes gradients using the chain rule. Gradient descent updates weights in the opposite direction of the gradient. A learning rate controls the update size. Validation data measures generalization to unseen examples.");
        }}>Fill with sample text</button>
        <label>Document title<input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} /></label>
        <label>Metadata tag<input value={tag} maxLength={80} onChange={(e) => setTag(e.target.value)} /></label>
        <label>Document text<textarea value={text} maxLength={200000} rows={8} onChange={(e) => setText(e.target.value)} /></label>
        <button disabled={busy || !title.trim() || !text.trim()} onClick={ingest}>Ingest document</button>
        <ul>{documents.map((doc) => <li key={doc.id}>
          <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">{doc.title}</a> <small>{doc.tag || "untagged"}</small>
        </li>)}</ul>
      </section>
      <section><h2>2. Ask and verify</h2>
        <label>Exact metadata filter (blank = all)<input value={filter} maxLength={80} onChange={(e) => setFilter(e.target.value)} /></label>
        <label>Question<textarea value={question} maxLength={2000} rows={3} onChange={(e) => setQuestion(e.target.value)} /></label>
        <button disabled={busy || !question.trim()} onClick={ask}>{busy ? "Working..." : "Retrieve and stream answer"}</button>
        <h3>Extractive answer</h3><pre aria-live="polite">{answer || "Your evidence will appear here."}</pre>
        <h3>Evidence inspector</h3>
        {sources.map((source, index) => <details key={`${source.document_id}-${source.chunk}`}>
          <summary>[{index + 1}] {source.title} / chunk {source.chunk} / cosine {source.score.toFixed(3)}</summary>
          <p>{source.text}</p><a href={`/api/documents/${source.document_id}`} target="_blank" rel="noreferrer">Open original source</a>
        </details>)}
      </section>
    </div>
    <section><h2>3. Conversation history</h2>
      <p>Stored turns are a log, not conversational reasoning. Reload to see persistence.</p>
      <button disabled={busy} onClick={() => {
        const id = crypto.randomUUID(); sessionStorage.setItem("conversation", id);
        setConversation(id); setHistory([]); setAnswer(""); setSources([]);
      }}>Start new conversation</button>
      {history.map((turn, index) => <details key={index}><summary>{turn.question}</summary><pre>{turn.answer}</pre></details>)}
    </section>
    <footer>Learning checkpoint: can you explain why a high cosine score is not proof that an answer is correct?</footer>
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
