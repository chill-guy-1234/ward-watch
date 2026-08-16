"""Shared RAG logic: condense -> retrieve -> generate.

Extracted from chat.py so the same functions back both the terminal CLI
(chat.py's main() loop, in-memory history) and the chatbot Lambda
(lambda/chatbot/handler.py, history round-tripped in the request/response
body since a Lambda invocation has no memory of the previous one).
"""

import os

import boto3

import db
from embeddings import embed

TOP_K = 8

# Two models, deliberately: a cheap fast one to prepare the search query, and a
# stronger one to reason over the retrieved evidence. Routing by task value like
# this is the standard way to keep an agentic pipeline's cost sane — condensing
# runs on every message, so it should not cost what answering costs.
MODEL = os.environ.get("WARDWATCH_CHAT_MODEL", "us.deepseek.r1-v1:0")
CONDENSE_MODEL = os.environ.get("WARDWATCH_CONDENSE_MODEL", "us.amazon.nova-2-lite-v1:0")

# Keep the last N conversation turns (a turn = one user or one assistant entry).
# Bare Q&A turns are small; the expensive part (excerpts) is never stored — see
# callers. This cap exists only so a marathon session cannot grow unbounded.
MAX_HISTORY_TURNS = 12

SYSTEM = """You are The Deccan Sentinel, a civic-information assistant for Hyderabad.
Answer ONLY from the provided source excerpts. Every factual claim must carry a
citation like [2] pointing at the excerpt it came from. If the excerpts do not
contain the answer, say so plainly — do not fill gaps from general knowledge.
Amounts, dates, and ward numbers must be quoted exactly as they appear."""

CONDENSE_SYSTEM = """You rewrite a user's message into a short standalone search
query for a document-retrieval system covering Hyderabad civic documents
(municipal budgets, government orders, news).

Rules:
- Resolve references to earlier turns ("what about drainage?" after a question
  about street lighting becomes "GHMC drainage works expenditure").
- Strip greetings, anecdotes, and commentary; keep only what identifies the
  information being sought.
- Keep domain terms the documents would actually use.
- Output ONLY the query text. No preamble, no quotes, no explanation."""

client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def condense(question: str, history: list[dict]) -> str:
    """Turn the user's raw message into a focused standalone search query.

    Why this exists — two failure modes it fixes, both measured on this corpus:

    1. DILUTION. The embedding of a passage is roughly an average over its
       tokens, so padding a question with anecdotes drags the vector away from
       the topic. A 686-char rambling version of "how much was spent on street
       lighting?" pushed the actual STREET LIGHTING page out of the top 3
       entirely — and did so with *lower* (more confident-looking) distances,
       because long generic text sits nearer the centre of the vector space.

    2. FOLLOW-UPS. retrieve() embeds one string; the embedding model never sees
       the conversation. So "what about drainage?" is embedded as-is and matches
       almost nothing useful. Conversation history cannot rescue this: history
       only lets the model reuse chunks that some *earlier* retrieval already
       fetched. Retrieval is the only path by which new documents enter the
       conversation at all — if it fails, the right page is never read.

    Truncating long questions is NOT a fix: the real request often sits in the
    last sentence, which is exactly what truncation discards.

    Falls back to the raw question if the condensing model errors — degraded
    retrieval beats a dead chatbot.
    """
    recent = "\n".join(
        f"{turn['role']}: {turn['content'][0]['text']}" for turn in history[-4:]
    )
    prompt = (
        f"Conversation so far:\n{recent}\n\n" if recent else ""
    ) + f"Rewrite this as a search query: {question}"

    try:
        response = client.converse(
            modelId=CONDENSE_MODEL,
            system=[{"text": CONDENSE_SYSTEM}],
            messages=[{"role": "user", "content": [{"text": prompt}]}],
            inferenceConfig={"maxTokens": 100},
        )
        blocks = response["output"]["message"]["content"]
        query = "".join(b["text"] for b in blocks if "text" in b).strip()
        return query or question
    except Exception as exc:  # noqa: BLE001 — never let this break the chat
        print(f"[condense failed, using raw question: {exc}]")
        return question


def retrieve(question: str) -> list[dict]:
    """Nearest-neighbour search over document_chunk.

    Note the purpose flag: chunks were stored with GENERIC_INDEX, questions are
    embedded with TEXT_RETRIEVAL. Retrieval is an asymmetric relation ("does
    this passage ANSWER this query?"), not a similarity one, so the model
    projects the two sides differently. Same model and dimension on both sides
    is mandatory; the purpose flag is what makes matches better.
    """
    with db.connect() as conn:
        rows = conn.execute(
            """SELECT c.chunk_text, c.metadata->>'page_number' AS page,
                      s.title, s.publisher, s.published_date, s.url
               FROM document_chunk c
               JOIN source_document s ON s.id = c.source_document_id
               ORDER BY c.embedding <=> %s::vector
               LIMIT %s""",
            (embed(question, purpose="TEXT_RETRIEVAL"), TOP_K),
        ).fetchall()
    return [
        {"text": r[0], "page": r[1], "title": r[2], "publisher": r[3], "date": r[4], "url": r[5]}
        for r in rows
    ]


def format_context(chunks: list[dict]) -> str:
    """Number the excerpts [1]..[n] so the model's citations are resolvable."""
    parts = []
    for i, c in enumerate(chunks, 1):
        page = f", page {c['page']}" if c["page"] else ""
        parts.append(f"[{i}] {c['title']} ({c['publisher']}, {c['date']}{page})\n{c['text']}")
    return "\n\n---\n\n".join(parts)


def answer(messages: list[dict]) -> str:
    """Call the answering model via converse and return its text.

    `system` is a separate channel from `messages` on purpose: it is passed
    fresh on every call, never diluted by conversation, and models weight it
    above user turns. For a RAG app it carries the grounding contract (answer
    only from excerpts, cite everything) — which is what makes the output
    auditable rather than merely plausible.

    Reasoning models such as DeepSeek R1 also emit reasoningContent blocks;
    we keep only the text blocks for display.
    """
    response = client.converse(
        modelId=MODEL,
        system=[{"text": SYSTEM}],
        messages=messages,
        inferenceConfig={"maxTokens": 2000},
    )
    blocks = response["output"]["message"]["content"]
    return "".join(b["text"] for b in blocks if "text" in b)
