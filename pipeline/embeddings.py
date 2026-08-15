"""Embeddings via AWS Bedrock — Amazon Nova Multimodal Embeddings (1024 dims).

(Titan Text Embeddings V2 is legacy and not enableable on newer accounts;
Nova is Amazon's current embedding model.)


WHAT AN EMBEDDING IS
--------------------
An embedding replaces a piece of text with a fixed-size list of numbers, such
that texts with similar *meaning* end up as numerically-close lists. We store
one per document chunk; at question time we embed the question the same way and
ask pgvector for the nearest chunks. That is the whole retrieval mechanism.


HOW TEXT OF ANY LENGTH BECOMES EXACTLY 1024 FLOATS
--------------------------------------------------
Four stages happen inside the model:

1. Tokenize. The text is chopped into sub-word tokens, each mapped to an integer
   ID — "GHMC budget" might become [7412, 2003, 9871]. Longer text = more
   tokens; at this stage length still varies.

2. Look up an initial vector per token. The model holds a giant table mapping
   every token ID to a learned vector. You now have N vectors for N tokens —
   still variable length, and each vector is context-free ("bank" is identical
   whether you meant a river or a savings account).

3. Contextualize (the transformer layers). Each token's vector is repeatedly
   updated by "looking at" all the other tokens — the attention mechanism.
   Afterwards "bank" in "river bank" and "bank account" have genuinely
   different vectors, each having absorbed meaning from its neighbours.
   Still N vectors.

4. Pool — the step that kills variable length. The N contextualized vectors are
   collapsed into one, typically by averaging them (or by reading off a
   designated summary token). A final linear projection maps that to exactly
   1024 numbers, usually normalized to unit length.

So 20 characters or 3,000 characters, the output is always 1024 floats.
No individual position is interpretable — there is no "dimension 412 =
money-ness". Meaning lives in the geometry: the model was trained on millions of
(query, matching-passage) and (query, wrong-passage) pairs, tuned to pull the
right ones together and push the wrong ones apart.


HOW TWO EMBEDDINGS ARE COMPARED
-------------------------------
By direction, not magnitude, using cosine similarity — the cosine of the angle
between the two vectors:

    similarity = (A . B) / (|A| * |B|)          # 1 = same direction, 0 = unrelated

Magnitude tends to track incidental things like text length; direction carries
the semantics. pgvector's `<=>` operator is cosine *distance* (1 - similarity),
so SMALLER IS CLOSER — hence `ORDER BY embedding <=> query LIMIT k` in chat.py.

Two practical cautions:
  - Unrelated text does NOT score ~0. Real similarities bunch into a narrow band
    (often 0.4-0.9) because all English text shares structure. Trust relative
    ranking (ORDER BY ... LIMIT k), not absolute thresholds.
  - Scores are only comparable within one embedding scheme. Vectors from a
    different model, a different dimension, or (below) a different purpose are
    not comparable to each other.


DIMENSION IS A PROPERTY OF THE MODEL, NOT THE DATA
--------------------------------------------------
Nova supports 256 / 384 / 1024 / 3072; we pin 1024 to match `vector(1024)` in
the schema. Bigger vectors capture finer distinctions but cost more storage and
slower search. Changing model OR dimension invalidates every stored vector and
requires a re-embedding job plus a new migration — not an edit in place.


ASYMMETRIC EMBEDDINGS
---------------------
Nova embeddings are asymmetric: content being *indexed* and questions used to
*retrieve* are embedded with different purposes, which improves match quality.
Use GENERIC_INDEX when storing chunks, TEXT_RETRIEVAL when embedding a question.
"""

import json
import os

import boto3

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
MODEL_ID = "amazon.nova-2-multimodal-embeddings-v1:0"
DIMENSIONS = 1024  # must match vector(1024) in the schema

_client = boto3.client("bedrock-runtime", region_name=AWS_REGION)


def embed(text: str, purpose: str = "GENERIC_INDEX") -> list[float]:
    """purpose: GENERIC_INDEX for document chunks, TEXT_RETRIEVAL for questions."""
    response = _client.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps({
            "taskType": "SINGLE_EMBEDDING",
            "singleEmbeddingParams": {
                "embeddingPurpose": purpose,
                "embeddingDimension": DIMENSIONS,
                "text": {"truncationMode": "END", "value": text[:8000]},
            },
        }),
    )
    return json.loads(response["body"].read())["embeddings"][0]["embedding"]
