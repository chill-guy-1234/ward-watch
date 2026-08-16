# Hyderabad Ward Watch

A civic-accountability tracker for Hyderabad — a "FlightRadar24 for local
government." Residents look up their GHMC/CMC/MMC ward and see fund allocation,
sanctioned works, and who (if anyone) represents them, plus a RAG chatbot over
ingested civic documents.

Full brief: [`PROJECT_HANDOVER.md`](PROJECT_HANDOVER.md).
Current civic-status research: [`docs/VERIFICATION-2026-08-15.md`](docs/VERIFICATION-2026-08-15.md).
AWS concepts (VPC/subnets/security groups, Aurora, ECR vs ECS, how Lambda gets
called from a UI): [`docs/CONCEPTS-AWS.md`](docs/CONCEPTS-AWS.md).
Phase 4 console setup steps: [`docs/PHASE4-AWS-CONSOLE-SETUP.md`](docs/PHASE4-AWS-CONSOLE-SETUP.md).
Security posture — what's protected, what isn't yet, and why:
[`docs/SECURITY.md`](docs/SECURITY.md).

> ⚠️ Elections and fund confirmations move. Re-verify handover doc §4 and §11
> before writing code that depends on them.

## Status

| Phase | What | State |
|---|---|---|
| 0 | Repo + civic-status verification pass | done |
| 1 | Schema + static seed data (local Postgres) | done |
| 2 | Ingestion + embeddings + RAG chatbot | done |
| 3 | Extraction agent (documents → structured rows) | built; fund totals unreliable, see note below |
| 4 | Deploy to AWS (Aurora, Lambda, Amplify) | Aurora live (300 wards seeded) + 3 Lambdas live (healthcheck, public chatbot, public ward lookup) + frontend built; Amplify Hosting connection is a console step — see `docs/PHASE4-AWS-CONSOLE-SETUP.md` Stage 4 |
| 5 | Step Functions orchestration, alerts, Election Watch Agent | |

## Layout

```
db/migrations/     Flyway SQL migrations (V1 schema, V2 static seed)
pipeline/          Python: ingestion + RAG
  db.py            Postgres connection + pgvector registration
  embeddings.py    Bedrock Nova embeddings — read the docstring for how
                   embeddings and cosine similarity actually work
  chat_logic.py    the RAG loop itself (condense → retrieve → generate) —
                   shared by chat.py (CLI) and lambda/chatbot (public API)
  ingest.py        extract → chunk → embed → store
  chat.py          terminal chatbot: thin CLI wrapper around chat_logic.py
  smoke_test.py    non-interactive end-to-end check
lambda/            Deployed AWS Lambda functions (container images)
  healthcheck/     proves the connectivity chain: IAM role → Secrets
                   Manager → Aurora → Bedrock. Invoke-only, no public URL.
  chatbot/         wraps chat_logic.py behind a public Function URL — the
                   UI-facing endpoint a frontend will call directly
  wardlookup/      structured search over the seeded 300-ward table
  Dockerfiles build from the REPO ROOT (not their own directory) so they
  COPY pipeline/db.py + embeddings.py directly — one copy of each, no
  drift between what's deployed and what runs locally.
frontend/          Next.js app (static export), deployed via Amplify
                   Hosting — chat / ward lookup / about, calling the
                   Function URLs above directly, no server compute needed
data/raw/          source documents (gitignored — not code)
docs/              research and verification notes
```

## Prerequisites

- Docker Desktop (local Postgres + Flyway)
- Python 3.12
- AWS Bedrock access in `us-east-1`, via `AWS_BEARER_TOKEN_BEDROCK`
  (a Bedrock API key) or standard AWS credentials

## Setup

```powershell
# 1. Configuration — copy the template and fill in your values
Copy-Item .env.example .env
#    then edit .env: set POSTGRES_PASSWORD and AWS_BEARER_TOKEN_BEDROCK

# 2. Database (Postgres 16 + pgvector) and schema
docker compose up -d db
docker compose run --rm flyway          # applies db/migrations in order

# 3. Python environment
python -m venv .venv
.\.venv\Scripts\pip install -r pipeline\requirements.txt
```

### Secrets

All configuration lives in `.env` at the repo root — gitignored, never
committed. `docker compose` reads it automatically; the Python pipeline loads it
via `python-dotenv` in `pipeline/db.py`. A real environment variable always
overrides the file, so Lambda and CI can inject values without one.

`.env.example` is committed as the template — update it whenever you add a
setting, so the next person knows what's required.

**Why not AWS Secrets Manager yet?** It's the right home for the *Aurora*
password in Phase 4: Lambdas fetch it at runtime through their IAM role, so the
production password exists in no file, no env var, and no repo. It is the wrong
home for two things we have today — a Postgres container on your laptop (paying
$0.40/month to protect `wardwatch_dev` buys nothing), and the Bedrock API key
itself, which is the *bootstrap* credential: reading Secrets Manager requires
AWS credentials, so that key must live outside the vault it would open.

Connect a GUI client (DBeaver etc.) with host `localhost`, port `5432`,
database/user `wardwatch`, password `wardwatch_dev`. Note: containers on the
Docker network reach the database as `db`, your machine reaches it as
`localhost` — same database, different vantage points.

## Usage

```powershell
cd pipeline

# Ingest a document (PDF, .txt or .md)
..\.venv\Scripts\python ingest.py ..\data\raw\ghmc-budget-2025-26.pdf `
    --title "GHMC Budget Estimates 2025-26" --doc-type budget_pdf `
    --publisher GHMC --published-date 2025-02-01

# Ask questions about what's been ingested
..\.venv\Scripts\python chat.py

# Verify the whole pipeline still works
..\.venv\Scripts\python smoke_test.py
```

### General-knowledge corpus (2026-08-16)

Until this point the chatbot could only answer from the budget PDF and one
trifurcation article — accurate, but narrow. Six Wikipedia articles were
added under `data/raw/general/` (city overview, history, economy,
administration, demographics, list of mayors) so it can also answer
general questions about the city.

**Sourcing tier is deliberately lighter than the ward data.** The 300-ward
seed (V8) was cross-checked against the official delimitation gazette for a
sample of wards; these six articles were not independently fact-checked
against primary sources — that would mean re-verifying an entire city's
history and economy, out of proportion to what this pass was for. The one
exception: the mayors list's claim that the post has been vacant since 10
February 2026 was cross-checked against the article's own infobox field
(`incumbentsince`), and matches Ward Watch's own `civic_body`/`office` seed
data independently.

The mayors list needed a different extraction path than the others:
Wikipedia's plain-text extract API silently drops wikitables, and the
actual list of mayors *is* a wikitable — the naive extract came back with
section headers and no names. Fixed by fetching raw wikitext (same
technique as the V8 ward-list parse) and parsing the table directly,
producing 21 MCH-era mayors (1951–2007) and 4 GHMC-era mayors (2007–2026).
Several 1970s–80s entries have no recorded name in the source itself — a
genuine gap in the historical record, not a parsing failure.

Ingested into both Aurora and local Postgres the same way as any other
document (`doc-type scraped_page`, `--publisher Wikipedia`).

### Secunderabad Cantonment Board + HMDA (2026-08-16)

A user question surfaced a real gap: **Secunderabad Cantonment Board (SCB)**
is a fourth civic body in the Hyderabad metro, geographically embedded in
the urban core, administered by the Ministry of Defence (not the state
government) under the Cantonments Act 2006 — chaired by a serving military
officer. It is not GHMC/CMC/MMC and was entirely absent from Ward Watch's
knowledge before this. Its elected board's term expired in **2021** (longer
without an election than any of the three bodies Ward Watch already
covers), and a 2023 proposal to merge its civilian areas into GHMC remains
unresolved as of the most recent reporting found — a competing proposal to
merge into MMC instead was also contested. Two documents ingested: a
Wikipedia overview, and a hand-composed status note citing the news
articles on the merger dispute (Wikipedia's own SCB article doesn't cover
it). **Not** added to the `ward`/`civic_body` schema — that would need the
same gazette-level sourcing rigor as the 300-ward GHMC/CMC/MMC data, and
SCB's own ward boundaries aren't something this pass verified. Chatbot-only
for now.

Also ingested **HMDA** (Hyderabad Metropolitan Development Authority) while
researching this — a commonly-confused *different kind* of body: a
7,257 km² planning/coordination authority with no wards or elections
(appointed Metropolitan Commissioner, CM as Chairman), not a rival
municipal government. GHMC/CMC/MMC/SCB sit inside HMDA's much larger
planning area alongside many gram panchayats HMDA plans for but that were
never in Ward Watch's scope. Included so the chatbot can correctly explain
"what's the difference between GHMC and HMDA" — a genuinely common
question — rather than being silent on it.

Verified end-to-end: correctly explains SCB is not part of GHMC, cites the
merger dispute, and correctly distinguishes GHMC's elected-ward governance
from HMDA's appointed planning role.

### Deployed chatbot endpoint

The same RAG loop is also live as a public Lambda, callable without any AWS
credentials — this is what a future frontend will call:

```
POST https://xqknt4qdig7qifx7mcojdicamu0yiyoc.lambda-url.us-east-1.on.aws/
Content-Type: application/json

{"message": "What is the total budget for GHMC?", "history": []}
```

Returns `{"answer": "...", "sources": [...], "history": [...]}` — send back
the returned `history` on the next call to continue the conversation (the
Lambda has no memory between invocations). Details in
`docs/PHASE4-AWS-CONSOLE-SETUP.md` Stage 3b.

### Deployed ward lookup endpoint

A second public Lambda searches the 300-ward structure seeded in V8/V9:

```
GET https://bb523lbg7ub77ksjojsbb5fhsm0fooht.lambda-url.us-east-1.on.aws/?q=95
GET https://bb523lbg7ub77ksjojsbb5fhsm0fooht.lambda-url.us-east-1.on.aws/?q=jubilee
```

`q` is either an exact ward number or a case-insensitive substring match on
ward name. Returns up to 20 matches, each with zone, circle, civic body, and
`corporator_status`/`civic_body_status` straight from the `office` table —
no fund/works data (still unreliable, see the extraction caveat above).

## Frontend

```powershell
cd frontend
npm install
npm run dev       # http://localhost:3000, calls the deployed Lambdas directly
npm run build     # static export to frontend/out/ (next.config.ts: output: 'export')
```

Three routes: ward lookup (`/`), transport map (`/transport`), about
(`/about`), plus the chatbot as a floating bubble available on every page.
No SSR, no API routes — plain client-side `fetch` to the public Function
URLs, so Amplify Hosting only ever serves static files. Deployment is a
one-time console step (GitHub OAuth) — see
`docs/PHASE4-AWS-CONSOLE-SETUP.md` Stage 4.

The transport map (`app/transport/`) is the one page with no backend at
all: coordinates are a static, hand-traced dataset in `data.ts` (no GTFS
feed exists for Hyderabad), rendered with Leaflet on CARTO/OSM tiles.
Leaflet is loaded via `next/dynamic` with `ssr: false` — it touches
`window` at import time and would otherwise crash the static export's
prerender pass. Only services carrying passengers today are drawn; Metro
Phase 2 is excluded while it remains unapproved.

## How the RAG pipeline works

```
document ──► extract text ──► chunk (~3000 chars, 400 overlap)
                                 │
                                 ├──► embed (Nova, 1024 dims) ──┐
                                 └──────────────────────────────┴──► document_chunk

question ──► condense (cheap model) ──► embed ──► pgvector search ──► top 8 chunks
                                                                          │
                                          model answers ONLY from those ◄──┘
                                          chunks, citing [n] per claim
```

Chunking overlaps by 400 characters so a sentence split across a boundary still
appears whole somewhere. Page numbers ride along in `document_chunk.metadata`,
which is what lets answers cite a specific page.

**Condensation** rewrites the user's message into a focused standalone search
query before embedding. It fixes two measured failure modes: rambling questions
dilute the embedding (a 686-char version of a street-lighting question pushed
the actual STREET LIGHTING page out of the top 3), and bare follow-ups like
"what about drainage?" retrieve almost nothing — the embedding model never sees
conversation history, and history can only reuse chunks an *earlier* retrieval
fetched. See `condense()` in `chat.py`.

**History holds bare Q&A only** — retrieved excerpts are attached to the current
question and never stored, so past turns' evidence isn't re-sent and re-billed
on every call (~6000 tokens per turn if kept).

## Extraction (Phase 3)

`pipeline/extract.py` reads ingested chunks and emits typed rows — the mirror
image of the chatbot. Run it per document:

```powershell
..\.venv\Scripts\python extract.py --doc-id 1              # whole document
..\.venv\Scripts\python extract.py --doc-id 1 --limit 8    # cheap dry run
```

It is idempotent: a re-run clears that document's prior extractions first.

> ⚠️ **Known limitation — do not `SUM()` `fund_allocation` for a city total.**
> Three fixes landed (V3–V7: per-year spend history, location mentions,
> canonical fiscal-year format, exact-duplicate dedup, `is_rollup` tagging for
> subtotals/grand-totals) and each closed a real gap — but a 2025-26 total still
> comes out ~5.4× the real ₹8,440 cr. Remaining cause: budget PDFs restate the
> same figure under near-synonymous labels across a summary table, a schedule,
> and a departmental annexure ("H-CITI GRANTS" / "Assistance to GHMC for
> H-CITI"; "State Finance Commission Grant" / "STATE FINANCE COMMISSION
> GRANTS" / "Revenue Grants – SFC Grants" — same ₹800cr, three spellings).
> Exact-match dedup cannot catch this; a real fix needs either fuzzy/semantic
> matching (risks false-positive merges of genuinely different schemes) or
> restricting extraction to one canonical table per document instead of every
> table — both bigger than a prompt fix, deliberately not attempted yet.
>
> **What IS reliable today:** individual scheme lookups (one row, e.g. "street
> lighting allocation"), `is_rollup=false` filtering (removes subtotal/total
> rows correctly), and the RAG chatbot (`chat.py`), which answers from cited
> excerpts rather than a SQL aggregate. `work_item` rows are cleaner but
> sparse — few carry an amount, and this budget PDF has no ward-level detail.

## Models

| Role | Model | Configured in |
|---|---|---|
| Embeddings | `amazon.nova-2-multimodal-embeddings-v1:0` | `pipeline/embeddings.py` |
| Query condensation | `us.amazon.nova-2-lite-v1:0` | `pipeline/chat.py` (`WARDWATCH_CONDENSE_MODEL`) |
| Chat / RAG | `us.deepseek.r1-v1:0` | `pipeline/chat.py` (`WARDWATCH_CHAT_MODEL`) |

Two models by design: a cheap fast one prepares the search query on every
message, a stronger one reasons over the retrieved evidence. Routing by task
value is how an agentic pipeline stays affordable.

Everything goes through Bedrock's provider-agnostic `converse` API, so swapping
models is one environment variable. Anthropic models are currently blocked on
this account (Marketplace agreement fails with `INVALID_PAYMENT_INSTRUMENT`);
switch `WARDWATCH_CHAT_MODEL` to `anthropic.claude-opus-5` once that clears.

## Schema notes

Two principles from the handover doc, enforced in `V1__init_schema.sql`:

- **Wards are versioned**, not fixed IDs (`valid_from` / `valid_to` /
  `predecessor_ward_ids`). Boundaries changed in 2025-26 and a further
  300 → 400 delimitation is already proposed.
- **Representation and financial data are uncertain by default** — nullable
  person fields with an explicit `status` enum, plus `granularity` /
  `confidence` on financial data, so the app never fakes ward-level precision
  it doesn't have. "No corporator" is a row, not a missing row.

Migrations are immutable once applied — Flyway checksums each file and records
it in `flyway_schema_history`. Schema changes always go in a new `V*` file.

**Wards and circles are seeded** (`V8__seed_current_wards.sql`): the current
300-ward structure (GHMC 150 / CMC 76 / MMC 74), transcribed from Wikipedia's
"Administrative divisions of Hyderabad" and cross-checked against the primary
source — Telangana Gazette Extraordinary No. 773, 25 Dec 2025 — for a sample
of wards. One transcription error found and fixed (wards 95/96 were
transposed); everything else in the sample matched. `reservation_category`,
`population_est`, and `geometry` are deliberately left NULL — not available
at ward granularity from these sources, and not fabricated. See V8's own
comment header for the full sourcing trail.

A further 300 → 400 delimitation is still proposed (unconfirmed) — that's
what the `valid_from`/`valid_to` versioning exists for; a future migration
will close out `valid_to` on the current 300 and insert the next version
rather than editing these rows in place.
