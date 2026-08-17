"""RAG chatbot Lambda: the UI-facing function from CONCEPTS-AWS.md Part 5.

Same connectivity chain as wardwatch-healthcheck (IAM role -> Secrets Manager
-> Aurora -> Bedrock), fronted by a Function URL with CORS so a browser can
call it directly. The RAG loop itself (condense -> retrieve -> generate)
is chat_logic.py, shared with the terminal CLI (pipeline/chat.py).

A Lambda invocation has no memory of the previous one, unlike chat.py's
in-memory `history` list -- so the caller (the frontend) round-trips history:
sends it in the request body, gets the updated list back in the response, and
resends it next call. History holds bare Q&A turns only, never the retrieved
excerpts -- see chat_logic.py's module docstring for why.

Request body (JSON):  {"message": "...", "history": [...]}   (history optional)
Response body (JSON): {"answer": "...", "sources": [...], "history": [...]}
"""

import json

from chat_logic import MAX_HISTORY_TURNS, answer, condense, format_context, retrieve

# Public, unauthenticated endpoint that calls paid Bedrock models per request
# -- unlike wardlookup (a cheap Postgres query), an oversized or malformed
# payload here directly costs money. These caps reject the abuse case
# without touching any legitimate question (a real question is a sentence,
# not 2000+ characters; a real session is dozens of turns, not thousands).
MAX_MESSAGE_CHARS = 2000
MAX_HISTORY_ENTRIES = 2 * MAX_HISTORY_TURNS

# History entries include past ASSISTANT replies, not just questions --
# answer()'s maxTokens=2000 (chat_logic.py) allows replies of roughly
# 4,000-8,000 characters. Reusing MAX_MESSAGE_CHARS here was the actual bug:
# any conversation whose first reply ran long enough rejected the very next
# message with a 400, even though nothing about the request was abusive.
MAX_HISTORY_ENTRY_CHARS = 9000


def _valid_history(history) -> bool:
    if not isinstance(history, list) or len(history) > MAX_HISTORY_ENTRIES:
        return False
    return all(
        isinstance(turn, dict)
        and turn.get("role") in ("user", "assistant")
        and isinstance(turn.get("content"), list)
        and len(turn["content"]) == 1
        and isinstance(turn["content"][0], dict)
        and isinstance(turn["content"][0].get("text"), str)
        and len(turn["content"][0]["text"]) <= MAX_HISTORY_ENTRY_CHARS
        for turn in history
    )


def handler(event, context):
    body = json.loads(event.get("body") or "{}")
    question = (body.get("message") or "").strip()
    history = body.get("history") or []

    if not question:
        return _response(400, {"error": "message is required"})
    if len(question) > MAX_MESSAGE_CHARS:
        return _response(400, {"error": f"message too long (max {MAX_MESSAGE_CHARS} characters)"})
    if not _valid_history(history):
        return _response(400, {"error": "history is malformed or too long"})

    search_query = condense(question, history)
    chunks = retrieve(search_query)

    if not chunks:
        return _response(200, {
            "answer": "No documents ingested yet — nothing to answer from.",
            "sources": [],
            "history": history,
        })

    grounded = (
        f"<source_excerpts>\n{format_context(chunks)}\n</source_excerpts>\n\n"
        f"Question: {question}"
    )
    reply = answer(history + [{"role": "user", "content": [{"text": grounded}]}])

    new_history = history + [
        {"role": "user", "content": [{"text": question}]},
        {"role": "assistant", "content": [{"text": reply}]},
    ]
    del new_history[:-MAX_HISTORY_TURNS]

    # excerpt is the actual retrieved text, not just metadata -- the citation
    # chips in the UI expand to this, which is the whole point of citing at
    # all (an answer traceable to a real passage, not just a claimed source).
    sources = [
        {
            "title": c["title"],
            "page": c["page"],
            "publisher": c["publisher"],
            "url": c["url"],
            "excerpt": c["text"],
        }
        for c in chunks
    ]

    return _response(200, {"answer": reply, "sources": sources, "history": new_history})


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }
