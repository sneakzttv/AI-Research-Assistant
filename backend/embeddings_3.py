from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# Load a pretrained model that converts text into
# numerical vectors called embeddings.
model = SentenceTransformer("all-MiniLM-L6-v2")


# Our small collection of documents.
documents = [
    "Neural networks learn patterns from data.",
    "Deep learning models discover patterns in datasets.",
    "Python is a popular programming language.",
    "Dogs are common household pets.",
]


# This is the question a user might ask.
query = "How does a neural network learn?"


# Convert every document into an embedding vector.
document_embeddings = model.encode(documents)


# Convert the question into an embedding vector.
query_embedding = model.encode([query])


# Compare the question against every document.
similarities = cosine_similarity(
    query_embedding,
    document_embeddings
)[0]


# Display documents from most similar to least similar.
results = sorted(
    zip(documents, similarities),
    key=lambda x: x[1],
    reverse=True
)


for document, score in results:
    print(f"{score:.3f} - {document}")