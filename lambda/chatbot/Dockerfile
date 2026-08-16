# Same reasoning as lambda/healthcheck/Dockerfile: compiled deps need a
# container image, and the build context is the REPO ROOT so this can COPY
# pipeline/*.py directly instead of hand-duplicating them here.
FROM public.ecr.aws/lambda/python:3.12

COPY lambda/chatbot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY pipeline/db.py pipeline/embeddings.py pipeline/chat_logic.py lambda/chatbot/handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
