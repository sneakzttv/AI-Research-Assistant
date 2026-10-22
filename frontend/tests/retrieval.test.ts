import { test } from "node:test";
import assert from "node:assert/strict";
import { chunks, extract, search, tokens } from "../src/retrieval";
import { BrowserDataSource, storageKey } from "../src/data";
import type { Original } from "../src/types";

const doc = (id: string, text: string, tag = "ml"): Original => ({ id, title: `Title ${id}`, text, tag });

test("Unicode word tokens use full case folding, not ASCII-only lowercase", () => {
  assert.deepEqual(tokens("Stra\u00dfe STRASSE \u03a3\u03c2\u03c3 CAF\u00c9 \uff11\uff12_2 \u00bd a\u0301"),
    ["strasse", "strasse", "\u03c3\u03c3\u03c3", "caf\u00e9", "\uff11\uff12_2", "\u00bd", "a"]);
  assert.deepEqual(tokens("\u0130 \u13a0 \uab70 \ufb03"), ["i", "\u13a0", "\u13a0", "ffi"]);
});
test("default 120/25 windows overlap without an extra trailing chunk", () => {
  const words = Array.from({ length: 216 }, (_, i) => `w${i}`);
  const parts = chunks(words.join(" "));
  assert.equal(parts.length, 3);
  assert.equal(parts[0].split(" ").length, 120);
  assert.equal(parts[1].split(" ")[0], "w95");
  assert.equal(parts[2], words.slice(190).join(" "));
  assert.equal(chunks(words.slice(0, 120).join(" ")).length, 1);
});
test("chunking normalizes whitespace and handles empty input", () => {
  assert.deepEqual(chunks("  a\nb\t c ", 2, 1), ["a b", "b c"]);
  assert.deepEqual(chunks(" \n "), []);
});
test("invalid chunk settings fail", () => {
  for (const [size, overlap] of [[0, 0], [2, 2], [2, -1], [1.5, 0]]) {
    assert.throws(() => chunks("test", size, overlap));
  }
});
test("cosine uses raw term counts and smoothed IDF", () => {
  const found = search([doc("a", "rare common common"), doc("b", "common")], "rare common");
  const rare = Math.log(3 / 2) + 1;
  const expected = (rare * rare + 2) / (Math.sqrt(rare * rare + 4) * Math.sqrt(rare * rare + 1));
  assert.equal(found[0].document_id, "a");
  assert.ok(Math.abs(found[0].score - expected) < 1e-12);
});
test("top three positive matches, stable tie order, and original citation identity", () => {
  const found = search([doc("a", "word"), doc("b", "word"), doc("c", "word"), doc("d", "word"), doc("e", "other")], "word");
  assert.deepEqual(found.map((x) => x.document_id), ["a", "b", "c"]);
  assert.deepEqual(found[0], { document_id: "a", title: "Title a", tag: "ml", chunk: 1, text: "word", score: 1 });
});
test("tag filter is exact and is applied before computing IDF", () => {
  const docs = [doc("a", "rare common"), doc("b", "common", "food"), doc("c", "rare", "ML")];
  const found = search(docs, "rare", "ml");
  assert.equal(found.length, 1);
  assert.ok(Math.abs(found[0].score - 1 / Math.sqrt(2)) < 1e-12);
  assert.deepEqual(search(docs, "rare", " ml"), []);
});
test("unknown words and empty corpora return explicit no-evidence answer", () => {
  assert.deepEqual(search([], "question"), []);
  assert.deepEqual(search([doc("a", "networks")], "bananas"), []);
  assert.equal(extract([]), "No matching evidence found. Add a document or rephrase your question.");
  assert.throws(() => search([], "?!"), /containing words/);
});
test("extractive answers number verbatim evidence including punctuation", () => {
  const found = search([doc("a", "A fact!"), doc("b", "A second fact.")], "fact");
  assert.equal(extract(found), found.map((x, i) => `[${i + 1}] ${x.text}`).join("\n\n"));
});

// Memory storage verifies durable serialization without depending on a DOM.
class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
test("browser library and original source survive a new adapter instance", async () => {
  const storage = new MemoryStorage();
  await new BrowserDataSource(storage).add({ title: " Notes ", text: " <b>networks</b> ", tag: " ml " });
  const reloaded = new BrowserDataSource(storage);
  const [entry] = await reloaded.documents();
  assert.equal(entry.title, "Notes"); assert.equal(entry.tag, "ml");
  assert.equal(await reloaded.original(entry.id), "<b>networks</b>");
  await assert.rejects(reloaded.original("missing"), /not found/);
});
test("progressive events complete and history persists per conversation without affecting retrieval", async () => {
  const storage = new MemoryStorage();
  const source = new BrowserDataSource(storage);
  await source.add({ title: "Notes", text: "Networks learn gradients.", tag: "ml" });
  const frames = [];
  for await (const frame of source.ask({ question: "gradients", tag: "ml", conversation: "one" })) frames.push(frame);
  assert.equal(frames[0].sources?.[0].title, "Notes");
  assert.equal(frames.at(-1)?.done, true);
  assert.equal(frames.map((x) => x.delta ?? "").join(""), "[1] Networks learn gradients.");
  assert.deepEqual(await new BrowserDataSource(storage).history("one"), [{ question: "gradients", answer: "[1] Networks learn gradients." }]);
  assert.deepEqual(await source.history("two"), []);
  for await (const _ of source.ask({ question: "bananas", tag: "", conversation: "one" })) { /* consume */ }
  assert.match((await source.history("one"))[1].answer, /^No matching evidence/);
});
test("clear deletes only app data and works even when data is corrupt", async () => {
  const storage = new MemoryStorage();
  storage.setItem("other-app", "keep"); storage.setItem(storageKey, "broken JSON");
  const source = new BrowserDataSource(storage);
  await assert.rejects(source.documents());
  await source.clear();
  assert.deepEqual(await source.documents(), []);
  assert.deepEqual(await source.history("one"), []);
  assert.equal(storage.getItem("other-app"), "keep");
});
test("invalid document and question inputs do not persist", async () => {
  const source = new BrowserDataSource(new MemoryStorage());
  await assert.rejects(source.add({ title: " ", text: "word", tag: "" }));
  await assert.rejects(source.add({ title: "Title", text: "?!", tag: "" }));
  await assert.rejects(source.add({ title: "a".repeat(161), text: "word", tag: "" }));
  await assert.rejects(async () => { for await (const _ of source.ask({ question: "?!", tag: "", conversation: "one" })) { /* consume */ } });
  assert.deepEqual(await source.documents(), []);
  assert.deepEqual(await source.history("one"), []);
});
test("storage failures propagate instead of reporting success", async () => {
  const source = new BrowserDataSource({ getItem: () => null, removeItem: () => {}, setItem: () => { throw new Error("Quota exceeded"); } });
  await assert.rejects(source.add({ title: "Title", text: "word", tag: "" }), /Quota exceeded/);
});
