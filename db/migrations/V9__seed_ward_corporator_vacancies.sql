-- V2 seeded civic_body-level vacancy (mayor + special officer per body) but
-- not ward-level corporator vacancy -- there were no wards to attach it to
-- yet. Now that V8 seeded all 300 current wards, close that gap: every
-- current ward gets an explicit 'vacant' corporator row, consistent with the
-- schema's own principle (handover doc §6 / V1 comment) that "no corporator"
-- is a row, not a missing row. Without this, a ward-lookup query would have
-- to infer vacancy from the ABSENCE of an office row, which is exactly the
-- silent-gap pattern the schema was designed to avoid.

INSERT INTO office (office_type, scope_type, scope_id, person_id, status)
SELECT 'corporator', 'ward', w.id, NULL, 'vacant'
FROM ward w
WHERE w.valid_to IS NULL;
