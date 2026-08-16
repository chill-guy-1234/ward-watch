# psycopg[binary], pgvector and pypdf ship compiled code, which the Lambda
# console's inline editor and plain zip uploads can't handle cleanly --
# a container image is the reliable path for this dependency set.
#
# Build context is the REPO ROOT (see docs/PHASE4-AWS-CONSOLE-SETUP.md build
# command), not this directory -- that's what lets this Dockerfile COPY
# pipeline/db.py and pipeline/embeddings.py directly instead of keeping a
# second hand-copied version in sync here. Not pip-installed: pipeline/ isn't
# a packaged module, just the same two files the local scripts import.
FROM public.ecr.aws/lambda/python:3.12

COPY lambda/healthcheck/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY pipeline/db.py pipeline/embeddings.py lambda/healthcheck/handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
