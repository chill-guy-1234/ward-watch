import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="about">
      <h1>About The Deccan Sentinel</h1>
      <p>
        A civic-accountability and city-knowledge assistant for Hyderabad —
        covering GHMC, CMC and MMC, the three municipal corporations carved
        out of a single larger GHMC on 11 Feb 2026.
      </p>

      <h2>Why not just ask Google, ChatGPT or Claude?</h2>
      <ul>
        <li>
          <strong>Recency.</strong> Hyderabad&apos;s civic map has been in
          real upheaval — mergers, a trifurcation, mayors&apos; posts vacant
          since Feb 2026. A general AI model&apos;s training cutoff means it
          can confidently give you a stale or wrong answer. This app&apos;s
          corpus gets actively re-verified.
        </li>
        <li>
          <strong>Receipts, not just answers.</strong> Every claim here
          cites the actual excerpt it came from, expandable in the chat —
          not a vague paraphrase or a pile of links to sift through
          yourself.
        </li>
        <li>
          <strong>Structured data nobody else has organized.</strong> A
          gazette-verified list of all 300 current wards, with zone,
          circle, civic body and representation status, doesn&apos;t exist
          as a queryable dataset anywhere else.
        </li>
        <li>
          <strong>Honesty as the product, not a caveat.</strong> Where the
          data doesn&apos;t support a number — a citywide fund total, for
          instance — this app says so instead of showing a confident wrong
          one. That&apos;s a design choice.
        </li>
      </ul>

      <h2>Who it&apos;s for</h2>
      <ul>
        <li>Someone new to Hyderabad who doesn&apos;t know which corporation covers their address, or who represents them</li>
        <li>Someone filing a civic complaint who needs the right authority — genuinely confusing mid-trifurcation</li>
        <li>A journalist or researcher who wants a citation, not a paraphrase</li>
        <li>Anyone trying to understand the GHMC/CMC/MMC reorganization without reading twenty news articles</li>
        <li>Commuters wanting one map instead of separate Metro/MMTS/bus sites</li>
      </ul>

      <h2>How to use it</h2>
      <ul>
        <li><strong>Chat bubble</strong> (bottom-right, any page) — ask anything about Hyderabad&apos;s civic budget, history, economy, or current governance</li>
        <li><strong>Ward Lookup</strong> — search or browse all 300 wards</li>
        <li><strong>Budget</strong> — where GHMC&apos;s money comes from and goes</li>
        <li><strong>Transport</strong> — Metro, MMTS, rail, bus and airports in one map</li>
      </ul>

      <p>
        Full sourcing, confidence levels, and known limitations:{" "}
        <Link href="/sources">Data &amp; Sources</Link>. Code and build
        notes:{" "}
        <a
          href="https://github.com/chill-guy-1234/ward-watch"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/chill-guy-1234/ward-watch
        </a>
        .
      </p>

      <footer className="footer">Made with ❤️ in Hyderabad, for Hyderabad</footer>
    </div>
  );
}
