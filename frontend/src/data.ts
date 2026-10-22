import { extract, search, tokens } from "./retrieval";
import type { DataSource, Frame, Original, Question, Turn } from "./types";

export const browserOnly = import.meta.env?.VITE_STATIC === "true";
export const storageKey = "research-assistant.browser.v1";
type State = { documents: Original[]; turns: (Turn & { conversation: string })[] };

// Accept injected storage for tests. Never clear unrelated applications' keys.
export class BrowserDataSource implements DataSource {
  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">) {}
  private load(): State {
    const raw = this.storage.getItem(storageKey);
    if (!raw) return { documents: [], turns: [] };
    const state = JSON.parse(raw) as State;
    if (!Array.isArray(state.documents) || !Array.isArray(state.turns) ||
      !state.documents.every((doc) => [doc.id, doc.title, doc.tag, doc.text].every((x) => typeof x === "string")) ||
      !state.turns.every((turn) => [turn.question, turn.answer, turn.conversation].every((x) => typeof x === "string"))) {
      throw new Error("Invalid browser data. Use Clear browser data to reset this app.");
    }
    return state;
  }
  async documents() { return this.load().documents.map(({ id, title, tag }) => ({ id, title, tag })); }
  async original(id: string) {
    const doc = this.load().documents.find((item) => item.id === id);
    if (!doc) throw new Error("Document not found.");
    return doc.text;
  }
  async add(doc: Omit<Original, "id">) {
    if (!doc.title.trim() || !tokens(doc.text).length || doc.title.length > 160 || doc.text.length > 200000 || doc.tag.length > 80) {
      throw new Error("A title (up to 160 characters), searchable text (up to 200000), and tag (up to 80) are required.");
    }
    const state = this.load();
    state.documents.push({ id: crypto.randomUUID(), title: doc.title.trim(), text: doc.text.trim(), tag: doc.tag.trim() });
    // A quota/security failure propagates to the UI; never claim unsaved success.
    this.storage.setItem(storageKey, JSON.stringify(state));
  }
  async history(conversation: string) {
    return this.load().turns.filter((turn) => turn.conversation === conversation)
      .map(({ question, answer }) => ({ question, answer }));
  }
  async *ask(input: Question): AsyncGenerator<Frame> {
    if (!input.conversation || input.conversation.length > 80 || input.question.length > 2000 || input.tag.length > 80) {
      throw new Error("Question, tag or conversation exceeds the allowed length.");
    }
    const state = this.load();
    const sources = search(state.documents, input.question, input.tag);
    const answer = extract(sources);
    state.turns.push({ conversation: input.conversation, question: input.question, answer });
    this.storage.setItem(storageKey, JSON.stringify(state));
    yield { sources };
    // Retrieval is already complete. A small scheduling pause makes client-side
    // progressive display visible; this is neither SSE nor generated LLM tokens.
    for (let start = 0; start < answer.length; start += 100) {
      yield { delta: answer.slice(start, start + 100) };
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    yield { done: true };
  }
  async clear() { this.storage.removeItem(storageKey); }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}
const jsonPost = (body: unknown): RequestInit => ({ method: "POST",
  headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const server: DataSource = {
  documents: () => request("/api/documents"),
  async add(doc) { await request("/api/documents", jsonPost(doc)); },
  async original(id) {
    const response = await fetch(`/api/documents/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("Document not found.");
    return response.text();
  },
  history: (id) => request(`/api/history/${encodeURIComponent(id)}`),
  async *ask(input) {
    const response = await fetch("/api/ask", jsonPost(input));
    if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
    if (!response.body) throw new Error("This browser cannot read response streams.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      // Network reads may split a JSON frame or UTF-8 character. Buffer both.
      while (true) {
        const part = await reader.read();
        buffer += decoder.decode(part.value, { stream: !part.done });
        let boundary: number;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (frame.startsWith("data: ")) yield JSON.parse(frame.slice(6)) as Frame;
        }
        if (part.done) break;
      }
    } finally { reader.releaseLock(); }
  },
};

// Storage access is lazy so unavailable localStorage becomes a visible UI error.
const storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};
export const data: DataSource = browserOnly ? new BrowserDataSource(storage) : server;
