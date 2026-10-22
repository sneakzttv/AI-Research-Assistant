import { caseFold } from "./casefold";
import type { Original, Source } from "./types";

// Python's Unicode \w includes letters, numbers and underscore, but not marks.
// JavaScript's built-in \w is ASCII-only, so Unicode properties are intentional.
export function tokens(text: string): string[] {
  return caseFold(text).match(/[\p{L}\p{N}_]+/gu) ?? [];
}

export function chunks(text: string, size = 120, overlap = 25): string[] {
  if (!Number.isInteger(size) || !Number.isInteger(overlap) || size < 1 || overlap < 0 || overlap >= size) {
    throw new Error("Require size > overlap >= 0.");
  }
  // Match Python str.split whitespace, including its C0 separators (not BOM).
  const words = text.split(/[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/u).filter(Boolean);
  const result: string[] = [];
  for (let start = 0; start < words.length; start += size - overlap) {
    result.push(words.slice(start, start + size).join(" "));
    if (start + size >= words.length) break;
  }
  return result;
}

function counts(text: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const word of tokens(text)) result.set(word, (result.get(word) ?? 0) + 1);
  return result;
}

export function search(documents: Original[], question: string, tag = "", limit = 3): Source[] {
  if (!tokens(question).length) throw new Error("Enter a question containing words.");
  // Filter first: the eligible chunks, not the whole library, define IDF.
  const candidates = documents.filter((doc) => !tag || doc.tag === tag).flatMap((doc) =>
    chunks(doc.text).map((text, index) => ({ document_id: doc.id, title: doc.title,
      tag: doc.tag, chunk: index + 1, text, score: 0 })));
  const features = candidates.map((item) => counts(item.text));
  const frequency = new Map<string, number>();
  for (const count of features) for (const word of count.keys()) {
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  }
  const idf = new Map([...frequency].map(([word, count]) =>
    [word, Math.log((1 + candidates.length) / (1 + count)) + 1]));
  const vector = (count: Map<string, number>) => new Map([...count]
    .filter(([word]) => idf.has(word)).map(([word, value]) => [word, value * idf.get(word)!]));
  const norm = (values: Map<string, number>) => Math.sqrt([...values.values()].reduce((sum, x) => sum + x * x, 0));
  const query = vector(counts(question));
  const queryNorm = norm(query);
  candidates.forEach((item, index) => {
    const values = vector(features[index]);
    const length = norm(values);
    const dot = [...query].reduce((sum, [word, value]) => sum + value * (values.get(word) ?? 0), 0);
    item.score = length && queryNorm ? dot / (length * queryNorm) : 0;
  });
  // Stable sorting preserves ingestion/chunk order for ties, just like Python.
  return candidates.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function extract(sources: Source[]): string {
  // Copy evidence verbatim; this is not generation or factual verification.
  return sources.map((source, index) => `[${index + 1}] ${source.text}`).join("\n\n") ||
    "No matching evidence found. Add a document or rephrase your question.";
}
