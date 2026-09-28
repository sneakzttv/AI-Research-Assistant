from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# Load our pretrained embedding model.
model = SentenceTransformer("all-MiniLM-L6-v2")


# These are pieces of text from our imaginary document.
documents = [
    "Neural networks learn patterns from data.",
    "Deep learning models discover patterns in datasets.",
    "Python is a popular programming language.",
    "Dogs are common household pets.",
]


# This represents the user's question.
query = "How does a neural network learn?"


# Convert the documents into vectors.
document_embeddings = model.encode(documents)


# Convert the user's question into a vector.
query_embedding = model.encode([query])


# Calculate how similar the query is to every document.
similarities = cosine_similarity(
    query_embedding,
    document_embeddings
)[0]


# Display the results.
for document, score in zip(documents, similarities):

    print(f"{score:.3f} - {document}")