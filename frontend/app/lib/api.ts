import type { ChatHistoryTurn, WardResult } from "./types";

// Defaults point at the deployed Lambda Function URLs -- they're public,
// unauthenticated endpoints (AuthType NONE, open CORS), so there's nothing
// secret about them living here. Override via env for a redeployed Lambda
// (see .env.example) without touching this file.
const CHATBOT_URL =
  process.env.NEXT_PUBLIC_CHATBOT_URL ??
  "https://xqknt4qdig7qifx7mcojdicamu0yiyoc.lambda-url.us-east-1.on.aws/";

const WARDLOOKUP_URL =
  process.env.NEXT_PUBLIC_WARDLOOKUP_URL ??
  "https://bb523lbg7ub77ksjojsbb5fhsm0fooht.lambda-url.us-east-1.on.aws/";

export async function askChatbot(message: string, history: ChatHistoryTurn[]) {
  const res = await fetch(CHATBOT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    throw new Error(`Chat request failed (${res.status})`);
  }
  return res.json() as Promise<{
    answer: string;
    sources: import("./types").Source[];
    history: ChatHistoryTurn[];
  }>;
}

async function wardRequest(q: string) {
  const url = q ? `${WARDLOOKUP_URL}?q=${encodeURIComponent(q)}` : WARDLOOKUP_URL;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error ?? `Lookup failed (${res.status})`);
  }
  return res.json() as Promise<{ query: string; results: WardResult[] }>;
}

export function lookupWard(q: string) {
  return wardRequest(q);
}

// All 300 current wards, grouped by civic body then ward number (server
// ordering) -- the ward browse page filters this client-side instead of
// hitting the Lambda per keystroke.
export async function listAllWards() {
  const { results } = await wardRequest("");
  return results;
}
