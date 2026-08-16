# Phase 4 — AWS Console Setup (Aurora, Lambda, Amplify)

Step-by-step console instructions for the remaining Phase 4 infrastructure.
CLI-driven setup for this stage kept hitting PowerShell string-escaping bugs
(the secret value below was one), so this stage is console-first — reliable,
and it's the same skills you'll need for any AWS project.

**Region: always `us-east-1` (N. Virginia)** — check the top-right selector on
every page. Bedrock, and now Aurora, are pinned there.

---

## Already done (via CLI, verified)

You don't need to redo these — just know they exist:

| Resource | Name | Purpose |
|---|---|---|
| Secrets Manager secret | `wardwatch/aurora-master` | Aurora master username + a generated 32-char password. **Never appears in any file** — Aurora and Lambda will read it directly. |
| RDS subnet group | `wardwatch-subnets` | 3 subnets (different AZs) in the default VPC, required for Aurora placement. |

You can eyeball the secret (metadata only, not the password) at:
Secrets Manager console → Secrets → `wardwatch/aurora-master`.

---

## Stage 1 — Create the Aurora Serverless v2 cluster

**RDS console → Databases → Create database**

| Field | Value | Why |
|---|---|---|
| Choose a database creation method | Standard create | Gives full control over serverless scaling |
| Engine type | Aurora (PostgreSQL Compatible) | pgvector needs Postgres |
| Engine version | Aurora PostgreSQL 16.x (latest 16) | Matches your local `pgvector/pgvector:pg16` |
| Templates | **Dev/Test** | Skips Multi-AZ by default — cheaper, fine for this project |
| DB cluster identifier | `wardwatch-cluster` | |
| Credentials management | **Self managed** | |
| Master username | `wardwatch_admin` | Must match the Secrets Manager secret |
| Master password | Toggle **"Manage master credentials in AWS Secrets Manager"** if offered, otherwise open the secret above and copy the password in manually | Either way, the *running* password ends up identical to what's in Secrets Manager |
| DB instance class | **Serverless v2** | The whole point — scales to near-zero when idle |
| Capacity range | Min **0.5** ACU, Max **2** ACU | 0.5 ACU is the practical floor; keeps this cheap while idle |
| Multi-AZ deployment | No | Not needed for a dev project |
| Virtual private cloud (VPC) | The default VPC | Same one the subnet group uses |
| DB subnet group | `wardwatch-subnets` | Created via CLI already |
| Public access | **Yes** | You need to reach it from your laptop (DBeaver, Flyway) without a VPN. Access is still gated by the security group below. |
| VPC security group | Create new → name it `wardwatch-db-sg` | |
| Additional configuration → Initial database name | `wardwatch` | Matches local setup |

Click **Create database**. Provisioning takes 5–10 minutes — you can move to Stage 2 while it spins up.

### Open the firewall to your IP only

Aurora is public but the security group blocks everything by default — good, but you need one hole for yourself:

1. EC2 console → Security Groups → `wardwatch-db-sg`
2. Inbound rules → Edit inbound rules → Add rule
3. Type: **PostgreSQL** (auto-fills port 5432) · Source: **My IP** (the console fills in your current IP)
4. Save

If your ISP gives you a new IP later and DBeaver/Flyway suddenly can't connect, this rule is the first thing to check — re-add your new IP the same way.

---

## Stage 2 — Point Flyway and DBeaver at Aurora

Once the cluster shows **Available** (RDS console → Databases → `wardwatch-cluster`):

1. Copy the **writer endpoint** — RDS console → `wardwatch-cluster` → Connectivity & security tab. Looks like `wardwatch-cluster.cluster-xxxxx.us-east-1.rds.amazonaws.com`.
2. Get the real password: Secrets Manager → `wardwatch/aurora-master` → **Retrieve secret value**.
3. Update `.env` (do **not** commit — it's already gitignored) with a second URL, e.g.:
   ```
   WARDWATCH_AURORA_URL=postgresql://wardwatch_admin:<password>@<endpoint>:5432/wardwatch
   ```
4. Enable pgvector on Aurora — connect with `psql` or DBeaver using the values above, then run:
   ```sql
   CREATE EXTENSION vector;
   ```
5. Run Flyway against Aurora instead of the local container:
   ```powershell
   docker run --rm -v ${PWD}/db/migrations:/flyway/sql:ro flyway/flyway:10 `
     -url="jdbc:postgresql://<endpoint>:5432/wardwatch" `
     -user="wardwatch_admin" -password="<password>" migrate
   ```
   All 7 migrations (V1–V7) should apply cleanly — same SQL, same order, proving the schema work was genuinely portable, not laptop-specific.
6. In DBeaver: New Connection → PostgreSQL → host = the endpoint, port 5432, database `wardwatch`, user `wardwatch_admin`, password from the secret.

**Sanity check** once connected: `SELECT count(*) FROM civic_body;` should return 3.

---

## Stage 3 — Lambda — DONE (healthcheck function)

Built and deployed via CLI: `wardwatch-healthcheck`, a container-image Lambda
proving the full connectivity chain (IAM role → Secrets Manager → Aurora →
Bedrock) works. Not the real ingestion pipeline yet — see `lambda/healthcheck/`
for the code and `Known issues hit` below for what tripped during setup.

**Verified invoke result:**
```json
{"db_reachable": true, "document_chunk_rows": 0, "bedrock_reachable": true, "embedding_dims": 1024}
```
(`document_chunk_rows: 0` is correct — Aurora's schema is migrated but not yet
ingested into; only local Postgres has data so far.)

**Resources created:**

| Resource | Name/ARN |
|---|---|
| ECR repository | `230802932766.dkr.ecr.us-east-1.amazonaws.com/wardwatch-healthcheck` |
| IAM role | `wardwatch-healthcheck-role` — attached: `AWSLambdaBasicExecutionRole` (CloudWatch Logs) + inline `wardwatch-secrets-and-bedrock` (read ONLY the `wardwatch/aurora-master` secret, invoke ONLY the Nova embeddings model — least privilege) |
| Lambda function | `wardwatch-healthcheck`, 512MB/30s timeout, x86_64 |

**Known issues hit while building this (useful if you build the next Lambda solo):**

1. `docker login --password-stdin` piped directly from `aws ecr get-login-password`
   failed with a 400 in PowerShell (password got mangled crossing the pipe).
   Fix: capture the token in a variable first (`$token = (aws ecr
   get-login-password ...).Trim()`), then pass it explicitly.
2. **Docker's default build produces a multi-arch OCI image index with a
   provenance attestation manifest** — Lambda rejects this, it needs one plain
   single-architecture image manifest. Fix: build with
   `docker build --provenance=false --platform linux/amd64 ...`. Verify with
   `aws ecr describe-images ... --query imageManifestMediaType` — you want
   `application/vnd.oci.image.manifest.v1+json`, not `image.index.v1+json`.
3. `AWS_REGION` is a **reserved** Lambda environment variable — Lambda sets it
   automatically from the deploy region. Trying to set it yourself in
   `--environment Variables={...}` fails with `InvalidParameterValueException`.
   Our code already defaults to `us-east-1` when the var is unset, so it's
   simply omitted from the custom vars.

**Reusable pattern for the next Lambda** (the real ingestion function): same
shape — Dockerfile copying in the relevant `pipeline/*.py` files, same IAM
role pattern (new inline policy scoped to whatever that function actually
touches), same build flags.

---

## Stage 3b — Lambda — DONE (chatbot function, UI-facing)

`wardwatch-chatbot` — wraps `pipeline/chat_logic.py` (the RAG loop extracted
out of `chat.py` so the CLI and the Lambda share one implementation instead of
three copies) behind a public Function URL with CORS. This is the first
UI-facing function from `CONCEPTS-AWS.md` Part 5 — a browser can call it
directly once a frontend exists.

**De-duplication done at the same time:** `db.py`/`embeddings.py` were
duplicated between `pipeline/` and `lambda/healthcheck/` (the note above
flagged this). Both Lambdas' Dockerfiles now build from the **repo root** as
build context (`docker build -f lambda/<name>/Dockerfile .`, not
`lambda/<name>/`) and `COPY pipeline/db.py pipeline/embeddings.py ...`
directly — one copy of each file, no drift risk. `lambda/healthcheck/db.py`
and `embeddings.py` were deleted; `wardwatch-healthcheck` was rebuilt and
redeployed from the new build context and re-verified working.

**Request/response contract:**
```
POST /  {"message": "...", "history": [...]}        (history optional)
     -> {"answer": "...", "sources": [...], "history": [...]}
```
A Lambda invocation has no memory of the previous one (unlike `chat.py`'s
in-memory list) — the caller round-trips `history`: send it, get the updated
list back, resend it next call. Verified working: a follow-up question
("what about the revised estimate for 2024-25?") correctly resolved via
condensation using the history sent back from the prior call.

**Resources created:**

| Resource | Name/ARN |
|---|---|
| ECR repository | `230802932766.dkr.ecr.us-east-1.amazonaws.com/wardwatch-chatbot` |
| IAM role | `wardwatch-chatbot-role` — `AWSLambdaBasicExecutionRole` + inline `wardwatch-secrets-and-bedrock` (read the aurora-master secret; invoke ONLY the three models this function actually calls: Nova embeddings, `nova-2-lite` condense model, `deepseek.r1` chat model) |
| Lambda function | `wardwatch-chatbot`, 512MB/60s timeout (longer than healthcheck's 30s — DeepSeek R1 reasoning is slower than a healthcheck ping) |
| Function URL | `https://xqknt4qdig7qifx7mcojdicamu0yiyoc.lambda-url.us-east-1.on.aws/`, `AuthType: NONE`, CORS `AllowOrigins: ["*"]` / `AllowMethods: ["POST"]` |

**Known issue hit — public Function URL access needs TWO permission
statements, not one:**
```powershell
aws lambda add-permission --function-name <name> \
  --statement-id FunctionURLAllowPublicAccess --action lambda:InvokeFunctionUrl \
  --principal "*" --function-url-auth-type NONE

aws lambda add-permission --function-name <name> \
  --statement-id FunctionURLAllowInvokeAction --action lambda:InvokeFunction \
  --principal "*" --invoked-via-function-url
```
Missing the second one (easy to miss — `create-function-url-config` with
`--auth-type NONE` looks like it should be enough) produces a `403 Forbidden`
on every request even though `get-function-url-config` correctly shows
`AuthType: NONE`. Both statements existed on `wardwatch-healthcheck` already;
this tripped only because the second one wasn't in the copy-paste command,
only discovered by diffing `aws lambda get-policy` against a working function.

**Aurora also got real data in this stage** — was empty (0 rows) since Stage
1-2; re-ran `ingest.py` for both source documents against Aurora (57 chunks
total, matching local), so the chatbot Lambda's answers are no longer
hypothetical.

---

## Stage 4 — Amplify Hosting (frontend)

Frontend built: `frontend/` is a Next.js app (App Router, static export —
`next.config.ts` sets `output: 'export'`), three routes (chat / ward lookup
/ about), calling the deployed Function URLs directly client-side. No SSR,
no API routes — the backend already exists as public HTTP endpoints
(`wardwatch-chatbot`, `wardwatch-wardlookup`), so Amplify only needs to
serve static files. `amplify.yml` at the repo root already has the correct
monorepo build config (`appRoot: frontend`, `baseDirectory: out`).

This step needs the console because connecting a GitHub repo to Amplify is
an OAuth flow — same reason Stage 1's Aurora setup was console-first.

1. **Amplify console → New app → Host web app**
2. **Deploy your app → GitHub** → authorize the Amplify GitHub App if this
   is the first time → select the `ward-watch` repository, branch `main`
3. Amplify detects `amplify.yml` at the repo root automatically — you
   should see `appRoot: frontend` reflected in the build settings preview.
   If it doesn't pick it up, the console's "App settings → Build settings"
   page lets you paste the file's contents manually.
4. **Environment variables**: none required — `NEXT_PUBLIC_CHATBOT_URL` and
   `NEXT_PUBLIC_WARDLOOKUP_URL` default to the real deployed Function URLs
   inside `frontend/app/lib/api.ts` (they're public, unauthenticated
   endpoints, nothing secret about hardcoding them as defaults). Only add
   these env vars in Amplify if a Lambda gets rebuilt and its Function URL
   changes — env var wins over the hardcoded default without a redeploy of
   this file.
5. **Save and deploy.** First build takes a few minutes; Amplify gives you
   a `https://main.<app-id>.amplifyapp.com` URL when done, and auto-deploys
   on every push to `main` from here on.

**Sanity check once deployed:** open the Amplify URL, ask the chatbot a
question (expect 20-45s — DeepSeek R1 reasoning, not a bug), then search a
ward number on `/ward`. Check the browser console for CORS errors if either
fails silently — both Function URLs already have `AllowOrigins: ["*"]`
configured, so a CORS failure would point at a wrong/stale URL instead.

---

## Cost check while you work

Aurora Serverless v2 bills per ACU-hour even at the 0.5 ACU floor — roughly
$0.06/hour idle (~$1.50/day) plus storage. Small against your credits, but if
you're pausing for a while, note the cluster **cannot be fully stopped** the
way a normal RDS instance can — Aurora Serverless v2 clusters run continuously
at the minimum capacity. If cost becomes a concern, the cluster can be deleted
and recreated from the same Flyway migrations in a few minutes when you're
ready to resume.

---

## Known issue — a chained `docker push && ... && update-function-code` that gets backgrounded can silently deploy the OLD image

Hit during the 2026-08-16 rebrand deploy. A long-running chained command
(`docker build && docker push && aws lambda update-function-code && aws
lambda wait function-updated`) got moved to background after exceeding the
foreground timeout. It reported completing with exit code 0, and
`aws lambda get-function ... LastUpdateStatus` showed `Successful` —
both looked like confirmation. But `aws ecr describe-images --image-ids
imageTag=latest` showed the `:latest` tag still pointed at the **previous**
image digest, and the deployed Lambda's `CodeSha256` matched the old image,
not the new one. The chatbot kept introducing itself by the old name for
several invocations after the "successful" deploy.

**Root cause:** the `docker push` never actually finished tagging `:latest`
in ECR before the shell was backgrounded — the layer uploads completed (all
showed `Pushed` in the log) but the final manifest step didn't land. `&&`
normally guarantees `update-function-code` only runs after a *real* `docker
push` success, but that guarantee doesn't survive the process being moved
to a background job mid-command on Windows.

**Fix:** don't trust `LastUpdateStatus: Successful` alone after a
backgrounded deploy chain. Cross-check two things before believing a deploy
landed:
```powershell
# Does the :latest tag in ECR actually point at the digest you just built?
aws ecr describe-images --repository-name <repo> --image-ids imageTag=latest --query "imageDetails[0].imageDigest"

# Does the deployed Lambda's CodeSha256 match that same digest?
aws lambda get-function --function-name <fn> --query "Configuration.CodeSha256"
```
If they don't match, re-run `docker push` standalone (safe, idempotent) and
`update-function-code` again — don't just re-trust the same chained command.
