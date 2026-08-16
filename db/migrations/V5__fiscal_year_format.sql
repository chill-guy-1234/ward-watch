-- Constrain fiscal_year to a real fiscal year.
--
-- WHY: V1 declared fiscal_year NOT NULL, which the extraction agent satisfied
-- with strings like 'current Financial Year', 'current' and '2025'. NOT NULL
-- says a value must exist; it says nothing about the value being usable. Rows
-- like these cannot be grouped, charted, or compared across years — they are
-- silently poisonous rather than obviously missing.
--
-- Canonical form is 'YYYY-YY' (e.g. '2025-26'), matching how the documents and
-- Indian government accounting state it.

-- Both tables carry extraction output, so both need cleaning before the
-- constraint can hold. work_item_spend had values like 'FY2024'.
DELETE FROM fund_allocation  WHERE fiscal_year !~ '^\d{4}-\d{2}$';
DELETE FROM work_item_spend  WHERE fiscal_year !~ '^\d{4}-\d{2}$';

ALTER TABLE fund_allocation ADD CONSTRAINT fiscal_year_format
    CHECK (fiscal_year ~ '^\d{4}-\d{2}$');

ALTER TABLE work_item_spend ADD CONSTRAINT spend_fiscal_year_format
    CHECK (fiscal_year ~ '^\d{4}-\d{2}$');
