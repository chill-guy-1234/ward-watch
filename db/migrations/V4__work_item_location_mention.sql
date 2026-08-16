-- Let a work item record WHERE it is before that place has been resolved to a row.
--
-- WHY: V1 required ward_id when granularity='ward' (likewise circle), which
-- assumed entity resolution happens before insert. In the real pipeline it does
-- not: the extraction agent reads "mini slaughterhouses in Serilingampally and
-- Kukatpally" and knows the granularity is circle-level, but the Entity
-- Resolution Agent (handover doc §7) maps that text to circle rows later — and
-- circles are not even seeded yet.
--
-- Without this, extraction had two bad options: fail the insert, or downgrade
-- the fact to 'city' and silently lose the location the document actually gave.
-- Both are worse than recording "we know it is circle-level, here is the text,
-- not yet linked".
--
-- The original intent of the constraints is preserved: you still cannot claim
-- ward/circle precision out of thin air — you must have EITHER a resolved FK OR
-- the source's own wording to justify it.

ALTER TABLE work_item ADD COLUMN location_mention TEXT;

COMMENT ON COLUMN work_item.location_mention IS
    'Place as named in the source ("Serilingampally, Kukatpally"), pending entity resolution to ward_id/circle_id.';

ALTER TABLE work_item DROP CONSTRAINT ward_granularity_has_ward;
ALTER TABLE work_item DROP CONSTRAINT circle_granularity_has_circle;

ALTER TABLE work_item ADD CONSTRAINT ward_granularity_located
    CHECK (granularity <> 'ward' OR ward_id IS NOT NULL OR location_mention IS NOT NULL);
ALTER TABLE work_item ADD CONSTRAINT circle_granularity_located
    CHECK (granularity <> 'circle' OR circle_id IS NOT NULL OR location_mention IS NOT NULL);

-- Work queue for the future Entity Resolution Agent: everything that names a
-- place but has not been linked to one.
CREATE INDEX work_item_unresolved_location ON work_item (granularity)
    WHERE location_mention IS NOT NULL AND ward_id IS NULL AND circle_id IS NULL;
