"""Ingest a civic document into the database: extract text -> chunk -> embed -> store.

Usage:
  python ingest.py data/raw/budget.pdf --title "GHMC Budget 2026-27" --doc-type budget_pdf \
      --publisher GHMC --url https://... --published-date 2026-03-01

  # or straight from the corpus bucket -- the canonical store as of 2026-08-16,
  # not the gitignored local data/raw/ folder (still fine for local dev/offline use):
  python ingest.py s3://wardwatch-documents/raw/budget.pdf --title "..." --doc-type budget_pdf ...

Steps (this IS the "E" and "embed" half of the RAG pipeline):
  1. Resolve the source (download from S3 to a temp file if given an s3://
     URI, otherwise treat as a local path) and extract raw text (pypdf for
     PDFs, plain read for .txt/.md).
  2. Chunk it — embeddings and retrieval work best on passages of a few
     paragraphs, not whole documents. We chunk per page (so citations can say
     "page 12") with a character budget and overlap between chunks so a
     sentence split across a boundary still appears whole in one chunk.
  3. Embed each chunk via Bedrock Titan.
  4. Insert one source_document row + one document_chunk row per chunk.
"""

import argparse
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from pypdf import PdfReader

import db
from embeddings import embed

CHUNK_CHARS = 3000   # ~600-700 words per chunk
OVERLAP_CHARS = 400  # tail of one chunk repeats at the head of the next


def resolve_source(path_arg: str) -> Path:
    """Local path as-is; an s3:// URI is downloaded to a temp file first.

    The temp file keeps the original suffix so extract_pages()'s .pdf check
    still works on an S3-sourced document.
    """
    if not path_arg.startswith("s3://"):
        return Path(path_arg)

    import boto3

    parsed = urlparse(path_arg)
    bucket, key = parsed.netloc, parsed.path.lstrip("/")
    tmp = tempfile.NamedTemporaryFile(suffix=Path(key).suffix, delete=False)
    boto3.client("s3").download_fileobj(bucket, key, tmp)
    tmp.close()
    return Path(tmp.name)


def extract_pages(path: Path) -> list[tuple[int | None, str]]:
    """Return a list of (page_number, text). page_number is None for non-PDFs."""
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(str(path))
        return [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
    return [(None, path.read_text(encoding="utf-8", errors="replace"))]


def chunk_text(text: str) -> list[str]:
    """Split on paragraph boundaries into ~CHUNK_CHARS pieces with overlap."""
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if current and len(current) + len(para) > CHUNK_CHARS:
            chunks.append(current)
            current = current[-OVERLAP_CHARS:]  # carry the tail forward as overlap
        current = f"{current}\n\n{para}" if current else para
    if current.strip():
        chunks.append(current)
    return chunks


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="local file path or an s3://bucket/key URI")
    ap.add_argument("--title", required=True)
    ap.add_argument("--doc-type", required=True,
                    choices=["budget_pdf", "news", "GO", "RTI", "scraped_page"])
    ap.add_argument("--publisher")
    ap.add_argument("--url")
    ap.add_argument("--published-date")
    args = ap.parse_args()

    pages = extract_pages(resolve_source(args.path))
    total_text = sum(len(t) for _, t in pages)
    if total_text < 100:
        sys.exit(f"Extracted only {total_text} chars — is this a scanned/image PDF?")

    with db.connect() as conn:
        doc_id = conn.execute(
            """INSERT INTO source_document (title, url, publisher, doc_type, published_date, extraction_status)
               VALUES (%s, %s, %s, %s, %s, 'extracted') RETURNING id""",
            (args.title, args.url, args.publisher, args.doc_type, args.published_date),
        ).fetchone()[0]

        n_chunks = 0
        for page_number, page_text in pages:
            for piece in chunk_text(page_text):
                conn.execute(
                    """INSERT INTO document_chunk (source_document_id, chunk_text, embedding, metadata)
                       VALUES (%s, %s, %s, jsonb_build_object('page_number', %s::int))""",
                    (doc_id, piece, embed(piece), page_number),
                )
                n_chunks += 1

    print(f"Ingested source_document id={doc_id}: {len(pages)} page(s), {n_chunks} chunk(s) embedded.")


if __name__ == "__main__":
    main()
