# psycopg[binary], pgvector and pypdf ship compiled code, which the Lambda
# console's inline editor and plain zip uploads can't handle cleanly --
# a container image is the reliable path for this dependency set.
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# db.py and embeddings.py are copied in from pipeline/ (not pip-installed --
# pipeline/ isn't a packaged module) so this handler reuses the exact same
# connection and embedding code the local scripts use.
COPY handler.py db.py embeddings.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
