-- Hyderabad Ward Watch — initial schema (handover doc §6).
-- Two governing principles:
--   1. Wards are VERSIONED (valid_from/valid_to) — boundaries changed in 2025/26
--      and a further 300→400 delimitation is already proposed.
--   2. Representation and financial data are uncertain by default — nullable
--      person fields with explicit status enums, and granularity/confidence
--      fields so the app never fakes precision it doesn't have.

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- RAG / ingestion (first: nearly everything references source_document)
-- =====================================================================

CREATE TABLE source_document (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title             TEXT NOT NULL,
    url               TEXT,
    publisher         TEXT,
    doc_type          TEXT NOT NULL CHECK (doc_type IN ('budget_pdf', 'news', 'GO', 'RTI', 'scraped_page')),
    published_date    DATE,
    ingested_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
    extraction_status TEXT NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'extracted', 'failed'))
);

CREATE TABLE document_chunk (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_document_id BIGINT NOT NULL REFERENCES source_document(id),
    chunk_text         TEXT NOT NULL,
    -- 1024 dims = Bedrock Titan Text Embeddings V2 / Voyage 3 family.
    -- If we switch embedding models to a different dimension, that is a new
    -- migration + re-embedding job, not an edit here.
    embedding          vector(1024),
    tags               JSONB NOT NULL DEFAULT '{}',   -- { ward_ids: [], circle_id, civic_body_id, topic }
    metadata           JSONB NOT NULL DEFAULT '{}'    -- { page_number, section }
);

-- =====================================================================
-- Geography / civic structure
-- =====================================================================

CREATE TABLE civic_body (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE CHECK (name IN ('GHMC', 'CMC', 'MMC')),
    formed_date       DATE,
    area_km2          NUMERIC,
    commissioner_name TEXT,
    status            TEXT NOT NULL DEFAULT 'interim' CHECK (status IN ('interim', 'council_active'))
);

CREATE TABLE zone (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    civic_body_id BIGINT NOT NULL REFERENCES civic_body(id),
    name          TEXT NOT NULL,
    code          TEXT,
    UNIQUE (civic_body_id, name)
);

CREATE TABLE circle (
    id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zone_id BIGINT NOT NULL REFERENCES zone(id),
    name    TEXT NOT NULL,
    code    TEXT,
    UNIQUE (zone_id, name)
);

CREATE TABLE ward (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ward_number          INT NOT NULL,
    name                 TEXT NOT NULL,
    -- circle assignment may not be public yet for every ward version
    circle_id            BIGINT REFERENCES circle(id),
    civic_body_id        BIGINT NOT NULL REFERENCES civic_body(id),
    population_est       INT,
    reservation_category TEXT CHECK (reservation_category IN ('SC', 'ST', 'BC', 'GEN', 'GEN_WOMEN')),
    valid_from           DATE NOT NULL,
    valid_to             DATE,                          -- NULL = currently in force
    predecessor_ward_ids BIGINT[] NOT NULL DEFAULT '{}', -- maps prior-version wards to this one
    geometry             JSONB                           -- GeoJSON, optional / v1.5
);

CREATE INDEX ward_current_lookup ON ward (civic_body_id, ward_number) WHERE valid_to IS NULL;

-- =====================================================================
-- People & offices
-- =====================================================================

CREATE TABLE person (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          TEXT NOT NULL,
    photo_url     TEXT,
    bio           TEXT,
    party_current TEXT,
    social_links  JSONB NOT NULL DEFAULT '{}'
);

-- Polymorphic office-holder table: scope_id resolves against a different table
-- depending on scope_type, so it carries no FK. "Nobody holds this office" is a
-- normal row (person_id NULL, status vacant/special_officer), not a missing row.
CREATE TABLE office (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    office_type        TEXT NOT NULL CHECK (office_type IN ('corporator', 'mayor', 'deputy_mayor', 'mla', 'mp', 'special_officer')),
    scope_type         TEXT NOT NULL CHECK (scope_type IN ('ward', 'civic_body', 'mla_constituency', 'mp_constituency')),
    scope_id           BIGINT NOT NULL,
    person_id          BIGINT REFERENCES person(id),
    party              TEXT,
    term_start         DATE,
    term_end           DATE,
    status             TEXT NOT NULL CHECK (status IN ('vacant', 'special_officer', 'elected')),
    source_document_id BIGINT REFERENCES source_document(id),
    CONSTRAINT elected_office_has_person CHECK (status <> 'elected' OR person_id IS NOT NULL)
);

-- =====================================================================
-- MLA / MP mapping (stable — unaffected by municipal ward reorgs)
-- =====================================================================

CREATE TABLE mp_constituency (
    id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE mla_constituency (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name               TEXT NOT NULL UNIQUE,
    mp_constituency_id BIGINT NOT NULL REFERENCES mp_constituency(id)
);

CREATE TABLE ward_constituency_map (
    ward_id             BIGINT NOT NULL REFERENCES ward(id),
    mla_constituency_id BIGINT NOT NULL REFERENCES mla_constituency(id),
    valid_from          DATE NOT NULL,
    valid_to            DATE,
    PRIMARY KEY (ward_id, mla_constituency_id, valid_from)
);

-- =====================================================================
-- Money & work tracking
-- =====================================================================

CREATE TABLE fund_allocation (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scope_type         TEXT NOT NULL CHECK (scope_type IN ('ward', 'circle', 'civic_body')),
    scope_id           BIGINT NOT NULL,
    scheme_name        TEXT NOT NULL,          -- e.g. 'GHMC Ward Dev Fund', 'MLA-CDS', 'MPLADS'
    fiscal_year        TEXT NOT NULL,          -- e.g. '2026-27'
    amount_allocated   NUMERIC,
    amount_sanctioned  NUMERIC,
    amount_spent       NUMERIC,
    status             TEXT NOT NULL CHECK (status IN ('confirmed', 'provisional', 'unconfirmed_for_300ward_split')),
    source_document_id BIGINT REFERENCES source_document(id),
    last_updated       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE work_item (
    id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    granularity            TEXT NOT NULL CHECK (granularity IN ('ward', 'circle', 'zone', 'city')),
    ward_id                BIGINT REFERENCES ward(id),
    circle_id              BIGINT REFERENCES circle(id),
    title                  TEXT NOT NULL,
    category               TEXT NOT NULL CHECK (category IN ('roads', 'drainage', 'streetlight', 'sanitation', 'other')),
    amount_sanctioned      NUMERIC,
    amount_spent           NUMERIC,
    status                 TEXT NOT NULL CHECK (status IN ('planned', 'sanctioned', 'ongoing', 'completed', 'stalled')),
    sanctioned_date        DATE,
    target_completion_date DATE,
    actual_completion_date DATE,
    confidence             TEXT NOT NULL CHECK (confidence IN ('official', 'reported', 'unverified')),
    source_document_ids    BIGINT[] NOT NULL DEFAULT '{}',
    -- granularity dictates which location column must be filled
    CONSTRAINT ward_granularity_has_ward     CHECK (granularity <> 'ward' OR ward_id IS NOT NULL),
    CONSTRAINT circle_granularity_has_circle CHECK (granularity <> 'circle' OR circle_id IS NOT NULL)
);

-- =====================================================================
-- Elections (populates `office` once results land — new rows, no schema change)
-- =====================================================================

CREATE TABLE election (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    civic_body_id      BIGINT NOT NULL REFERENCES civic_body(id),
    announced_date     DATE,
    scheduled_date     DATE,
    actual_date        DATE,
    status             TEXT NOT NULL CHECK (status IN ('announced', 'postponed', 'held')),
    source_document_id BIGINT REFERENCES source_document(id)
);

CREATE TABLE election_result (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    election_id        BIGINT NOT NULL REFERENCES election(id),
    ward_id            BIGINT NOT NULL REFERENCES ward(id),
    person_id          BIGINT NOT NULL REFERENCES person(id),
    party              TEXT,
    votes              INT,
    source_document_id BIGINT REFERENCES source_document(id)
);

-- =====================================================================
-- User-facing ("user" is a reserved word in Postgres, hence app_user)
-- =====================================================================

CREATE TABLE app_user (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    home_ward_id       BIGINT REFERENCES ward(id),
    notification_prefs JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE alert_subscription (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES app_user(id),
    ward_id    BIGINT NOT NULL REFERENCES ward(id),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('new_work', 'fund_release', 'election_update', 'rep_change')),
    UNIQUE (user_id, ward_id, alert_type)
);
