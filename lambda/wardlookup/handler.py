"""Ward lookup Lambda: search or list the current 300-ward structure.

Same connectivity pattern as the other two Lambdas (IAM role -> Secrets
Manager -> Aurora), fronted by a public GET Function URL. No Bedrock call
here -- this is a plain structured lookup, not RAG.

Query param `q`:
  - omitted/empty -> lists all 300 current wards, grouped by civic body then
    ward number (the frontend's "browse all wards" view groups client-side
    off this ordering)
  - all-digit string -> exact ward_number match
  - anything else -> case-insensitive substring match on ward name

Every result includes corporator_status and civic_body_status straight from
the `office` table (V9/V2 seed) -- "vacant" is a real row, not an inferred
absence, so this endpoint never has to guess.
"""

import json

import db

FIELDS_SQL = """
    SELECT w.ward_number, w.name AS ward_name, z.name AS zone, c.name AS circle,
           cb.name AS civic_body, corp.status AS corporator_status,
           spec.status AS civic_body_status
    FROM ward w
    JOIN civic_body cb ON cb.id = w.civic_body_id
    LEFT JOIN circle c ON c.id = w.circle_id
    LEFT JOIN zone z ON z.id = c.zone_id
    LEFT JOIN office corp ON corp.scope_type = 'ward' AND corp.scope_id = w.id
                          AND corp.office_type = 'corporator'
    LEFT JOIN office spec ON spec.scope_type = 'civic_body' AND spec.scope_id = cb.id
                          AND spec.office_type = 'special_officer'
    WHERE w.valid_to IS NULL
"""

LIST_SQL = FIELDS_SQL + " ORDER BY cb.name, w.ward_number"

SEARCH_SQL = (
    FIELDS_SQL
    + """
      AND ((%(num)s::int IS NOT NULL AND w.ward_number = %(num)s::int)
        OR (%(text)s::text IS NOT NULL AND w.name ILIKE %(text)s::text))
    ORDER BY w.ward_number
    LIMIT 20
"""
)


def handler(event, context):
    params = event.get("queryStringParameters") or {}
    q = (params.get("q") or "").strip()

    with db.connect() as conn:
        if not q:
            rows = conn.execute(LIST_SQL).fetchall()
        else:
            num = int(q) if q.isdigit() else None
            text = None if q.isdigit() else f"%{q}%"
            rows = conn.execute(SEARCH_SQL, {"num": num, "text": text}).fetchall()

    results = [
        {
            "ward_number": r[0],
            "ward_name": r[1],
            "zone": r[2],
            "circle": r[3],
            "civic_body": r[4],
            "corporator_status": r[5],
            "civic_body_status": r[6],
        }
        for r in rows
    ]

    return _response(200, {"query": q, "results": results})


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body),
    }
