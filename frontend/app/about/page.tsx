export default function AboutPage() {
  return (
    <div className="about">
      <h1>About The Deccan Sentinel</h1>
      <p>
        The Deccan Sentinel is a civic-accountability and city-knowledge
        assistant for Hyderabad — an attempt to make budgets, documents, and
        representation status as easy to check as a flight status board,
        alongside general questions about the city&apos;s history, economy
        and transit. Wards stay at the core of it, across the city&apos;s
        three municipal corporations:
      </p>
      <ul>
        <li>
          <strong>GHMC</strong> — Greater Hyderabad Municipal Corporation
        </li>
        <li>
          <strong>CMC</strong> — Cyberabad Municipal Corporation
        </li>
        <li>
          <strong>MMC</strong> — Malkajgiri Municipal Corporation
        </li>
      </ul>
      <p>
        All three were carved out of a single, larger GHMC on 11 Feb 2026 —
        see &quot;Civic status&quot; below for what that means today.
      </p>
      <p>
        <strong>Not covered by ward lookup:</strong> Secunderabad Cantonment
        Board, a fourth civic body inside the urban core, run by the Ministry
        of Defence rather than the state government — the chatbot can
        explain it, but its wards aren&apos;t in the ward search. Also not
        covered: HMDA, which isn&apos;t a rival local government at all —
        see &quot;What&apos;s real here&quot; below for both.
      </p>

      <h2>What&apos;s real here</h2>
      <p>
        The chatbot answers only from documents that have actually been
        ingested, and every claim carries a citation you can expand to read
        the source excerpt yourself. Two tiers of source, with different
        confidence:
      </p>
      <ul>
        <li>
          <strong>Civic documents</strong> — the GHMC 2025-26 budget
          estimates PDF and one news article on the 2026 trifurcation.
          Primary or near-primary sources.
        </li>
        <li>
          <strong>General city knowledge</strong> — Wikipedia articles on
          the city overview, history, economy, administration, demographics,
          list of mayors, Secunderabad Cantonment Board, and HMDA, plus a
          hand-compiled note on SCB&apos;s stalled GHMC merger (sourced to
          the actual news coverage, since Wikipedia doesn&apos;t cover it).
          Not independently fact-checked against primary sources the way
          the ward list was — treat these as a reasonable starting point,
          not an audited record.
        </li>
      </ul>
      <p>
        The ward lookup uses the current 300-ward structure (GHMC 150 / CMC
        76 / MMC 74), cross-checked against the official delimitation
        gazette for a sample of wards — the highest-confidence dataset in
        the app.
      </p>

      <h2>The budget flow diagram</h2>
      <p>
        The Budget page shows where GHMC&apos;s FY 2025-26 money comes from
        and goes, city-level only — no zone, circle or ward breakdown exists
        publicly for Hyderabad yet. Built from the one table pair in the
        source PDF that isn&apos;t restated elsewhere, hand-checked to sum
        to the exact verified total, specifically to sidestep the ~5x
        inflation the automated extraction agent produces when summed (see
        &quot;What&apos;s deliberately missing&quot; below).
      </p>

      <h2>The transport map</h2>
      <p>
        Station coordinates for Metro (Red, Green, Blue), MMTS suburban rail,
        railway terminals, bus stands and airports were hand-traced rather
        than pulled from an official feed — no machine-readable GTFS feed is
        published for Hyderabad. Treat positions as accurate to roughly the
        right spot, not survey-grade. Only services actually carrying
        passengers today are drawn: Metro Phase 2 (airport, Patancheru,
        Medchal, Shamirpet, Old City) is still in central-government
        appraisal with construction targeted 2028–30, so it is left off
        rather than shown as though you could ride it.
      </p>
      <p>
        The map is not yet linked to wards. Doing that honestly needs ward
        boundary polygons so a station can be placed inside a ward
        geometrically; matching station names to ward names would look like
        an answer while actually being a guess, so it hasn&apos;t been done.
      </p>

      <h2>What&apos;s deliberately missing</h2>
      <p>
        No fund totals or works-list dashboard yet. Early extraction work
        found the same budget figures restated under near-identical labels
        across different tables in the source PDF, which inflated any
        SUM()&apos;d total by roughly 5x — shipping that would mean showing a
        wrong number with false confidence, so it stayed out. Individual
        scheme lookups through the chatbot are reliable; a city-wide total is
        not, yet.
      </p>

      <h2>Civic status, as of this build</h2>
      <p>
        GHMC, CMC and MMC currently have no elected corporators or mayors —
        each is run by an appointed Special Officer since the local body
        councils&apos; terms ended. No election date has been confirmed for
        any of the three bodies. This changes; check the chatbot for the
        latest ingested reporting rather than trusting this page to stay
        current on its own.
      </p>

      <h2>Source</h2>
      <p>
        Code, schema, and full build notes:{" "}
        <a
          href="https://github.com/chill-guy-1234/ward-watch"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/chill-guy-1234/ward-watch
        </a>
      </p>

      <footer className="footer">Made with ❤️ in Hyderabad, for Hyderabad</footer>
    </div>
  );
}
