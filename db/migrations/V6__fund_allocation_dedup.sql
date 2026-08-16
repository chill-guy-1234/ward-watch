-- Prevent the same fund allocation being inserted twice from the same document.
--
-- WHY: budget PDFs restate the same figures across a summary table, a detailed
-- schedule and an appendix (e.g. "Land Acquisition, 2025-26, Rs.283cr"
-- appeared identically 3 times). Each chunk is extracted independently, so the
-- agent has no way to know a fact was already recorded from an earlier chunk
-- of the same document — the database is the only place that can catch it.
--
-- A generated STORED column is used instead of a UNIQUE constraint directly on
-- the amount columns because Postgres treats NULL as distinct from NULL in
-- uniqueness checks — two rows that are identical except both have
-- amount_spent = NULL would NOT collide on a plain UNIQUE(...) constraint.
-- coalesce()-ing every field into one text key sidesteps that, and gives
-- extract.py a single column to target with ON CONFLICT ... DO NOTHING.
--
-- This catches LITERAL restatements only (same scheme_name, same numbers). It
-- does NOT catch the same money reported under different labels ("Total
-- Expenditure" vs "Budget Size (RE+CE)") — that is a modelling problem, not a
-- data problem, and is handled by the ROLLUP_RE filter in extract.py instead.

-- Keep the earliest row of each duplicate group, drop the rest.
DELETE FROM fund_allocation fa
USING fund_allocation dup
WHERE fa.id > dup.id
  AND fa.source_document_id IS NOT DISTINCT FROM dup.source_document_id
  AND fa.scope_type           = dup.scope_type
  AND lower(fa.scheme_name)   = lower(dup.scheme_name)
  AND fa.fiscal_year          = dup.fiscal_year
  AND fa.amount_allocated  IS NOT DISTINCT FROM dup.amount_allocated
  AND fa.amount_sanctioned IS NOT DISTINCT FROM dup.amount_sanctioned
  AND fa.amount_spent      IS NOT DISTINCT FROM dup.amount_spent;

ALTER TABLE fund_allocation ADD COLUMN dedup_key TEXT GENERATED ALWAYS AS (
    coalesce(source_document_id::text, '') || '|' ||
    scope_type || '|' ||
    lower(scheme_name) || '|' ||
    fiscal_year || '|' ||
    coalesce(amount_allocated::text, '')  || '|' ||
    coalesce(amount_sanctioned::text, '') || '|' ||
    coalesce(amount_spent::text, '')
) STORED;

ALTER TABLE fund_allocation ADD CONSTRAINT fund_allocation_dedup UNIQUE (dedup_key);
