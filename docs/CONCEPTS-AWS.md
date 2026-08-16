# AWS Concepts — Networking, Database, and Compute

Reference notes from building Phase 4. Written for someone learning this stack
for the first time — read once, then use as a lookup when a term resurfaces.

---

## Part 1 — Networking: VPC, subnets, security groups

Four nested layers, each narrower than the last, answering "who's even allowed
to try reaching this resource."

### VPC — your own private network

A **VPC (Virtual Private Cloud)** is an isolated slice of AWS's network — a
private address range (like `10.0.0.0/16`) that nothing outside it can see by
default. Every AWS account gets a **default VPC** automatically; Aurora and
our Lambda both live in it. Mental model: *"I own a private building. Nothing
inside is visible from the street unless I explicitly cut a door."*

### Subnet — a room in that building, tied to one physical location

A VPC is carved into **subnets**, and each subnet lives in exactly one
**Availability Zone** (AWS's term for a physically separate datacenter within
a region — `us-east-1a` through `us-east-1f` are six different buildings).
A subnet is just a smaller IP range within the VPC's range.

Aurora needed a **subnet group** spanning multiple AZs (`wardwatch-subnets`,
3 subnets) so that if one datacenter has an outage, the database can keep
running elsewhere. This is *availability* engineering — a separate concern
from security.

### Security group — the bouncer at one specific door

A **security group (SG)** is a firewall attached to one resource (Aurora, in
our case): a list of **inbound rules** ("who's allowed to connect *to* me")
and outbound rules. Default is deny-everything; you only ever add allow rules.

Each inbound rule is three things: **protocol/port** (TCP 5432 for Postgres),
**source** (an IP range, or another security group), and implicitly "allow."
Aurora's SG (`sg-0fb1b604c7c7d7499`) currently has one inbound rule: TCP 5432
from `0.0.0.0/0` — anyone on the internet may *attempt* a connection. That is
not the same as "anyone can get in" — the real username/password check still
gates entry after that.

### Why a database specifically cares about all of this

A database is the most attractive target on any system — it's where the data
lives. AWS makes network reachability a **separate, explicit gate** from the
database's own login check, on purpose (defense in depth): even a leaked
password is less catastrophic if the database also isn't reachable from
anywhere.

**The tradeoff we knowingly made (Option A):** we opened Aurora's SG to
`0.0.0.0/0` so Lambda (whose outbound IP is dynamic/unpredictable) could reach
it, relying on the strong generated password instead of network isolation.
Reasonable for a personal learning project on a credit budget; not what you'd
accept for a system holding real users' sensitive data. The "correct"
production alternative is putting Lambda inside the VPC alongside Aurora
(private networking, no public exposure needed) — costs more (a VPC endpoint
or NAT Gateway, ~$7–32/month running continuously), which is why we didn't
choose it here.

**The full chain a connection attempt goes through:**

```
Client (laptop / Lambda)
   → VPC:            is this traffic even routed to where Aurora lives?
   → Subnet:          which physical AZ is Aurora actually sitting in?
   → Security group:  inbound rule check — is this source/port allowed at all?
   → Postgres itself: username + password + database name check
```

---

## Part 2 — Aurora Serverless v2

Aurora is AWS's Postgres/MySQL-compatible managed database. "Serverless v2"
means capacity scales continuously between a min/max ACU range (we set
0.5–2 ACU) instead of running a fixed-size server — cheaper when idle, the
whole reason it fits this project's "scale to near-zero" plan.

**One cluster can host several separate databases** — like a filing cabinet
with multiple drawers. Ours currently has `postgres` (Aurora's own default,
auto-created, empty) and `wardwatch` (created manually, holds our schema).
Connecting to the wrong drawer looks like "my tables are missing" — they're
just in a different database on the same cluster. This tripped us once:
DBeaver defaulted to `postgres` and showed nothing until the connection's
database field was changed to `wardwatch`.

**Extensions are per-database, not per-cluster.** `CREATE EXTENSION vector;`
had to run while connected to `wardwatch` specifically — running it against
`postgres` would not have made pgvector available in `wardwatch`.

---

## Part 3 — ECR vs ECS (the one-letter trap)

These are unrelated services that happen to share three letters:

- **ECR = Elastic Container *Registry*.** Storage for container images —
  think a private Docker Hub. It doesn't run anything; it just holds the
  built image so something else can pull and execute it later. This is where
  `wardwatch-healthcheck`'s image actually lives.
- **ECS = Elastic Container *Service*.** A container **orchestrator** for
  running always-on containers at scale ("keep 5 copies of this running,
  restart on crash, load-balance traffic"). We never touched ECS — it's
  irrelevant to what we built.

Find our image at **ECR console → Repositories → `wardwatch-healthcheck`**,
not anywhere in ECS.

---

## Part 4 — How Lambda actually relates to ECR, and how the UI reaches it

**ECR is pulled from once** — when the Lambda function is created/updated,
and occasionally again on a cold start. It is *not* called on every request.
Mental model: ECR is like a source-code repo you deploy from, not a service
invoked per-request.

The UI does **not** call ECR, and does not call "the Lambda" the way you'd
call a URL directly — Lambda has no public endpoint by default. Something has
to sit between the browser and the function:

- a **Lambda Function URL** (simplest — Lambda gets its own HTTPS endpoint), or
- **API Gateway** in front of Lambda (more setup, standard when you have
  multiple routes)

Full runtime path once that piece exists:

```
Browser (Next.js on Amplify)
   → HTTPS request
      → Function URL / API Gateway   <- the actual "backend API" the UI calls
         → invokes Lambda (code already pulled from ECR earlier, not re-pulled per request)
            → queries Aurora / calls Bedrock
         <- JSON response
      <-
   <- renders in the UI
```

Neither of these pieces exists yet — `wardwatch-healthcheck` currently has no
public entry point; it's only invoked manually via `aws lambda invoke`.

---

## Part 5 — The backend is many small Lambdas, not one big one

Per the handover doc's §7 agent architecture, "the backend" is **several
single-purpose Lambda functions**, triggered differently depending on the job:

| Function | Triggered by | UI-facing? |
|---|---|---|
| Scraper Agent | EventBridge (cron, e.g. daily) | No |
| Extraction Agent | Chained after scraper via Step Functions | No |
| Embedding Agent | Chained after extraction | No |
| Election Watch Agent | EventBridge (its own schedule) | No |
| Ward lookup / chatbot | UI request via Function URL / API Gateway | **Yes** |

`wardwatch-healthcheck` is none of these — it's a scaffold proving the wiring
(IAM role → Secrets Manager → Aurora → Bedrock) before building the real
functions. The real backend will be several small functions built the same
proven way, each with its own tightly-scoped IAM role — the scraper needs
internet + write access, the chatbot needs Bedrock + read access, and giving
one function everything would defeat the point of least-privilege IAM we
already practiced on the healthcheck function's role.

**Why split it this way, concretely:** the scheduled agents have nothing to
do with a user's browser session — they should run whether or not anyone is
using the site at all. Bundling everything into one Lambda would either force
every scheduled run through request/response semantics it doesn't need, or
force the UI-facing function to carry permissions (write access, external
scraping) it has no business holding.
