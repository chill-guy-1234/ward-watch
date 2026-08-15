"""One-shot end-to-end test: retrieval + a single model answer (non-interactive)."""

from chat import MODEL, answer, format_context, retrieve

QUESTION = "What is the total budget estimate for GHMC for 2025-26?"

chunks = retrieve(QUESTION)
print("--- top retrieved chunks ---")
for i, c in enumerate(chunks[:5], 1):
    preview = c["text"][:110].replace("\n", " ")
    print(f"[{i}] {c['title'][:45]} p.{c['page']} :: {preview}")

print(f"\n--- answer ({MODEL}) ---")
history = [{
    "role": "user",
    "content": [{"text": f"<source_excerpts>\n{format_context(chunks)}\n</source_excerpts>\n\nQuestion: {QUESTION}"}],
}]
print(answer(history))
