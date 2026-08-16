# Same pattern as lambda/healthcheck and lambda/chatbot: build context is the
# REPO ROOT so this can COPY pipeline/db.py directly (no Bedrock needed here,
# so embeddings.py is not copied -- this Lambda is a plain structured lookup).
FROM public.ecr.aws/lambda/python:3.12

COPY lambda/wardlookup/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY pipeline/db.py lambda/wardlookup/handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
