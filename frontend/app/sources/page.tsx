export default function SourcesPage() {
  return (
    <div className="about">
      <h1>Data &amp; Sources</h1>
      <p className="muted">
        Full sourcing, confidence levels, and known gaps for everything in
        the app — moved here from About to keep that page readable. Nothing
        below is new; it&apos;s the same disclosures, just out of the way
        until you actually want them.
      </p>

      <h2>Ward data</h2>
      <p>
        The ward lookup uses the current 300-ward structure (GHMC 150 / CMC
        76 / MMC 74), cross-checked against the official delimitation
        gazette for a sample of wards — the highest-confidence dataset in
        the app.
      </p>
      <p>
        <strong>Not covered:</strong> Secunderabad Cantonment Board, a
        fourth civic body inside the urban core, run by the Ministry of
        Defence rather than the state government — the chatbot can explain
        it, but its wards aren&apos;t in the ward search. Also not covered:
        HMDA, which isn&apos;t a rival local government at all, just a
        planning authority commonly confused with GHMC.
      </p>

      <h2>Chatbot document corpus</h2>
      <p>Two tiers of source, with different confidence:</p>
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
          the ward list was — a reasonable starting point, not an audited
          record.
        </li>
      </ul>

      <h2>Budget flow diagram</h2>
      <p>
        City-level only — no zone, circle or ward-wise budget breakdown is
        published for Hyderabad by any of the three corporations yet.
      </p>
      <p>
        The chatbot&apos;s extraction agent found ~800 fund_allocation rows
        from the budget PDF, but summing them inflates any total by roughly
        5x — the same figure gets restated under different labels across
        the summary table, a detailed schedule, and departmental annexures.
        The Budget page sidesteps this rather than showing a wrong number
        with false confidence: it hand-transcribes the ONE table pair that
        isn&apos;t restated elsewhere (&quot;Budget Highlights: Income /
        Expenditure&quot;, pages 30-31 of the source PDF) — both sides
        checked by hand to sum to exactly ₹8,440cr, the same verified total
        the chatbot cites. Individual scheme lookups through the chatbot are
        reliable; it&apos;s only a summed city-wide total from the raw
        extraction that isn&apos;t, which is why there&apos;s no fund
        dashboard or works-list beyond this one diagram yet.
      </p>

      <h2>Transport map</h2>
      <p>
        Station coordinates for Metro (Red, Green, Blue), MMTS suburban
        rail, railway terminals, bus stands and airports were hand-traced
        rather than pulled from an official feed — no machine-readable GTFS
        feed is published for Hyderabad. Treat positions as accurate to
        roughly the right spot, not survey-grade. Only services actually
        carrying passengers today are drawn — Metro Phase 2 is still
        awaiting approval, so it&apos;s left off rather than shown as
        though you could ride it. Not yet linked to wards: that needs ward
        boundary polygons, which don&apos;t exist publicly yet either.
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

      <h2>Source code</h2>
      <p>
        Schema, migrations, Lambda functions, and full build notes:{" "}
        <a
          href="https://github.com/chill-guy-1234/ward-watch"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/chill-guy-1234/ward-watch
        </a>
      </p>
    </div>
  );
}
