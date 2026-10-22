export type Document = { id: string; title: string; tag: string };
export type Original = Document & { text: string };
export type Source = { document_id: string; title: string; tag: string; chunk: number; text: string; score: number };
export type Turn = { question: string; answer: string };
export type Frame = { sources?: Source[]; delta?: string; done?: boolean };
export type Question = { question: string; tag: string; conversation: string };

// Both transports expose the same events. Only the HTTP implementation uses SSE.
export interface DataSource {
  documents(): Promise<Document[]>;
  add(document: Omit<Original, "id">): Promise<void>;
  original(id: string): Promise<string>;
  history(conversation: string): Promise<Turn[]>;
  ask(question: Question): AsyncGenerator<Frame>;
  clear?(): Promise<void>;
}
