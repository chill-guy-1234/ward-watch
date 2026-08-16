-- Tag rollup rows instead of guessing which labels to discard.
--
-- WHY: V6 fixed literal duplicates; a ROLLUP_RE label filter caught grand
-- totals starting with "Total"/"Grand Total"/"Budget Size". Neither catches
-- the real structure: budget tables have MULTIPLE levels of subtotal
-- ("Revenue Income" = Tax Revenue + Grants + Fees + ...; no "Total" prefix
-- anywhere), and the same figure is legitimately relabeled across a summary
-- table and a schedule ("Property Tax" == "Tax Revenues", same number).
-- No label regex generalizes to that — it is a structural fact about the
-- table, which only the model reading the table can judge.
--
-- So the model now tags EVERY row rather than the extraction agent silently
-- discarding rows it guesses are rollups. Nothing the source states is
-- thrown away; SUM(amount) WHERE NOT is_rollup is the query that gives a
-- trustworthy total, and is_rollup rows remain as a reconciliation check
-- (a section subtotal should roughly equal the sum of its line items).

ALTER TABLE fund_allocation ADD COLUMN is_rollup BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN fund_allocation.is_rollup IS
    'True if this amount is itself the sum of other rows in the same source table (a section subtotal or grand total) rather than a standalone allocation. Excluded from SUM() totals to avoid double counting.';

CREATE INDEX fund_allocation_non_rollup ON fund_allocation (fiscal_year, scope_type)
    WHERE NOT is_rollup;
