# Security posture (2026-08-16)

What's actually protecting this app, what isn't yet, and why. Written the
same way `CONCEPTS-AWS.md` is — a reference to come back to, not a one-time
checklist.

---

## The actual threat model

Three Lambda Function URLs are public with `AuthType: NONE` — anyone who
has the URL can call them, no login, no API key. That's intentional (it's
a public civic app, not a private tool), but it means the only things
standing between "public API" and "abuse vector" are what's described
below.

**The asymmetry that matters:** `wardwatch-wardlookup` runs one cheap
Postgres query per call — abusing it costs fractions of a cent.
`wardwatch-chatbot` calls Bedrock three times per request (condense model,
embeddings, chat model) — each call has a real per-token dollar cost. A
script hammering the chatbot endpoint is a materially different risk than
one hammering ward lookup. Everything below is written with that asymmetry
in mind — chatbot gets the tighter limits.

---

## What's in place

**CORS restricted to known origins.** All three Function URLs used to
allow `AllowOrigins: ["*"]` — any website could embed a `fetch()` to them.
Now restricted to `https://main.d1g0llf0kxmkfl.amplifyapp.com` and
`http://localhost:3000` (dev). Verified: a preflight from an untrusted
origin gets no `Access-Control-Allow-Origin` header back, so a browser
won't expose the response to the calling page.

**Caveat this doesn't cover:** CORS is a *browser* enforcement mechanism.
`curl`, a server, or any non-browser client ignores it entirely — someone
can still call these endpoints directly. CORS stops "a malicious webpage
gets your visitors' browsers to call our API for free," not "someone
directly attacks the API." That's what the items below are for.

**Input-size limits on both data-touching Lambdas.**
- `wardwatch-chatbot`: rejects messages over 2000 characters, and rejects
  malformed or oversized (`>24` entries) `history` arrays, before any
  Bedrock call happens. A single long message previously had no cap and
  would have been billed at whatever token count it contained.
- `wardwatch-wardlookup`: rejects `q` over 100 characters (mainly so an
  absurdly long numeric string doesn't crash the `::int` cast with an
  unhandled exception).

**Account-level concurrency ceiling (found, not configured).** This AWS
account's Lambda concurrency quota is 10 total, account-wide — a new/
low-usage-account default, not the usual 1000. That means **at most 10
requests across all three Lambdas combined can run at once, full stop**,
enforced by AWS itself. Attempting to set explicit reserved concurrency
per function failed (`PutFunctionConcurrency` requires 10 unreserved
executions remain, and the account only has 10 total) — which is really
just AWS telling us the ceiling is already lower than what we were about
to configure. No action needed; documented here so it isn't "rediscovered"
as a mystery later. If the account's quota is ever raised (e.g. after
sustained legitimate usage), revisit setting real per-function reserved
concurrency then — `wardwatch-chatbot` should get the tightest cap.

**Least-privilege IAM**, from Phase 4 (unchanged, still worth restating
here): each Lambda's inline policy only grants what it actually calls —
`wardwatch-chatbot` can invoke exactly three Bedrock models and read
exactly one Secrets Manager secret; `wardwatch-wardlookup` can only read
the secret, no Bedrock access at all.

**Cost monitoring already existed and works.** An AWS Budget
("My Monthly Cost Budget", $2/month) with real email notifications
(`mullapudisamartha@gmail.com`) at 85% actual, 100% actual, and 100%
forecasted was already configured before this pass — verified it has real
subscribers, not just thresholds with nothing wired to them. No new
CloudWatch billing alarm was needed.

---

## What's NOT in place (known, not forgotten)

**Aurora's security group allows `0.0.0.0/0:5432`.** A deliberate Phase 4
tradeoff (`docs/CONCEPTS-AWS.md` Part 1, "Option A") — Lambda's outbound IP
is dynamic, so restricting the SG to specific IPs would also lock out the
Lambdas without a NAT Gateway (~$32/month, ruled out for a personal
project). The database is reachable from anywhere on the internet; the
generated 32-character password is the only gate. Audited this pass:
confirmed the SG has *only* port 5432 open, nothing broader.

**No real rate limiting.** CORS blocks browser-based abuse from other
sites; the account's 10-concurrency ceiling blocks runaway parallel
scaling; the Budget alert catches sustained cost drift after the fact. None
of these is a proper per-IP rate limit on `wardwatch-chatbot` specifically.
A determined single actor calling it directly and slowly (staying under
the 10-concurrency ceiling) would not be stopped by anything here — only
noticed, via the Budget email, after money's already been spent.

**Real per-IP throttling needs API Gateway** (or CloudFront+WAF) in front
of the Function URLs — Lambda Function URLs have no built-in throttling of
their own. This is deliberately deferred as a separate, larger follow-up:
it changes how the frontend calls the backend (through an API Gateway
endpoint instead of the Function URL directly) and is worth its own pass
rather than folding into this one.

**No WAF, no geo-blocking, no bot detection.** Not pursued — cost
(WAF has a base monthly charge plus per-rule, per-request pricing) isn't
obviously justified yet for a low-traffic personal project, but worth
revisiting if `wardwatch-chatbot` ever shows real abuse traffic in
CloudWatch logs.

---

## How to re-verify any of this

```powershell
# CORS: untrusted origin gets no Access-Control-Allow-Origin header
curl -i -X OPTIONS <function-url> -H "Origin: https://evil.example.com" -H "Access-Control-Request-Method: POST"

# Input limits: oversized message rejected with 400, not a Bedrock call
curl -X POST <chatbot-url> -H "content-type: application/json" -d "{\"message\": \"$(python -c 'print(\"x\"*3000)')\"}"

# Account concurrency ceiling
aws lambda get-account-settings --region us-east-1 --query "AccountLimit"

# Aurora SG: should show only port 5432
aws ec2 describe-security-groups --group-ids sg-0fb1b604c7c7d7499 --region us-east-1 --query "SecurityGroups[0].IpPermissions"

# Budget alert subscribers are real
aws budgets describe-subscribers-for-notification --account-id <account-id> --budget-name "My Monthly Cost Budget" --notification '{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":85.0}'
```
