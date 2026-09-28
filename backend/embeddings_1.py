from sentence_transformers import SentenceTransformer


# Load a pretrained embedding model.
#
# This model takes normal text and converts it into
# a numerical vector representing its semantic meaning.
model = SentenceTransformer("all-MiniLM-L6-v2")


# Some example sentences we want to compare.
sentences = [
    "Neural networks learn patterns from data.",
    "Deep learning models discover patterns in datasets.",
    "I like eating pizza.",
]


# Convert each sentence into an embedding vector.
embeddings = model.encode(sentences)


# Print the resulting vectors.
for sentence, embedding in zip(sentences, embeddings):

    print("TEXT:")
    print(sentence)

    print("\nEMBEDDING:")
    print(embedding)

    print("\nVECTOR LENGTH:")
    print(len(embedding))

    print("-" * 50)