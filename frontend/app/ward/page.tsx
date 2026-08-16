"use client";

import { useState } from "react";
import { lookupWard } from "../lib/api";
import type { WardResult } from "../lib/types";

function representationSentence(r: WardResult): string {
  const corp =
    r.corporator_status === "vacant"
      ? "No elected corporator for this ward."
      : r.corporator_status === "elected"
        ? "This ward has an elected corporator."
        : "Corporator status not on record.";

  const body =
    r.civic_body_status === "special_officer"
      ? `${r.civic_body} is currently administered by an appointed Special Officer — councils' terms have ended and no election date is confirmed.`
      : r.civic_body_status === "elected"
        ? `${r.civic_body} has an elected council in place.`
        : `${r.civic_body}'s administrative status is not on record.`;

  return `${corp} ${body}`;
}

export default function WardPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WardResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await lookupWard(q.trim());
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ward-lookup">
      <p className="muted">
        Search the current 300-ward structure (GHMC / CMC / MMC) by ward
        number or name. No fund or works data yet — see{" "}
        <a
          href="https://github.com/chill-guy-1234/ward-watch#extraction-phase-3"
          target="_blank"
          rel="noopener noreferrer"
        >
          why
        </a>
        .
      </p>

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
      >
        <input
          className="text-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ward number or name, e.g. 95 or Jubilee Hills"
          disabled={loading}
        />
        <button className="button" type="submit" disabled={loading || !query.trim()}>
          Search
        </button>
      </form>

      {loading && <p className="muted">Searching…</p>}
      {error && <p className="muted">{error}</p>}

      {results && results.length === 0 && (
        <p className="muted">No wards matched &quot;{query}&quot;.</p>
      )}

      <div className="ward-results">
        {results?.map((r) => (
          <div key={r.ward_number} className="card ward-card">
            <div className="ward-card-head">
              <strong>
                Ward {r.ward_number} — {r.ward_name}
              </strong>
              <span className="muted">{r.civic_body}</span>
            </div>
            <p className="muted">
              {r.zone ?? "unknown zone"} zone · {r.circle ?? "unknown circle"}{" "}
              circle
            </p>
            <p>{representationSentence(r)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
