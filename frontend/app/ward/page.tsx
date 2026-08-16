"use client";

import { useEffect, useMemo, useState } from "react";
import { listAllWards } from "../lib/api";
import type { WardResult } from "../lib/types";

const CIVIC_BODIES = ["GHMC", "CMC", "MMC"] as const;

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

// One representation sentence per civic body, since it's currently
// identical for every ward inside that body -- repeating it 150 times in a
// browse list would be noise, not information.
function groupRepresentationSentence(wards: WardResult[]): string {
  return wards[0] ? representationSentence(wards[0]) : "";
}

export default function WardPage() {
  const [allWards, setAllWards] = useState<WardResult[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [bodyFilter, setBodyFilter] = useState<string>("All");

  useEffect(() => {
    listAllWards()
      .then(setAllWards)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load wards")
      );
  }, []);

  const filtered = useMemo(() => {
    if (!allWards) return [];
    const q = query.trim().toLowerCase();
    return allWards.filter((w) => {
      const matchesBody = bodyFilter === "All" || w.civic_body === bodyFilter;
      const matchesQuery =
        !q ||
        w.ward_name.toLowerCase().includes(q) ||
        String(w.ward_number).includes(q);
      return matchesBody && matchesQuery;
    });
  }, [allWards, query, bodyFilter]);

  const isSearching = query.trim().length > 0;

  const grouped = useMemo(() => {
    const map = new Map<string, WardResult[]>();
    for (const body of CIVIC_BODIES) map.set(body, []);
    for (const w of filtered) map.get(w.civic_body)?.push(w);
    return map;
  }, [filtered]);

  return (
    <div className="ward-lookup">
      <p className="muted">
        Browse or search the current 300-ward structure (GHMC / CMC / MMC).
        No fund or works data yet — see{" "}
        <a
          href="https://github.com/chill-guy-1234/ward-watch#extraction-phase-3"
          target="_blank"
          rel="noopener noreferrer"
        >
          why
        </a>
        .
      </p>

      <div className="body-filter">
        {["All", ...CIVIC_BODIES].map((b) => (
          <button
            key={b}
            className={`body-filter-btn${bodyFilter === b ? " active" : ""}`}
            onClick={() => setBodyFilter(b)}
          >
            {b}
            {b !== "All" && allWards
              ? ` (${allWards.filter((w) => w.civic_body === b).length})`
              : ""}
          </button>
        ))}
      </div>

      <input
        className="text-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by ward number or name, e.g. 95 or Jubilee Hills"
      />

      {loadError && <p className="muted">{loadError}</p>}
      {!allWards && !loadError && <p className="muted">Loading wards…</p>}

      {allWards && filtered.length === 0 && (
        <p className="muted">No wards matched.</p>
      )}

      {/* Searching (or a single body already isolates the sentence) shows
          full detail per ward -- that's the "find MY ward" use case. */}
      {isSearching && (
        <div className="ward-results">
          {filtered.map((r) => (
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
      )}

      {/* Browsing (no text filter): grouped, collapsible, compact -- 300
          rows of repeated detail would defeat "minimalistic." */}
      {!isSearching &&
        allWards &&
        CIVIC_BODIES.filter(
          (body) => bodyFilter === "All" || bodyFilter === body
        ).map((body) => {
          const wards = grouped.get(body) ?? [];
          if (wards.length === 0) return null;
          return (
            <details key={body} className="ward-group" open={bodyFilter !== "All"}>
              <summary className="ward-group-summary">
                {body} — {wards.length} wards
              </summary>
              <p className="muted ward-group-note">
                {groupRepresentationSentence(wards)}
              </p>
              <div className="ward-grid">
                {wards.map((w) => (
                  <div key={w.ward_number} className="ward-grid-item">
                    <span className="ward-grid-number">{w.ward_number}</span>{" "}
                    <span>{w.ward_name}</span>
                    <div className="muted ward-grid-sub">
                      {w.zone ?? "—"} · {w.circle ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
    </div>
  );
}
