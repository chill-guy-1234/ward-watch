# Project Handover — Hyderabad Ward Watch

Self-contained brief. Everything a new engineer (or Claude Code) needs to
pick this up cold, without the prior conversation.

## 1. What this is

A civic-accountability tracker for Hyderabad — a "FlightRadar24 for local
government." Lets residents look up their GHMC/CMC/MMC ward and see fund
allocation, sanctioned works, and who (if anyone) currently represents
them, plus a RAG chatbot to ask questions about ingested civic documents.

## 2. Why it's being built (constrains design choices below)

Personal project, built to learn agentic AI concepts hands-on:
vector databases, RAG, and multi-agent orchestration. Feature scope and
architecture choices favor genuine learning surface over shortcuts —
e.g. Step Functions over a single monolithic script, a real vector DB
over keyword search — even where a simpler solution exists.

## 3. Platform decision

**Web app (PWA), not native mobile.** One codebase, installable via
"Add to Home Screen," no App/Play Store review cycle. Native mobile buys
nothing here and doubles effort for zero benefit to the learning goals.

Suggested default stack (not locked in — revisit if it fights the AWS plan):
- Frontend: Next.js
- Backend/agents: AWS Lambda (Python or TypeScript, pick one for consistency)
- No local hosting — building against AWS credits, so everything below is
  chosen to be serverless / scale-to-near-zero when idle.

## 4. Domain context — the civic reality right now (research findings)

This is unusual and central to the design, not incidental:

- **The city's local-body structure just changed.** Dec 2025: 27
  surrounding municipalities merged into GHMC, expanding it from 650 km²
  to 2,053 km² and doubling wards from 150 to 300. Feb 11, 2026: GHMC was
  split into **three** corporations — GHMC, Cyberabad Municipal
  Corporation (CMC), and Malkajgiri Municipal Corporation (MMC, 74 wards
  across 3 zones/14 circles). Combined: 12 zones, 60 circles, 300 wards.
- **There are currently no elected corporators or mayors in any of the
  three bodies.** Councils' terms ended Feb 10, 2026; each body is run by
  an appointed Municipal Commissioner + Special Officer. Elections are
  expected, likely GHMC first, but no confirmed date as of Aug 2026.
- **Budget data**: GHMC approved a ₹11,460 crore city budget for 2026-27,
  with ₹2,260 crore earmarked for the newly merged areas. A ₹2 crore
  per-ward discretionary fund (₹1cr direct + ₹1cr via district minister)
  was approved Nov 25, 2025 — **but that was for the old 150-ward
  structure**, before the 300-ward delimitation was finalized weeks
  later. Whether/how it carries over to 300 wards is unconfirmed publicly.
- **No structured ward-level "allocated vs. spent" dataset exists yet**
  for the new 300-ward structure. What's public is: city/merged-ULB
  totals (solid), and scattered news items about circle/zone-level
  sanctioned works (real numbers and deadlines, but not ward-coded, not
  in one dataset).
- MLA and MP constituency boundaries are **unaffected** by this reorg —
  only municipal ward boundaries changed. Hyderabad city spans mainly 3
  Lok Sabha seats (Hyderabad, Secunderabad, Malkajgiri) plus edges of
  Chevella/Medak in the newly merged outskirts.

**Design implication**: the schema must treat "no representative" and
"no ward-level financial data" as first-class, expected states — not
edge cases to patch later. See §6.

## 5. v1 feature scope

**Core**
1. Ward lookup (locality/pincode search → ward)
2. Fund dashboard (allocated/sanctioned/spent — honest about granularity)
3. Works list per ward/circle with amount, date, status
4. RAG chatbot over ingested civic documents
5. Ward comparison (2+ wards side by side)
6. Every number traces back to a source document/page

**Strongly recommended**
7. Representative status widget — "vacant / Special Officer / elected [name]"
8. City-wide utilization leaderboard (the shareable "FlightRadar moment")
9. Raw semantic search bar over all ingested documents
10. Inline source citations in chatbot answers
11. Ward alert subscriptions

**Nice-to-have**
12. Historical utilization trend (3-5 budget years)
13. Crowdsourced "this doesn't seem to exist" flag, clearly unverified
14. Shareable ward report-card image

**Explicitly v2 — do not build yet**
- MLA-level fund tracking (separate scheme, separate source)
- "Promise vs. action" / speech verification
- News-based cross-verification agent
- Fully automated recurring scraper (v1 can run manually/batch)

## 6. Data schema

Two governing principles baked in throughout:
- **Wards are versioned**, not fixed IDs — boundaries just changed once
  and will again. `valid_from` / `valid_to` on the ward table.
- **Representation and financial data are typed as uncertain by default**
  — nullable person fields with an explicit `status` enum, and a
  `granularity` / `confidence` field on financial data so the app never
  fakes ward-level precision it doesn't have.

```
-- Geography / civic structure
civic_body
  id, name (GHMC | CMC | MMC), formed_date, area_km2,
  commissioner_name, status (interim | council_active)

zone
  id, civic_body_id (FK), name, code

circle
  id, zone_id (FK), name, code

ward                                   -- VERSIONED
  id, ward_number, name, circle_id (FK), civic_body_id (FK),
  population_est, reservation_category (SC | ST | BC | GEN | GEN_WOMEN),
  valid_from, valid_to (NULL = current),
  predecessor_ward_ids (array),        -- maps old 150-ward IDs to new ones
  geometry (GeoJSON, optional/v1.5)

-- People & offices
person
  id, name, photo_url, bio, party_current, social_links

office                                 -- polymorphic office-holder table
  id, office_type (corporator | mayor | deputy_mayor | mla | mp | special_officer),
  scope_type (ward | civic_body | mla_constituency | mp_constituency),
  scope_id,                            -- resolved by scope_type
  person_id (FK, NULLABLE),
  party (NULLABLE),
  term_start, term_end (NULLABLE),
  status (vacant | special_officer | elected),
  source_document_id (FK)

-- MLA / MP mapping (stable, independent of ward reorg)
mp_constituency
  id, name                              -- Hyderabad, Secunderabad, Malkajgiri, Chevella, Medak

mla_constituency
  id, name, mp_constituency_id (FK)

ward_constituency_map                   -- VERSIONED
  ward_id (FK), mla_constituency_id (FK), valid_from, valid_to

-- Money & work tracking
fund_allocation
  id, scope_type (ward | circle | civic_body),
  scope_id,
  scheme_name (e.g. "GHMC Ward Dev Fund", "MLA-CDS", "MPLADS"),
  fiscal_year, amount_allocated, amount_sanctioned, amount_spent,
  status (confirmed | provisional | unconfirmed_for_300ward_split),
  source_document_id (FK), last_updated

work_item
  id, granularity (ward | circle | zone | city),
  ward_id (NULLABLE), circle_id (NULLABLE),
  title, category (roads | drainage | streetlight | sanitation | other),
  amount_sanctioned, amount_spent,
  status (planned | sanctioned | ongoing | completed | stalled),
  sanctioned_date, target_completion_date, actual_completion_date,
  confidence (official | reported | unverified),
  source_document_ids (array FK)

-- Elections (populates `office` automatically once results land)
election
  id, civic_body_id (FK), announced_date, scheduled_date,
  actual_date (NULLABLE), status (announced | postponed | held),
  source_document_id (FK)

election_result
  id, election_id (FK), ward_id (FK), person_id (FK), party,
  votes (optional), source_document_id (FK)

-- RAG / ingestion
source_document
  id, title, url, publisher, doc_type (budget_pdf | news | GO | RTI | scraped_page),
  published_date, ingested_date, extraction_status

document_chunk
  id, source_document_id (FK), chunk_text, embedding_vector,
  tags { ward_ids[], circle_id, civic_body_id, topic },
  metadata { page_number, section }

-- User-facing
user
  id, home_ward_id, notification_prefs

alert_subscription
  id, user_id (FK), ward_id (FK),
  alert_type (new_work | fund_release | election_update | rep_change)
```

## 7. Agent / orchestration architecture

```
(scheduled) → Scraper Agent → Extraction Agent → ┬→ Entity Resolution Agent → Verification Agent → DB Writer → Alert Agent
                                                   └→ Embedding Agent → vector DB
                                                                              ↓
                                                                        RAG Chatbot (hybrid: vector search + SQL)
```

- **Scraper Agent** — pulls GHMC/CMC/MMC sites, budget PDFs, GOs, news
  feeds, data.opencity.in
- **Extraction Agent** — turns PDF tables/news into structured fields;
  tags `granularity` and `confidence` at extraction time, not later
- **Entity Resolution Agent** — matches extracted people/wards/works to
  existing records, dedupes (critical given ward renumbering)
- **Verification Agent** — cross-checks a claim across ≥2 sources before
  marking `confidence = official`
- **Embedding Agent** — writes `document_chunk` rows + vectors
- **Alert Agent** — notifies subscribers on new matching data
- **Election Watch Agent** (separate scheduled agent, this is the one
  that auto-populates corporators/mayor once elections happen): watches
  election news + Telangana SEC sources → writes/updates `election` →
  on results, writes `election_result` rows → hands off to Entity
  Resolution Agent to match winners to `person` records → writes new
  `office` rows with `status = 'elected'`, closing out the prior
  `special_officer` row's `term_end`. No schema change needed when this
  fires — just new rows.
- **RAG Chatbot** — hybrid retrieval: vector search over
  `document_chunk` + structured SQL queries over the relational tables

## 8. AWS hosting plan

Chosen for: serverless/pay-per-use (credits, not a hosting budget), and
maximum genuine learning surface for orchestration specifically.

| Layer | Service | Notes |
|---|---|---|
| Frontend hosting | Amplify Hosting | Connect to GitHub repo, auto-deploys on push |
| DB (relational + vector) | **Aurora Serverless v2 Postgres + pgvector** | One DB for both jobs; scales down (and cost) when idle — use this, not standard always-on RDS |
| Agent compute | Lambda | One function per agent |
| Orchestration | **Step Functions** | Chains the agent pipeline in §7; visual state machine, built-in retries — the most literal orchestration-learning piece |
| Scheduling | EventBridge | Cron trigger for scraper / Election Watch Agent |
| LLM calls | Bedrock (Claude) or direct Anthropic API | Either works; start with direct API for simplicity, move to Bedrock later if you want it on the same AWS bill |
| Notifications | SNS / SES | Ward alerts |
| Access control | IAM | Non-root user for day-to-day; scoped roles per Lambda (e.g. "this function can read/write this DB and nothing else") |

**Setup order:**
1. IAM user (not root) for day-to-day work
2. GitHub repo → Amplify Hosting, confirm auto-deploy works on a trivial push
3. Aurora Serverless v2 Postgres → `CREATE EXTENSION vector;`
4. First Lambda (scraper) fully working standalone before adding more
5. Wire 2-3 working Lambdas together in Step Functions
6. EventBridge rule to trigger the state machine daily
7. Only Amplify + Lambda are public-facing; DB stays private

Once v1 is stable, move infra definitions into **AWS CDK** instead of
manual console clicks, for reproducibility.

## 9. Data sources identified so far

- GHMC budget documents — data.opencity.in (CKAN dataset, historical PDFs)
  and ghmc.gov.in directly
- Government Orders: G.O. Ms. No. 292 (Dec 24, 2025 — merger); G.O. Ms.
  No. 55 and G.O. Rt. No. 203 (Feb 11, 2026 — trifurcation)
- Telangana State Election Commission — for election schedule/results
- News coverage used during research (candidates for the scraper's news
  source list): Telangana Today, Siasat, Deccan Chronicle, NewsMeter,
  ETV Bharat, IND Today
- Wikipedia — stable reference for MLA/MP constituency boundaries and
  neighborhood-level constituency mapping; good for hand-seeding the
  `ward_constituency_map` table since these boundaries don't move with
  the municipal reorg
- No official downloadable 300-ward list/CSV found yet — likely needs to
  be scraped from GHMC's site once published, or transcribed from the GOs

## 10. Suggested build order

1. Seed static schema data: civic_body, zone, circle, ward (current 300),
   mla/mp constituency + crosswalk
2. Ingest city/merged-ULB budget totals + circle-level works feed (this
   is the data that's actually solid right now)
3. Ward lookup + "representation status" UI — genuinely useful even with
   zero financial granularity, and not something anyone else is surfacing
4. RAG chatbot over whatever's ingested so far
5. Election Watch Agent — build and test against *historical* Telangana
   election data now, so it's proven correct before real results start
   arriving
6. Alerts

## 11. Open questions to resolve during build (not blocking, but flag)

- Whether the ₹2cr/ward discretionary scheme has been formally
  reconfirmed for the 300-ward structure — watch for a follow-up GO
- No confirmed election date yet for any of the three bodies — Election
  Watch Agent should be built to handle "no election scheduled" as a
  steady state, not assume one is imminent
- Whether to track GHMC, CMC, and MMC as equal peers from day one, or
  ship GHMC-only first and add CMC/MMC once their data pipelines are
  proven (recommend: build the schema for all three now, since it's the
  same shape, but it's fine to only *populate* GHMC first)
