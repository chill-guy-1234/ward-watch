"""Shared database connection for the pipeline scripts.

Two credential paths, chosen automatically:

  Local dev  -> WARDWATCH_DB_URL from .env (docker compose Postgres).
  Lambda     -> WARDWATCH_DB_SECRET_ID + WARDWATCH_DB_HOST set as function
                environment variables; the password is fetched from Secrets
                Manager at cold-start via the function's IAM role. No password
                ever appears in Lambda's own configuration, in any file, or in
                CloudWatch logs — only the secret's ARN does.

This is the payoff of the split promised back in Phase 2: a container's
password lived in .env because .env was the right tool for a laptop; Aurora's
production password lives in Secrets Manager because Secrets Manager is the
right tool for a credential a running service must fetch, not one a developer
types in.
"""

import json
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector

# Load repo-root .env once, on import. override=False means a real environment
# variable (e.g. set by Lambda or CI) always wins over the file. In Lambda
# there is no .env on disk, so this is a harmless no-op there.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)


def _db_url() -> str:
    secret_id = os.environ.get("WARDWATCH_DB_SECRET_ID")
    if secret_id:
        # Running in Lambda (or anywhere with this env var set). Import boto3
        # lazily so local dev, which never hits this branch, doesn't need it
        # available at db.py's module load time.
        import boto3

        host = os.environ["WARDWATCH_DB_HOST"]  # required alongside the secret
        dbname = os.environ.get("WARDWATCH_DB_NAME", "wardwatch")
        region = os.environ.get("AWS_REGION", "us-east-1")

        client = boto3.client("secretsmanager", region_name=region)
        creds = json.loads(client.get_secret_value(SecretId=secret_id)["SecretString"])
        return f"postgresql://{creds['username']}:{creds['password']}@{host}:5432/{dbname}"

    return os.environ.get(
        "WARDWATCH_DB_URL",
        "postgresql://wardwatch:wardwatch_dev@localhost:5432/wardwatch",
    )


def connect() -> psycopg.Connection:
    conn = psycopg.connect(_db_url())
    register_vector(conn)  # lets us pass/read pgvector columns as Python lists
    return conn
