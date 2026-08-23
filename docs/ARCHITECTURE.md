# JDFit — Architecture & Design

A technical overview of how JDFit is built, the decisions behind the architecture, and how the pieces fit together.

---

## What JDFit Does

JDFit is a full-stack web application that helps job seekers evaluate how well their résumé matches a specific job description. Upload a résumé PDF, paste a JD, and get back a structured match report: an overall score, matched skills, missing skills, weakly-covered skills, and a section-by-section breakdown.

Over time, JDFit aggregates patterns across all your analyses to surface which skills keep appearing in JDs you're applying to but are missing from your résumé — a personal skill-gap dashboard for your job search.

---

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query

**Backend:** Node.js, AWS Lambda, API Gateway

**Infrastructure:** S3, DynamoDB, SQS, SNS, Cognito, Textract, CloudFront

**IaC:** AWS CDK (TypeScript)

**Local dev:** LocalStack, DynamoDB Local, pdf-parse

---

## System Architecture

### Production (AWS)

```
                             ┌─────────────────────────────┐
                             │   User's Browser (React)    │
                             │   Hosted at CloudFront URL  │
                             └──────────────┬──────────────┘
                                            │
                       ┌────────────────────┼────────────────────┐
                       │                    │                    │
                       │ (auth)             │ (API)              │ (upload)
                       ▼                    ▼                    ▼
              ┌────────────────┐  ┌──────────────────┐  ┌──────────────────┐
              │  AWS Cognito   │  │   API Gateway    │  │  S3 (presigned)  │
              │  (Hosted UI)   │  │  + JWT Authorizer│  │  resume-uploads/ │
              └────────────────┘  └────────┬─────────┘  └────────┬─────────┘
                                           │                     │
                                           │                     │ (S3 event)
                                ┌──────────┴──────────┐          ▼
                                │                     │  ┌───────────────────┐
                                ▼                     ▼  │ Lambda:           │
                   ┌────────────────────┐  ┌──────────────│ startExtraction   │
                   │ Lambda:            │  │ Lambda:      └────────┬──────────┘
                   │ presignedUrl       │  │ analyzeMatch          │
                   └────────────────────┘  └──────┬───────┘        │ (start Textract async)
                                                  │                ▼
                                                  │       ┌───────────────────┐
                                                  ▼       │  AWS Textract     │
                                          ┌────────────┐  │  (async job)      │
                                          │ DynamoDB   │  └────────┬──────────┘
                                          │ - Resumes  │           │ (SNS on complete)
                                          │ - Analyses │           ▼
                                          └────────────┘  ┌───────────────────┐
                                                          │ SNS: textract-done│
                                                          └────────┬──────────┘
                                                                   │ (subscription)
                                                                   ▼
                                                          ┌───────────────────┐
                                                          │ SQS: process-queue│
                                                          │ (maxReceiveCount:3│
                                                          │  → redrive to DLQ)│
                                                          └────────┬──────────┘
                                                                   │ (Lambda event source)
                                                                   ▼
                                                          ┌───────────────────┐
                                                          │ Lambda:           │
                                                          │ processResults    │
                                                          └────────┬──────────┘
                                                              │              │
                                                    (success) │    (3 fails) │
                                                              ▼              ▼
                                                  ┌────────────────┐ ┌──────────────┐
                                                  │DynamoDB Resumes│ │ SQS DLQ:     │
                                                  │(status: READY) │ │ process-dlq  │
                                                  └────────────────┘ └──────────────┘
```

The React SPA is hosted on S3 behind CloudFront. All API calls go through API Gateway, protected by a Cognito JWT authorizer. File uploads go directly from the browser to S3 via presigned URLs — never through Lambda — to avoid payload limits and unnecessary costs.

Textract runs asynchronously. When extraction completes, it publishes to an SNS topic, which fans out to an SQS queue. The `processResults` Lambda is triggered by the SQS queue as an event source. If processing fails three times on the same message, the SQS redrive policy (`maxReceiveCount: 3`) routes it to a Dead-Letter Queue for inspection without blocking the pipeline.

All infrastructure is defined in AWS CDK (TypeScript) and deployed via `cdk deploy`.

### Local Development

```
       ┌─────────────────────────────┐
       │  Browser (Vite dev server)  │
       │  http://localhost:5173      │
       └──────────────┬──────────────┘
                      │
                      │ HTTP
                      ▼
       ┌─────────────────────────────┐
       │  Node/Express server        │
       │  http://localhost:3001      │
       │  Routes wrap Lambda handlers│
       └──────────────┬──────────────┘
                      │
        ┌─────────────┼──────────────┐
        │             │              │
        ▼             ▼              ▼
   ┌──────────┐ ┌──────────┐ ┌─────────────────────┐
   │LocalStack│ │pdf-parse │ │  LocalStack (single  │
   │S3 :4566  │ │(text     │ │  container :4566)    │
   │presigned │ │extraction│ │  DynamoDB, SQS, SNS, │
   │URL works │ │from PDF) │ │  S3, Cognito         │
   └──────────┘ └──────────┘ └─────────────────────┘
```

Locally, Lambda handlers are wrapped in Express routes behind a thin adapter. LocalStack emulates S3, DynamoDB, SQS, SNS, and Cognito on a single port. `pdf-parse` handles text extraction from PDFs (Textract is only used in production). Every backend module has a swappable local/prod implementation behind a common interface (`ResumeStorage`, `ResumeParser`, `AuthContext`), controlled by an `APP_ENV` variable.

---

## Data Model

### DynamoDB Tables

**Resumes** — partition key: `userId`, sort key: `resumeId` (ULID)

| Attribute | Type | Description |
|---|---|---|
| `userId` | string | Cognito `sub` |
| `resumeId` | string | ULID (sortable by creation time) |
| `label` | string | User-supplied name |
| `s3Key` | string | S3 object key |
| `status` | string | `PROCESSING` · `READY` · `FAILED` |
| `parsedSections` | map | Extracted sections: education, experience, skills, projects |
| `skillTokens` | list | Normalized skill tokens |
| `errorMessage` | string | Populated on failure |
| `createdAt` / `updatedAt` | number | Unix ms |

**Analyses** — partition key: `userId`, sort key: `analysisId` (ULID)

| Attribute | Type | Description |
|---|---|---|
| `userId` | string | Cognito `sub` |
| `analysisId` | string | ULID |
| `label` | string | User-supplied label (e.g., "Stripe SWE II") |
| `resumeId` | string | Reference to the résumé used |
| `jdText` | string | The pasted job description |
| `score` | number | 0–100 |
| `matched` | list | Skills present in both résumé and JD |
| `missing` | list | Skills in JD but not in résumé |
| `weak` | list | Skills in JD that are underrepresented in résumé |
| `sectionBreakdown` | map | Per-JD-section match details |
| `scoringVersion` | string | Scoring algorithm version for historical comparability |
| `createdAt` | number | Unix ms |

Access patterns: list a user's résumés, list a user's analyses (newest first), fetch a single résumé or analysis. The PK/SK model covers all patterns without secondary indexes.

### S3 Layout

```
jdfit-resumes-{env}-{account}/
  {userId}/
    {resumeId}.pdf
```

Presigned URLs are scoped to the `{userId}/` prefix.

---

## API

All endpoints under `/api/v1`, protected by a Cognito JWT authorizer.

| Method | Path | Purpose |
|---|---|---|
| POST | `/resumes/upload-url` | Get a presigned S3 upload URL |
| GET | `/resumes` | List user's résumés |
| GET | `/resumes/{resumeId}` | Fetch one résumé with parsed data |
| DELETE | `/resumes/{resumeId}` | Delete résumé and S3 object |
| POST | `/analyses` | Run a match analysis |
| GET | `/analyses` | List analyses (filterable) |
| GET | `/analyses/{analysisId}` | Fetch one analysis |
| DELETE | `/analyses/{analysisId}` | Delete an analysis |
| GET | `/insights/skill-gaps` | Aggregate skill-gap data |

---

## Key Design Decisions

### Why SNS → SQS → Lambda instead of direct SNS → Lambda

Direct SNS → Lambda invocation works at low throughput, but SQS in between provides three things that matter even at small scale: `maxReceiveCount`-based redrive to a DLQ (try 3 times, then preserve for inspection), queue-depth visibility as a CloudWatch metric, and batch-size control on the Lambda trigger. Direct SNS → Lambda retries are less controllable and failed messages can be silently dropped.

### Why deterministic keyword matching instead of LLM-based semantic matching

The scoring function is deterministic and version-stamped. Running the same résumé against the same JD always produces the same score. This property is essential for the skill-gap dashboard — trend data over time is only meaningful if scores are comparable. It's also fast (no external API call), free (no token cost), and fully explainable (every matched/missing skill is traceable to a specific token). LLM-based semantic matching is a planned v2 enhancement as an optional "deep analysis" mode.

### Why presigned URLs instead of uploading through Lambda

Uploading PDFs through API Gateway → Lambda would require base64 encoding the binary (inflating size ~33%), hit Lambda's 6MB payload limit, and proxy every byte through a function that has no reason to see it. Presigned URLs let the browser upload directly to S3, keeping Lambda out of the data path entirely.

### Why DynamoDB instead of RDS/PostgreSQL

The access patterns are simple key-value lookups and queries by partition key — no joins, no complex aggregations, no transactions spanning multiple tables. DynamoDB on-demand has zero idle cost (no always-on instance), and the PK/SK model maps cleanly to the two entities. RDS would add ~$15/month minimum for a db.t3.micro even when idle.

### Why `pdf-parse` locally instead of emulated Textract

LocalStack's Textract emulation is a mock — it returns stub responses, not real OCR output. For testing actual résumé parsing logic (section detection, skill extraction), `pdf-parse` provides real text extraction from PDF files. The parser abstraction layer swaps `pdf-parse` (local) for Textract (production) via an environment variable.

### Why CDK instead of Terraform

CDK is written in TypeScript — the same language as the frontend and backend — which eliminates a context switch. It provides strong typing for AWS constructs, catches configuration errors at compile time, and integrates tightly with the AWS SDK. For a single-developer project on AWS, the reduced cognitive overhead outweighs Terraform's multi-cloud flexibility.

---

## Security Model

- **Authentication:** Cognito Hosted UI with JWT tokens validated at the API Gateway layer — no auth logic in Lambda code.
- **Authorization:** Every DynamoDB query is scoped to the authenticated `userId`. Presigned upload URLs are scoped to the user's S3 prefix.
- **IAM:** Each Lambda has a dedicated role with resource-scoped permissions. No `Resource: "*"` anywhere. `s3:GetObject` only on this bucket, `dynamodb:*Item` only on these tables.
- **S3:** Bucket is private with public access blocked. Uploads via presigned URLs only, with content-length and content-type constraints. 60-second URL expiry.
- **Data protection:** S3 SSE-S3 encryption at rest, DynamoDB default encryption, HTTPS everywhere.
- **Rate limiting:** API Gateway usage plan capping requests per user.

---

## Observability

- Structured JSON logs from all Lambdas to CloudWatch.
- CloudWatch alarms: SQS DLQ depth > 0, processing queue age > 60s, Lambda error rate > 5%.
- One CloudWatch dashboard (defined in CDK) showing invocations, errors, duration percentiles, and SQS queue depth.
- AWS Budget alert at $5/month.

---

## Cost

The architecture is fully serverless — everything scales to zero when idle. There are no always-on resources (no NAT gateways, no ALBs, no RDS instances, no Fargate tasks).

At personal usage volume (~10 analyses/week), total AWS cost is under $1/month. Textract per-page charges are the only non-free-tier cost, and at ~20 pages/month that's a few cents.

---

## Project Structure

```
jdfit/
├── frontend/          # React + TypeScript + Vite
├── backend/           # Lambda handlers + Express local shim
│   └── lib/
│       ├── parser/    # Section detection, skill extraction
│       ├── matcher/   # JD tokenization, normalization, scoring
│       ├── storage/   # DynamoDB access (userId-scoped)
│       └── env/       # Local/prod implementation swap
├── shared/            # TypeScript interfaces, normalization dictionary
├── infra/             # AWS CDK stacks
└── README.md
```

---

## Future Enhancements

- LLM-based semantic matching as an optional "deep analysis" mode.
- Multi-résumé A/B comparison against a single JD.
- Export match reports to PDF.
- Chrome extension for one-click JD analysis from job boards.
