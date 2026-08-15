"""Shared database connection for the pipeline scripts.

Configuration comes from the repo-root .env file (gitignored) so no credential
is hardcoded here. Copy .env.example to .env to get started.

Note on secrets, since this is where the DB password would otherwise live:
AWS Secrets Manager is the right home for the *Aurora* password in Phase 4 —
Lambdas fetch it at runtime via their IAM role, so it exists in no file and no
environment variable. It is NOT the right home for local dev credentials (a
container on your laptop) or for the Bedrock API key itself, which is the
bootstrap credential — reading Secrets Manager requires AWS credentials, so
that key must live outside the vault.
"""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector

# Load repo-root .env once, on import. override=False means a real environment
# variable (e.g. set by Lambda or CI) always wins over the file.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

DB_URL = os.environ.get(
    "WARDWATCH_DB_URL",
    "postgresql://wardwatch:wardwatch_dev@localhost:5432/wardwatch",
)


def connect() -> psycopg.Connection:
    conn = psycopg.connect(DB_URL)
    register_vector(conn)  # lets us pass/read pgvector columns as Python lists
    return conn
