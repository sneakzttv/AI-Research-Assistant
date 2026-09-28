# AI Research Assistant

A Retrieval-Augmented Generation (RAG) application for asking questions about user-provided documents.

The project is being developed incrementally to explore the engineering and AI concepts behind modern RAG systems, including semantic search, embeddings, vector databases, LLMs, evaluation, and production deployment.

## Current Progress

* [x] Python project setup
* [x] Embedding model integration
* [x] Semantic search prototype
* [ ] Vector database
* [ ] Document ingestion
* [ ] Document chunking
* [ ] RAG pipeline
* [ ] LLM integration
* [ ] FastAPI backend
* [ ] React frontend
* [ ] Streaming responses
* [ ] Conversation history
* [ ] Metadata filtering
* [ ] Hallucination mitigation
* [ ] Evaluation pipeline
* [ ] Latency measurements
* [ ] Unit and integration tests
* [ ] Docker deployment

## Technology

* Python
* PyTorch
* Sentence Transformers
* Hugging Face Transformers
* ChromaDB
* FastAPI
* React
* TypeScript
* Docker

## Architecture

The planned architecture for the completed application is:

```text
                    ┌──────────────────────┐
                    │  React + TypeScript  │
                    │      Frontend        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │       FastAPI        │
                    │       Backend        │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌────────────┐   ┌────────────┐   ┌──────────────┐
       │  Document  │   │    RAG     │   │ Conversation │
       │ Processing │   │  Pipeline  │   │    History   │
       └──────┬─────┘   └──────┬─────┘   └──────────────┘
              │                │
              ▼                ▼
         ┌─────────┐      ┌────────────┐
         │ Chunking│      │ Embeddings │
         └─────────┘      └──────┬─────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ Vector        │
                         │ Database      │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │   Retriever   │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │      LLM      │
                         └───────┬───────┘
                                 │
                                 ▼
                         ┌───────────────┐
                         │ Answer +      │
                         │ Citations     │
                         └───────────────┘
```

## Project Goal

The goal is to build a complete RAG application while understanding the underlying systems rather than treating the AI components as black boxes.

The project will cover:

* Semantic search and vector embeddings
* Document ingestion and preprocessing
* Vector database design
* Retrieval-Augmented Generation
* LLM integration
* API and frontend development
* Retrieval and answer evaluation
* Performance and latency measurement
* Testing and reliability
* Containerized deployment

## Development Approach

The application is being developed incrementally, with each stage building on the previous one.

The initial implementation focuses on understanding embeddings and semantic search before introducing the vector database and full RAG pipeline.