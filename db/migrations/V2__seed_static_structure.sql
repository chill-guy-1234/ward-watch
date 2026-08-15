-- Static civic structure known as of 2026-08-15 (see docs/VERIFICATION-2026-08-15.md).
-- Wards and circles are NOT seeded here: the 60-circle list needs sourcing, and a
-- further 300→400 ward delimitation is proposed — wards arrive in a later migration
-- once we have an official list to cite.

-- Three civic bodies, all currently under interim administration (no elected council)
INSERT INTO civic_body (name, formed_date, status) VALUES
    ('GHMC', '2007-04-16', 'interim'),   -- reconstituted (trifurcated) 2026-02-11
    ('CMC',  '2026-02-11', 'interim'),
    ('MMC',  '2026-02-11', 'interim');

-- 12 zones and their corporation assignment (post-trifurcation reporting)
INSERT INTO zone (civic_body_id, name)
SELECT cb.id, z.zone_name
FROM (VALUES
    ('GHMC', 'Shamshabad'),
    ('GHMC', 'Rajendranagar'),
    ('GHMC', 'Charminar'),
    ('GHMC', 'Golconda'),
    ('GHMC', 'Khairtabad'),
    ('GHMC', 'Secunderabad'),
    ('CMC',  'Serilingampally'),
    ('CMC',  'Kukatpally'),
    ('CMC',  'Qutbullapur'),
    ('MMC',  'Malkajgiri'),
    ('MMC',  'Uppal'),
    ('MMC',  'LB Nagar')
) AS z(body_name, zone_name)
JOIN civic_body cb ON cb.name = z.body_name;

-- Lok Sabha constituencies covering the tri-city area (stable across ward reorgs)
INSERT INTO mp_constituency (name) VALUES
    ('Hyderabad'),
    ('Secunderabad'),
    ('Malkajgiri'),
    ('Chevella'),
    ('Medak');

-- Representation status: vacancy is a first-class row, not a missing one.
-- Each body: mayor's chair vacant + an appointed special officer in charge.
INSERT INTO office (office_type, scope_type, scope_id, person_id, status)
SELECT 'mayor', 'civic_body', cb.id, NULL, 'vacant' FROM civic_body cb;

INSERT INTO office (office_type, scope_type, scope_id, person_id, status)
SELECT 'special_officer', 'civic_body', cb.id, NULL, 'special_officer' FROM civic_body cb;
