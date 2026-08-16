-- Per-fiscal-year spending on a work item.
--
-- WHY: V1 gave work_item a single amount_spent column, but the source documents
-- report spending per year ("Rs.179.90 Cr in 2023-24 ... Rs. 40.33 Cr this
-- year"). With one column the extraction agent had nowhere to put the history,
-- and was observed silently SUMMING years into a total that appears nowhere in
-- the document — exactly the kind of untraceable number this project exists to
-- eliminate. A work spans years; its spending is a child fact, not a scalar.
--
-- work_item.amount_spent is retained as the most recent stated figure (a
-- convenience for listings); this table is the authoritative history.

CREATE TABLE work_item_spend (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    work_item_id       BIGINT NOT NULL REFERENCES work_item(id) ON DELETE CASCADE,
    fiscal_year        TEXT NOT NULL,                    -- e.g. '2023-24'
    amount_spent       NUMERIC NOT NULL,                 -- crores, as stated
    -- Whether the figure is money already incurred or a forward estimate. The
    -- documents mix both in the same sentence ("...had been spent ... it is
    -- estimated to spend..."), and conflating them would overstate delivery.
    basis              TEXT NOT NULL DEFAULT 'actual' CHECK (basis IN ('actual', 'estimated')),
    -- The sentence this figure came from, so any displayed number can be shown
    -- next to its source text without re-reading the PDF.
    evidence           TEXT,
    source_document_id BIGINT REFERENCES source_document(id),
    UNIQUE (work_item_id, fiscal_year, basis)
);

CREATE INDEX work_item_spend_by_work ON work_item_spend (work_item_id);
