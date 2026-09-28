from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# ---------------------------------------------------------
# 1. LOAD THE EMBEDDING MODEL
# ---------------------------------------------------------
#
# This pretrained Transformer converts text into
# numerical vectors (embeddings).
#
model = SentenceTransformer("all-MiniLM-L6-v2")


# ---------------------------------------------------------
# 2. OUR DOCUMENT COLLECTION
# ---------------------------------------------------------
#
# Pretend these are pieces of text extracted from
# several research documents.
#
documents = [
    "Neural networks learn patterns from data.",
    "Deep learning models discover patterns in datasets.",
    "Gradient descent is used to optimize neural networks.",
    "Python is a popular programming language.",
    "Dogs are common household pets.",
    "Cats are independent animals.",
]


# ---------------------------------------------------------
# 3. CREATE DOCUMENT EMBEDDINGS
# ---------------------------------------------------------
#
# Every document gets converted into a vector.
#
# Example:
#
# "Neural networks learn patterns from data."
#
# becomes something conceptually like:
#
# [0.12, -0.43, 0.81, ...]
#
document_embeddings = model.encode(documents)


# ---------------------------------------------------------
# 4. CREATE OUR SEARCH FUNCTION
# ---------------------------------------------------------
#
# This function accepts a user's question and returns
# the most semantically similar documents.
#
def search(query, top_k=3):

    # Convert the user's question into an embedding.
    query_embedding = model.encode([query])

    # Compare the query vector against every document vector.
    similarities = cosine_similarity(
        query_embedding,
        document_embeddings
    )[0]

    # Combine each document with its similarity score.
    results = list(zip(documents, similarities))

    # Sort from highest similarity to lowest similarity.
    results.sort(
        key=lambda x: x[1],
        reverse=True
    )

    # Return only the top results.
    return results[:top_k]


# ---------------------------------------------------------
# 5. TEST OUR SEARCH ENGINE
# ---------------------------------------------------------

query = "How does a neural network learn?"

results = search(query)


# Print the results.
for document, score in results:

    print(f"{score:.3f} - {document}")