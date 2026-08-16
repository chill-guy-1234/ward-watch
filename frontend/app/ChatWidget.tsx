"use client";

import { useEffect, useRef, useState } from "react";
import { askChatbot } from "./lib/api";
import type { ChatHistoryTurn, ChatMessage } from "./lib/types";

const STORAGE_KEY = "wardwatch-chat";

const STARTER_QUESTIONS = [
  "What is GHMC's total budget for 2025-26?",
  "What changed when GHMC was trifurcated into GHMC, CMC and MMC?",
  "How much was spent on street lighting?",
];

// A DeepSeek R1 answer can genuinely take 30-45s -- this is an honest wait
// indicator, not a fake progress bar, so it changes message rather than
// pretending to track real progress.
const LOADING_MESSAGES: [number, string][] = [
  [0, "Searching ingested civic documents…"],
  [8, "Reading the retrieved excerpts…"],
  [20, "Still working — the reasoning model can take up to a minute…"],
];

export default function ChatWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatHistoryTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setMessages(parsed.messages ?? []);
      setHistory(parsed.history ?? []);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  function persist(nextMessages: ChatMessage[], nextHistory: ChatHistoryTurn[]) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages: nextMessages, history: nextHistory })
    );
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;

    const withUser = [...messages, { role: "user" as const, text: q }];
    setMessages(withUser);
    setInput("");
    setLoading(true);

    try {
      const res = await askChatbot(q, history);
      const withAnswer = [
        ...withUser,
        { role: "assistant" as const, text: res.answer, sources: res.sources },
      ];
      setMessages(withAnswer);
      setHistory(res.history);
      persist(withAnswer, res.history);
    } catch (err) {
      const withError = [
        ...withUser,
        {
          role: "assistant" as const,
          text: `Something went wrong reaching The Deccan Sentinel: ${
            err instanceof Error ? err.message : "unknown error"
          }`,
        },
      ];
      setMessages(withError);
      persist(withError, history);
    } finally {
      setLoading(false);
    }
  }

  const loadingText = [...LOADING_MESSAGES]
    .reverse()
    .find(([t]) => elapsed >= t)?.[1];

  return (
    <div className="chat">
      {messages.length === 0 && (
        <div className="starter-block">
          <p className="muted">
            Ask about Hyderabad&apos;s civic budget and documents ingested so
            far. Answers cite the excerpt they came from — tap a citation to
            read it.
          </p>
          <div className="starter-questions">
            {STARTER_QUESTIONS.map((q) => (
              <button key={q} className="button-ghost" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <div className="msg-text">{m.text}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="sources">
                {m.sources.map((s, si) => {
                  const key = `${i}-${si}`;
                  const isOpen = expanded === key;
                  return (
                    <div key={key} className="source-item">
                      <button
                        className="source-chip"
                        onClick={() => setExpanded(isOpen ? null : key)}
                      >
                        [{si + 1}] {s.title}
                        {s.page ? `, p.${s.page}` : ""}
                      </button>
                      {isOpen && (
                        <div className="source-excerpt">
                          <p className="muted">
                            {s.publisher}
                            {s.page ? ` · page ${s.page}` : ""}
                          </p>
                          <p>{s.excerpt}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="msg msg-assistant">
            <div className="msg-text muted">{loadingText}</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          className="text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={loading}
        />
        <button className="button" type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
