"""Extraction agent: turn ingested document chunks into structured DB rows.

This is the mirror image of chat.py. Chat *retrieves* text to answer a human;
extraction *reads* text and emits typed records â€” work_item and fund_allocation
rows â€” that the ward dashboards will be built on.

WHY A MODEL AND NOT A PARSER
----------------------------
The source material is prose and whitespace-aligned tables written for humans:
"Government sanctioned Rs. 1839.00 Cr. for maintenance of roads ... works are in
progress". No regex survives the variety. The model's job is judgement â€” what
does this paragraph actually claim, and how certain is it?

TAGGING AT EXTRACTION TIME (handover doc Â§7)
--------------------------------------------
Two quality fields are set as the record is created, never patched on later:

  granularity â€” is this a ward / circle / zone / city-level fact? Determined by
      the MODEL, because it needs reading comprehension ("in Kukatpally circle"
      vs "across the city"). Most budget-document facts are city-level; the app
      must never imply ward precision it does not have.

  confidence â€” how trustworthy is the source? Derived in CODE from the document
      type, because it is a property of the document, not of the sentence:
      an official budget PDF or Government Order is `official`, a news article
      is `reported`. No model call needed, so no model error possible.

AMOUNTS ARE STORED IN CRORES, as the documents state them. Converting to rupees
at extraction time would invite transcription errors in exactly the numbers this
project exists to get right.

Idempotent: re-running for a document deletes that document's prior extractions
first, so the agent can be re-run after a prompt change without duplicating rows.

Usage:
  python extract.py --doc-id 1            # one document
  python extract.py --doc-id 1 --limit 5  # first 5 chunks only (cheap dry run)
"""

import argparse
import os
import re

import boto3

import db

MODEL = os.environ.get("WARDWATCH_EXTRACT_MODEL", "us.amazon.nova-pro-v1:0")

# Document type -> how much we trust its claims. Property of the source, so it
# is decided here rather than asked of the model.
# Canonical fiscal year, e.g. '2025-26'. The DB enforces this too (V5); doing it
# here as well means a bad value is reported against its page rather than
# aborting the run 40 chunks later.
FISCAL_YEAR_RE = re.compile(r"^\d{4}-\d{2}$")

# Prompt rules guide the model, they do not bind it (we have proof: it
# extracted "Budget Size (RE +CE)" and "Total Expenditure" as separate
# allocations, both equal to the city's whole ₹8,440cr budget). This is the
# code-side backstop — a rollup label is rejected regardless of what the model
# decided.
ROLLUP_RE = re.compile(
    r"^(total|grand\s*total|sub\s*-?\s*total|net\s*total|budget\s*size)\b", re.I
)

CONFIDENCE_BY_DOC_TYPE = {
    "budget_pdf": "official",
    "GO": "official",
    "RTI": "official",
    "news": "reported",
    "scraped_page": "unverified",
}

SYSTEM = """You extract structured civic-finance records from Hyderabad
municipal documents (GHMC/CMC/MMC budgets, government orders, news).

Call the record_extractions tool exactly once per excerpt.

Rules:
- Extract ONLY what the excerpt states. Never infer, never complete from general
  knowledge, never carry numbers across from a different scheme or year.
- Amounts are in CRORES exactly as written ("Rs. 1839.00 Cr." -> 1839.00).
  If the excerpt gives no amount, use null. Do not estimate.
- NEVER ADD FIGURES TOGETHER. Every number you emit must appear verbatim in the
  excerpt. A total the document does not state is a fabricated number, however
  correct the arithmetic.
- When spending is reported per year ("Rs.179.90 Cr in 2023-24 ... Rs. 40.33 Cr
  this year"), put EVERY year in the work item's spend_by_year array â€” one entry
  each, never summed â€” and set amount_spent to the most recent stated figure.
  Mark a forward projection ("it is estimated to spend") as basis="estimated",
  money already incurred as basis="actual".
- Do not emit a fund_allocation just to hold a year's spending on a work. That
  belongs in spend_by_year.
- MOST EXCERPTS CONTAIN NOTHING EXTRACTABLE. Cover pages, indexes, tables of
  contents, committee resolutions, accounting definitions and narrative
  preamble all yield empty arrays. Returning {"work_items": [], "fund_allocations": []}
  is the correct and expected answer for the majority of excerpts. Do not
  manufacture records to seem useful.
- A heading is not a record. "BUDGET ESTIMATES 2025-26" as a title, an index
  entry, or a table caption is NOT a fund_allocation â€” it is a label. Extract a
  fund_allocation only when the excerpt states an actual sum of money assigned
  to a named scheme or budget head.
- Budget tables have MULTIPLE LEVELS: individual line items (Establishment
  Expenses, Property Tax), section subtotals that sum a group of line items
  (Revenue Income, Capital Expenditure — note these often do NOT contain the
  word "Total"), and a grand total (Budget Size, GHMC Revenues Total — note
  "Total" can appear anywhere in the label, not only as a prefix). Extract
  EVERY level you see — do not omit subtotals or totals — but set is_rollup
  to true on any row whose amount is itself the sum of other rows in the same
  table, so the application can exclude it from totals and avoid double
  counting. Ask yourself: "does this number already include several other
  numbers I am also extracting from this table?" — if yes, is_rollup=true.
- Never extract a fund_allocation with no amount at all. If you cannot fill at
  least one of amount_allocated / amount_sanctioned / amount_spent from the
  text, the record does not exist â€” omit it.
- scheme_name is the scheme only. Do not append the year or phrases like
  "current Financial Year" to it; the year belongs in fiscal_year.
- granularity: "ward" only if a specific ward/division number is named,
  "circle"/"zone" if a named circle or zone, otherwise "city".
CHOOSING BETWEEN THE TWO RECORD TYPES â€” read this carefully, it is the
distinction most often got wrong:

- work_item = a named undertaking that gets BUILT, MAINTAINED or DELIVERED.
  It has a lifecycle (planned -> ongoing -> completed) and usually a narrative
  describing progress. Examples:
    "H-CITI Nalas Phase-I", "Grade separators around KBR Park",
    "Comprehensive Maintenance of Roads", "Installation of 9278 LED street
    light fittings", "Foot Over Bridges at various locations"
  These go in work_items EVEN IF the excerpt states money spent on them.

- fund_allocation = a LINE IN A BUDGET, i.e. money appropriated to a head or
  scheme for a fiscal year. It has no lifecycle and no physical existence.
  Examples:
    "Establishment Expenses 1680.90", "Sanitation (Excluding Wages) 226.00",
    "Debt Servicing", "Fifteenth Finance Commission Grants"
  These are rows of a budget table, not things being built.

If the excerpt describes progress, status, quantities delivered or a project
name, it is a work_item. If it is a budget table row, it is a fund_allocation.

EACH FACT BELONGS TO EXACTLY ONE RECORD TYPE â€” NEVER BOTH. If you record
"H-CITI Nalas Phase-I" as a work_item, put its money on that work_item's
amount fields and do NOT also emit a fund_allocation for it. Emitting both
double-counts the money and corrupts every total the application computes.

AMOUNT FIELDS
- amount_allocated  = budgeted / estimated / provided for the year
- amount_sanctioned = formally approved for the scheme or work
- amount_spent      = actually incurred / released so far
Budget-table figures are amount_allocated, not amount_sanctioned.
When a budget table separates revenue and capital sections, qualify the name
accordingly ("Street Lighting (Revenue)" vs "Street Lighting (Capital)") so the
two rows remain distinguishable."""

TOOL_SCHEMA = {
    "type": "object",
    "properties": {
        "work_items": {
            "type": "array",
            "description": "Specific civic works described in this excerpt. Empty if none.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Short name of the work as stated"},
                    "category": {"type": "string", "enum": ["roads", "drainage", "streetlight", "sanitation", "other"]},
                    "amount_sanctioned": {"type": ["number", "null"], "description": "Crores, null if not stated"},
                    "amount_spent": {"type": ["number", "null"], "description": "Crores, null if not stated"},
                    "status": {"type": "string", "enum": ["planned", "sanctioned", "ongoing", "completed", "stalled"]},
                    "granularity": {"type": "string", "enum": ["ward", "circle", "zone", "city"]},
                    "location_mention": {
                        "type": ["string", "null"],
                        "description": "The place as named in the text ('Serilingampally, Kukatpally'), or null if city-wide. Required whenever granularity is ward or circle.",
                    },
                    "evidence": {"type": "string", "description": "The sentence this came from, quoted"},
                    # Per-year spending lives here rather than being squeezed into
                    # amount_spent â€” see V3__work_item_spend.sql for why.
                    "spend_by_year": {
                        "type": "array",
                        "description": "One entry per fiscal year the excerpt gives a figure for. Never sum these.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "fiscal_year": {"type": "string", "description": "e.g. 2023-24"},
                                "amount_spent": {"type": "number", "description": "Crores, verbatim"},
                                "basis": {
                                    "type": "string",
                                    "enum": ["actual", "estimated"],
                                    "description": "'actual' for money already spent, 'estimated' for a forward projection",
                                },
                                "evidence": {"type": "string"},
                            },
                            "required": ["fiscal_year", "amount_spent", "basis", "evidence"],
                        },
                    },
                },
                "required": ["title", "category", "status", "granularity", "evidence"],
            },
        },
        "fund_allocations": {
            "type": "array",
            "description": "Money assigned to a scheme/head for a fiscal year. Empty if none.",
            "items": {
                "type": "object",
                "properties": {
                    "scheme_name": {"type": "string"},
                    # Required, not nullable: the schema enforces NOT NULL because an
                    # allocation with no year cannot be compared, charted, or trusted.
                    "fiscal_year": {"type": "string", "description": "Fiscal year in exactly YYYY-YY form, e.g. '2025-26'. If the text says 'the current financial year', resolve it from the document's own context to that form. Never output 'current', 'FY2024', or a bare year."},
                    "amount_allocated": {"type": ["number", "null"], "description": "Crores"},
                    "amount_sanctioned": {"type": ["number", "null"], "description": "Crores"},
                    "amount_spent": {"type": ["number", "null"], "description": "Crores"},
                    "scope_type": {"type": "string", "enum": ["ward", "circle", "civic_body"]},
                    "is_rollup": {
                        "type": "boolean",
                        "description": "True if this amount is the arithmetic sum of other rows you are also extracting from this table (a section subtotal or grand total), false for a standalone line item. See the system prompt.",
                    },
                    "evidence": {"type": "string"},
                },
                "required": ["scheme_name", "fiscal_year", "scope_type", "is_rollup", "evidence"],
            },
        },
    },
    "required": ["work_items", "fund_allocations"],
}

client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def extract_from_chunk(text: str, attempts: int = 2) -> dict:
    """One model call -> validated JSON. Tool use forces schema conformance:
    the model must fill our fields rather than free-form prose we then regex.

    maxTokens must be generous: a dense budget-appendix table can yield 50+
    records, and truncating the model mid-tool-call produces an invalid JSON
    sequence that Bedrock rejects outright ("Model produced invalid sequence as
    part of ToolUse"). That failure looks like a model defect but is usually a
    budget the caller set too low.

    Retried once — invalid tool sequences are often transient.
    """
    for attempt in range(attempts):
        try:
            return _extract_once(text)
        except Exception:
            if attempt == attempts - 1:
                raise
    raise AssertionError("unreachable")


def _extract_once(text: str) -> dict:
    response = client.converse(
        modelId=MODEL,
        system=[{"text": SYSTEM}],
        messages=[{"role": "user", "content": [{"text": f"<excerpt>\n{text}\n</excerpt>"}]}],
        toolConfig={
            "tools": [{
                "toolSpec": {
                    "name": "record_extractions",
                    "description": "Record every civic work and fund allocation stated in the excerpt.",
                    "inputSchema": {"json": TOOL_SCHEMA},
                }
            }],
            "toolChoice": {"tool": {"name": "record_extractions"}},
        },
        inferenceConfig={"maxTokens": 8000},
    )
    for block in response["output"]["message"]["content"]:
        if "toolUse" in block:
            payload = block["toolUse"]["input"]
            return {
                "work_items": payload.get("work_items") or [],
                "fund_allocations": payload.get("fund_allocations") or [],
            }
    return {"work_items": [], "fund_allocations": []}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc-id", type=int, required=True)
    ap.add_argument("--limit", type=int, help="process only the first N chunks (dry run)")
    args = ap.parse_args()

    with db.connect() as conn:
        row = conn.execute(
            "SELECT title, doc_type FROM source_document WHERE id = %s", (args.doc_id,)
        ).fetchone()
        if not row:
            raise SystemExit(f"no source_document with id={args.doc_id}")
        title, doc_type = row
        confidence = CONFIDENCE_BY_DOC_TYPE.get(doc_type, "unverified")

        chunks = conn.execute(
            """SELECT id, chunk_text, metadata->>'page_number'
               FROM document_chunk WHERE source_document_id = %s
               ORDER BY (metadata->>'page_number')::int NULLS LAST, id""",
            (args.doc_id,),
        ).fetchall()
        if args.limit:
            chunks = chunks[: args.limit]

        print(f"document {args.doc_id}: {title}")
        print(f"  doc_type={doc_type} -> confidence={confidence}, {len(chunks)} chunk(s), model={MODEL}\n")

        # Idempotency: clear this document's previous extractions so a re-run
        # after a prompt change replaces rather than duplicates.
        deleted_w = conn.execute(
            "DELETE FROM work_item WHERE source_document_ids @> ARRAY[%s]::bigint[]", (args.doc_id,)
        ).rowcount
        deleted_f = conn.execute(
            "DELETE FROM fund_allocation WHERE source_document_id = %s", (args.doc_id,)
        ).rowcount
        if deleted_w or deleted_f:
            print(f"  cleared prior extractions: {deleted_w} work_item, {deleted_f} fund_allocation\n")

        n_works = n_funds = n_spend = n_failed = 0
        for chunk_id, text, page in chunks:
            # One bad chunk must not kill the run. Models occasionally emit an
            # invalid tool-use sequence on messy tables; that is a fact of life
            # in an extraction pipeline, not an exceptional case. Log it, keep
            # going, and report the count at the end so nothing fails silently.
            try:
                result = extract_from_chunk(text)
            except Exception as exc:  # noqa: BLE001
                n_failed += 1
                print(f"  p.{page or '-'} FAIL  {type(exc).__name__}: {str(exc)[-70:]}")
                continue

            for w in result["work_items"]:
                # A ward/circle claim needs either a resolved FK (we have none
                # yet — no circles seeded, no Entity Resolution Agent) or the
                # source's own wording to back it. If the model gave neither,
                # fall back to zone level rather than assert precision we cannot
                # justify. See V4__work_item_location_mention.sql.
                granularity = w["granularity"]
                mention = w.get("location_mention")
                if granularity in ("ward", "circle") and not mention:
                    print(f"  p.{page or '-'} NOTE  {granularity}-level claim without a named place "
                          f"-> recording as zone: {w['title'][:40]}")
                    granularity = "zone"

                work_id = conn.execute(
                    """INSERT INTO work_item
                         (granularity, location_mention, title, category, amount_sanctioned,
                          amount_spent, status, confidence, source_document_ids)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, ARRAY[%s]::bigint[])
                       RETURNING id""",
                    (granularity, mention, w["title"], w["category"], w.get("amount_sanctioned"),
                     w.get("amount_spent"), w["status"], confidence, args.doc_id),
                ).fetchone()[0]
                n_works += 1
                amt = f" Rs.{w['amount_sanctioned']}cr" if w.get("amount_sanctioned") else ""
                print(f"  p.{page or '-'} WORK  [{w['category']}/{w['granularity']}]{amt} {w['title'][:60]}")

                # Per-year history: each figure stays as the document stated it.
                # ON CONFLICT guards against a chunk repeating a year (overlap
                # between chunks means the same sentence can appear twice).
                for s in w.get("spend_by_year") or []:
                    if not FISCAL_YEAR_RE.match((s.get("fiscal_year") or "").strip()):
                        print(f"         ! skipped spend row, bad fiscal_year {s.get('fiscal_year')!r}")
                        continue
                    conn.execute(
                        """INSERT INTO work_item_spend
                             (work_item_id, fiscal_year, amount_spent, basis, evidence, source_document_id)
                           VALUES (%s, %s, %s, %s, %s, %s)
                           ON CONFLICT (work_item_id, fiscal_year, basis) DO NOTHING""",
                        (work_id, s["fiscal_year"], s["amount_spent"], s["basis"],
                         s.get("evidence"), args.doc_id),
                    )
                    n_spend += 1
                    print(f"         â”” FY{s['fiscal_year']} {s['basis']:9} Rs.{s['amount_spent']}cr")

            for f in result["fund_allocations"]:
                # Tool schemas guide the model, they do not bind it â€” validate
                # in code. These two rules kill the dominant failure mode of a
                # first-pass extraction agent: turning headings and index
                # entries into hollow records.
                fy = (f.get("fiscal_year") or "").strip()
                if not FISCAL_YEAR_RE.match(fy):
                    print(f"  p.{page or '-'} SKIP  bad fiscal_year {fy!r}: {f['scheme_name'][:45]}")
                    continue
                # is_rollup is judged by the model (a structural fact about the
                # table it can see), not guessed from the label — "Revenue
                # Income" and "GHMC REVENUES  TOTAL" are both section/grand
                # totals with no shared prefix a regex could catch. ROLLUP_RE
                # is kept only as a second opinion: if the label unmistakably
                # says "Total ..." and the model said False, trust the label.
                is_rollup = bool(f.get("is_rollup")) or bool(ROLLUP_RE.match(f["scheme_name"].strip()))
                if not any(f.get(k) for k in ("amount_allocated", "amount_sanctioned", "amount_spent")):
                    print(f"  p.{page or '-'} SKIP  no amount: {f['scheme_name'][:50]}")
                    continue
                # ON CONFLICT targets the dedup_key generated column (V6) —
                # a literal restatement of the same figure (common across a
                # summary table, a schedule and an appendix) is silently
                # dropped rather than counted twice.
                inserted = conn.execute(
                    """INSERT INTO fund_allocation
                         (scope_type, scope_id, scheme_name, fiscal_year, amount_allocated,
                          amount_sanctioned, amount_spent, is_rollup, status, source_document_id)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (dedup_key) DO NOTHING
                       RETURNING id""",
                    # scope_id 0 = "the civic body as a whole, not yet resolved to a
                    # specific row". Entity resolution (a later agent) maps these.
                    (f["scope_type"], 0, f["scheme_name"], fy,
                     f.get("amount_allocated"), f.get("amount_sanctioned"), f.get("amount_spent"),
                     is_rollup, "provisional", args.doc_id),
                ).fetchone()
                if not inserted:
                    print(f"  p.{page or '-'} DEDUP restatement of prior figure: {f['scheme_name'][:45]}")
                    continue
                n_funds += 1
                tag = " [ROLLUP]" if is_rollup else ""
                print(f"  p.{page or '-'} FUND  [{f['scope_type']}]{tag} {f['scheme_name'][:45]} "
                      f"{fy} alloc={f.get('amount_allocated')}")

            # Commit per chunk. Without this the whole run is one transaction,
            # so a crash at chunk 50 discards 49 chunks of paid-for model work.
            conn.commit()

        print(f"\nextracted {n_works} work_item ({n_spend} yearly spend rows), "
              f"{n_funds} fund_allocation" + (f", {n_failed} chunk(s) FAILED" if n_failed else ""))


if __name__ == "__main__":
    main()
