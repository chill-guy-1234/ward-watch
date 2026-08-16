"""Terminal RAG chatbot over the ingested civic documents.

The RAG loop itself (condense -> retrieve -> generate) lives in chat_logic.py,
shared with the chatbot Lambda (lambda/chatbot/handler.py). This file is just
the CLI: an input loop holding history in memory.

Usage: python chat.py
"""

from chat_logic import MODEL, MAX_HISTORY_TURNS, condense, retrieve, format_context, answer


def main() -> None:
    print(f"The Deccan Sentinel — chat ({MODEL}) — Ctrl+C to quit.\n")

    # history holds BARE question/answer turns only — never the retrieved
    # excerpts. Excerpts are ~3000 chars x TOP_K ≈ 6000 tokens per turn; keeping
    # them would re-send (and re-bill) every past turn's evidence on every call,
    # while burying the current question in stale material. Fresh excerpts are
    # retrieved each turn and attached to the current message only.
    history: list[dict] = []

    while True:
        question = input("you> ").strip()
        if not question:
            continue

        search_query = condense(question, history)
        if search_query != question:
            print(f"[search: {search_query}]")

        chunks = retrieve(search_query)
        if not chunks:
            print("bot> No documents ingested yet — run ingest.py first.\n")
            continue

        # Excerpts ride on this turn's message only; history keeps the bare text.
        grounded = (
            f"<source_excerpts>\n{format_context(chunks)}\n</source_excerpts>\n\n"
            f"Question: {question}"
        )
        reply = answer(history + [{"role": "user", "content": [{"text": grounded}]}])

        history.append({"role": "user", "content": [{"text": question}]})
        history.append({"role": "assistant", "content": [{"text": reply}]})
        del history[:-MAX_HISTORY_TURNS]

        print(f"bot> {reply}\n\nsources:")
        for i, c in enumerate(chunks, 1):
            print(f"  [{i}] {c['title']}" + (f" p.{c['page']}" if c["page"] else "") + (f" — {c['url']}" if c["url"] else ""))
        print()


if __name__ == "__main__":
    main()
