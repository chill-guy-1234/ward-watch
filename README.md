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

> ⚠️ Elections and fund confirmations move. Re-verify handover doc §4 and §11
> before writing code that depends on them.

## Status

| Phase | What | State |
|---|---|---|
| 0 | Repo + civic-status verification pass | done |
| 1 | Schema + static seed data (local Postgres) | done |
| 2 | Ingestion + embeddings + RAG chatbot | done |
| 3 | Extraction agent (documents → structured rows) | built; fund totals unreliable, see note below |
| 4 | Deploy to AWS (Aurora, Lambda, Amplify) | Aurora live (with ingested data) + 2 Lambdas live (`wardwatch-healthcheck`, public `wardwatch-chatbot`); Amplify pending — see `docs/PHASE4-AWS-CONSOLE-SETUP.md` |
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
  Both Dockerfiles build from the REPO ROOT (not their own directory) so
  they COPY pipeline/db.py + embeddings.py directly — one copy of each,
  no drift between what's deployed and what runs locally.
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

Wards and circles are deliberately **not** seeded yet: no official
machine-readable 300-ward list exists, and re-delimitation is pending.
