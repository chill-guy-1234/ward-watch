"""Health-check Lambda: proves the Phase 4 connectivity chain end to end --
this function's IAM role -> Secrets Manager -> Aurora (public endpoint,
Option A networking) -> Bedrock.

Deliberately NOT the ingestion pipeline yet. This is the "first Lambda fully
working standalone" checkpoint from the handover doc's setup order, scoped
down to proving the wiring before the real pipeline (ingest.py / extract.py)
gets its own Lambda(s).
"""

import json

from db import connect
from embeddings import embed


def handler(event, context):
    with connect() as conn:
        row_count = conn.execute("SELECT count(*) FROM document_chunk").fetchone()[0]

    vector = embed("healthcheck")

    return {
        "statusCode": 200,
        "body": json.dumps({
            "db_reachable": True,
            "document_chunk_rows": row_count,
            "bedrock_reachable": True,
            "embedding_dims": len(vector),
        }),
    }
