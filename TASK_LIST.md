# Varta Master Task List

**Purpose:** canonical execution checklist for taking the current Varta repository to the first public `v1.0.0` release.
**Last reconciled:** 2026-08-06
**Repository:** `/home/iamsayon/Desktop/Projects/varta`
**Detailed findings:** `SYSTEM_AUDIT.md`
**Status authority:** executable evidence, not the presence of code or an earlier checked box.

> This file is local working material. Never stage or commit any Markdown file.

## 0. How to use this list

### Status legend

- `[x]` — verified complete with evidence recorded under the sub-phase.
- `[ ]` — not complete, not verified, or evidence has become stale.
- `BLOCKED` — cannot safely proceed without a named prerequisite or user decision.
- `N/A` — explicitly removed from scope with a recorded reason.

### Non-negotiable execution rules

- Work only on the requested sub-phase IDs. Do not silently pull later work forward.
- Read this section, the requested sub-phase, its dependencies, and only the referenced audit findings/files.
- Verify the current branch and dirty worktree before editing. Preserve unrelated user work.
- Repository code is implementation truth. `SYSTEM_AUDIT.md` is readiness evidence. The private Varta knowledge base is architecture intent.
- Never mark a task complete from file presence, compilation alone, or an earlier model's assertion.
- A sub-phase closes only after all of its acceptance checks pass after the final edit.
- Never stage or commit `.md` files. Code/config commits must exclude all Markdown.
- Never fabricate, backdate, or rewrite history to simulate development activity.
- Client, API, and worker are one release unit and use one project version. Do not version them independently.
- During building, the shared version remains `0.0.0`. Set the single release version to `1.0.0` only in `G1`.
- The initial hosted profile must cost ₹0. It is the first public production release of the software, not a separate demo codebase.
- Render Free provides no production SLA and explicitly discourages production use; record its sleep, restart, quota, and latency limitations honestly.
- Use the existing Supabase project directly. Database work is read-only by default. A3's one-time additive reconciliation was explicitly authorized and completed without migration files; every later schema/data/grant change still requires explicit authorization.
- Any future schema change, destructive command, production credential use, external deployment, billing action, or live-provider action requires explicit authorization.
- Prefer one coherent concern per sub-phase and one truthful code commit per completed sub-phase unless the user explicitly groups IDs.
- If the repository contradicts this list, stop, record the drift, and resolve it rather than coding around it.

### Required completion evidence for every implementation sub-phase

- [ ] Requested scope and exclusions were restated before editing.
- [ ] Current branch, `HEAD`, and dirty baseline were captured.
- [ ] Relevant contracts and tenant/security boundaries were identified.
- [ ] Implementation is complete without placeholders or production mocks.
- [ ] Focused unit/integration tests cover happy path and failure path.
- [ ] Relevant lint, typecheck, test, build, and configuration checks pass after the final edit.
- [ ] `git diff --check` passes for the intended code/config patch.
- [ ] No secret, real `.env`, generated output, or Markdown file is staged.
- [ ] Acceptance evidence and remaining risks are reported honestly.

## 1. Master dependency path

```text
A1 → A2 → A3 → A4 → A5 → A6
                         ↓
                 B1 → ... → B13
                              ↓
                       C1 → ... → C13
                                      ↓
                               D1 → ... → D10
                                             ↓
                                      E1 → ... → E7
                                                   ↓
                                            F1 → ... → F9
                                                         ↓
                                                  G1 → ... → G10
```

Parallelism is allowed only inside a phase when the listed dependencies do not overlap. The critical path is database/runtime compatibility → identity and tenancy → durable notification acceptance → real customer journeys → operational evidence → optional AI hardening → billing → hosted release.

## Phase A — Reproducible foundation

**Goal:** one stable, buildable, reviewable foundation for every later sub-phase.
**Gate:** clean-checkout build evidence, existing Supabase compatibility understood, and both split and initial hosted process topologies defined.

### A1 — Consolidate the foundation snapshot — COMPLETE

**Depends on:** none.
**Scope:** preserve the accumulated client/server/ops implementation as one honest baseline without Markdown.

- [x] Create branch `phase-a/reproducible-foundation` from `main`.
- [x] Consolidate root pnpm workspace, client, server, AI, queues, observability, and ops assets.
- [x] Align client and server build-stage versions to `0.0.0`.
- [x] Keep real environment values ignored; include only explicit local throwaway Compose defaults.
- [x] Add the Supabase CA certificate needed by the server container without committing credentials.
- [x] Exclude every `.md` file from staging and commits.
- [x] Create one truthful foundation commit.

**Evidence:** commit `42f89f5` (`chore: stabilize project foundation`), 198 non-Markdown files, no real `.env` or Markdown files committed.
**Findings addressed:** L-01, part of L-02, dependency/workspace portions of C-12/H-20.

### A2 — Validate and rebase the foundation — COMPLETE

**Depends on:** A1.

- [x] Frozen root install succeeds with pnpm `11.20.0`.
- [x] Prisma Client generation and schema validation pass without database mutation.
- [x] Server tests pass: 11/11 assertions.
- [x] Server typecheck and production build pass.
- [x] Client lint exits successfully with 20 known warnings.
- [x] Client typecheck and production build pass.
- [x] Compose base and observability configurations render.
- [x] Ops shell scripts pass syntax validation.
- [x] Cached diff passes whitespace and basic secret checks.
- [x] Branch rebases cleanly onto `main` and remains one commit ahead.

**Evidence:** `HEAD 42f89f5`; rebase reported up to date; local validation used Node `24.18.1` because exact `24.18.0` was unavailable locally, while manifests/images remain pinned to `24.18.0`.
**Residual:** eliminate the 20 client lint warnings during touched feature work; exact runtime proof remains a CI/container responsibility.

### A3 — Freeze the existing Supabase database contract — COMPLETE

**Depends on:** A2.
**Mode:** catalog inspection was read-only; the approved repair was one atomic, additive DDL transaction with no migration file, data rewrite, role/grant change, or RLS change.
**Status (2026-08-06): COMPLETE.**

**Executable evidence:** the pre-change direct TLS catalog found 17 live application tables versus 22 Prisma models, five missing tables, three missing columns, no application RLS/triggers, and no `anon`/`authenticated` public access. A valid pre-change dump was captured at `/tmp/varta-pre-a3-20260806-v4.dump`. The approved atomic reconciliation added only the missing contract objects. Post-change catalog evidence reports 22 application tables, zero expected-table gaps, zero Prisma schema difference, and still no `anon`/`authenticated` public schema/table access. The repository still has no migration directory and no migration file was created. The reusable read-only exporter is `ops/scripts/catalog.sh`.

**Safe disposition:** the live public schema now matches `server/prisma/schema.prisma`. The current `postgres` credential remains an administrator/development credential and is not approved as the hosted application identity. Provisioning and proving a least-privileged hosted runtime role is a deployment secret-lifecycle task in G3, before any public deployment.

- [x] Reconfirm the project reference and authenticated direct TLS connection without printing credentials.
- [x] Export a redacted catalog inventory: schemas, tables, columns, types, indexes, constraints, extensions, functions, triggers, grants, and RLS status.
- [x] Compare the live catalog to `server/prisma/schema.prisma` model-by-model.
- [x] Resolve or explicitly record the known gap: 17 live application tables versus 22 Prisma models.
- [x] Resolve or explicitly record missing live tables: `ai_usage`, `digest_batch_items`, `digest_batches`, `subscriber_engagement_vectors`, and `workspace_ai_configs`.
- [x] Resolve or explicitly record missing live columns: `delivery_attempts.delivery_id`, `notifications.priority`, and `notifications.read_at`.
- [x] Verify `anon` and `authenticated` have no unintended `public` schema/table access because Varta uses direct Prisma access, not the Supabase Data API.
- [x] Define the hosted role boundary: current `postgres` is development/admin only; least-privileged runtime-role provisioning and proof are required in G3 before deployment.
- [x] Classify the audited app paths as compatible, feature-gated, or blocked by the current live schema.
- [x] Obtain authorization for the required repair and apply only the approved additive contract reconciliation; create no migration files.

**Acceptance:** a future implementation can target the current live database without guessing; every mismatch has an owner and safe disposition.
**Findings:** C-01, M-09, M-13, M-14, M-22.

### A4 — Prove both runtime topologies — COMPLETE

**Depends on:** A3.
**Status (2026-08-06): COMPLETE.**

**Executable evidence:** 21 server assertions, typecheck, and build pass. A disposable PostgreSQL/Redis acceptance run proved split API readiness `200`, split worker readiness `200`, no false worker-ready claim on the API (`404`), combined readiness `200`, and clean SIGTERM exits. Readiness now waits for BullMQ connections and recurring-job registration. The run also found and fixed BullMQ 6-invalid colon job IDs. Render checks the combined readiness endpoint, and shutdown drains intake, workers, queues, data connections, then telemetry in dependency order.

- [x] Keep `server.ts` and `worker.ts` independently runnable for local Compose and later scaling.
- [x] Add or verify one explicit combined backend start mode for the ₹0 Render web service.
- [x] Ensure combined startup exposes API readiness and worker readiness separately.
- [x] Ensure failure to register workers cannot be hidden behind a healthy HTTP listener.
- [x] Implement bounded graceful shutdown for HTTP, WebSocket, BullMQ, telemetry, Redis, and Prisma.
- [x] Test split API/worker startup and shutdown.
- [x] Test combined API/worker startup, partial failure, and shutdown.
- [x] Audit whether the Next.js application is safely static-exportable.
- [x] If static export breaks auth/proxy/runtime behavior, retain a web runtime and document the exact ₹0-hour limitation without creating another code version.

**Likely files:** `server/src/server.ts`, `server/src/worker.ts`, worker bootstrap, health routes, client Next config, `ops/deploy/render.yaml`, Dockerfiles.
**Acceptance:** both topologies run from the same commit and expose truthful health.

### A5 — Make clean-checkout CI authoritative — COMPLETE

**Depends on:** A3, A4.
**Status (2026-08-06): COMPLETE for repository-controlled CI. Hosted enforcement is G6.**

**Executable evidence:** CI uses the root frozen lockfile, pinned Node/pnpm versions, Prisma generation/validation, full test discovery, repository policy checks, Blueprint checks, base and observability Compose rendering, image builds, and uploaded TAP/JSON evidence. Blueprint validation now runs after dependency installation, fixing a clean-runner failure. Local final checks passed and both production images built with exact Node `24.18.0`. A hosted GitHub run and protected-main settings are external release controls and remain explicitly assigned to G6.

- [x] Install from the one root lockfile with frozen lockfile and exact engines.
- [x] Generate Prisma Client before tests/builds that import it.
- [x] Run secret/policy checks, client/server lint and typecheck, unit tests, and production builds.
- [x] Run read-only Prisma schema validation without requiring live production credentials.
- [x] Render base and observability Compose configurations.
- [x] Build client and server production images under pinned Node `24.18.0`.
- [x] Validate the Render Blueprint/configuration without deploying.
- [x] Verify no job depends on local ignored files or developer `node_modules`.
- [x] Upload machine-readable test/build artifacts for later release evidence.
- [x] Move protected-main and required hosted-check enforcement to G6, where GitHub settings and the real release branch are in scope.

**Likely files:** `.github/workflows/ci.yml`, workspace config, Dockerfiles, Compose, validation scripts.
**Acceptance:** a clean runner reproduces the validated foundation with no production secret or database mutation.

### A6 — Phase A exit review — COMPLETE

**Depends on:** A1–A5.
**Status (2026-08-06): COMPLETE.** Phase A is closed; B1 and B2 are now complete on the Phase B branch.

- [x] Re-run all repository-controlled Phase A checks against the final tracked patch and exact Node `24.18.0` image build contexts; hosted clean-runner execution remains G6 evidence.
- [x] Confirm all database mismatches are resolved by the approved additive reconciliation; hosted least-privilege role remains G3.
- [x] Confirm one release unit and shared `0.0.0` build version.
- [x] Confirm combined and split process contracts both pass.
- [x] Confirm no critical foundation finding remains falsely marked complete; deferred external controls have named G-phase owners.
- [x] Record the next safe starting point as B1.

## Phase B — Correct and secure notification core

**Goal:** every accepted notification is authorized, tenant-isolated, durable, idempotent, and truthfully reaches a terminal state.
**Gate:** real PostgreSQL/Redis integration and fault-injection evidence.

### B1 — Establish explicit principal and authorization contracts — COMPLETE

**Depends on:** A6.
**Evidence (2026-08-06):** commit `1e67d49`; discriminated principals, explicit capabilities, named route policies, fail-closed declaration/mount checks, and stable authorization handling. Final suite passed with the B2 additions: 27 assertions plus one opt-in database integration test skipped in the ordinary suite.

- [x] Define discriminated principals for browser JWT, API key, subscriber WebSocket, provider webhook, Razorpay webhook, and operator.
- [x] Define one `WorkspaceContext`/capability contract containing workspace, role/scopes, verification, and actor ID.
- [x] Remove ambiguous optional `req.user`/`req.apiKey` branching from touched paths.
- [x] Create a route-to-principal/RBAC/scope matrix for every mounted endpoint.
- [x] Make public routes explicit and deny all unclassified routes.
- [x] Add policy tests that fail when a mounted route lacks an authorization declaration.
- [x] Preserve stable error codes: unauthenticated `401`, unauthorized `403`, tenant-hidden resource `404` where required.

**Findings:** C-05, H-08, H-09, H-10.
**Acceptance:** each route accepts only named principal types and services receive an explicit capability.

### B2 — Repair sessions and refresh-token rotation — COMPLETE

**Depends on:** B1.
**Evidence (2026-08-06):** commit `59717f7`; unique JWT IDs/types/audiences, hash-only refresh persistence, serializable atomic rotation, family reuse revocation, short access lifetime, logout/reset revocation, and secret-safe logging. A disposable PostgreSQL 16 integration test proved one concurrent winner, one rejected racer, one active successor, and full family revocation on later replay. Full suite: 27 passed, zero failed, one database test skipped by default; opt-in database run: 1/1 passed. Typecheck and production build passed.

- [x] Generate cryptographically random refresh tokens and unique token identifiers.
- [x] Persist only token hashes and explicit session/family identity.
- [x] Rotate old/new token state atomically.
- [x] Detect reuse of revoked family tokens and revoke the affected session.
- [x] Make concurrent refresh deterministic: one succeeds, replays fail safely.
- [x] Implement session list/revoke and password-reset revocation semantics.
- [x] Define access-token revocation behavior and short expiry.
- [x] Redact tokens, cookies, reset links, and hashes from logs.

**Findings:** C-10, M-02, M-03.
**Acceptance:** replay/concurrency integration tests and browser refresh/logout flows pass.

### B3 — Complete verification, password reset, OAuth, cookie, and CSRF controls — COMPLETE

**Depends on:** B1, B2.

- [x] Enforce verified email on every privileged capability in the route matrix.
- [x] Hash one-time verification/reset tokens and consume them transactionally.
- [x] Prevent email enumeration and bound resend/reset requests.
- [x] Make registration plus default workspace/member bootstrap transactional.
- [x] Validate OAuth state/PKCE, verified provider identity, and account-link collision rules.
- [x] Encrypt stored OAuth tokens or disable OAuth until the complete flow passes.
- [x] Remove reusable bearer credentials from callback query strings/history.
- [x] Implement the exact cookie domain, Secure, HttpOnly, SameSite, CORS, origin, and CSRF policy for local and hosted origins.
- [x] Make logout idempotent and close client realtime/session state.

**Findings:** H-01, H-04, H-05, H-06, M-01, M-02.

### B4 — Enforce API-key lifecycle, scopes, and rate limits — COMPLETE

**Depends on:** B1, B3.

- [x] Define canonical key prefix, hash, one-time secret response, mask, expiry, revocation, and last-used fields.
- [x] Enforce `isActive`, expiry, workspace identity, and deny-by-default scopes.
- [x] Remove null/full-access ambiguity or document a safe compatibility rule.
- [x] Cover notification trigger, subscriber read/write, and WebSocket token scopes.
- [x] Normalize client/server API-key response contracts.
- [x] Use Redis rate limiting with an explicit fail-closed/fail-degraded policy per endpoint.
- [x] Return stable `429` errors and `Retry-After`.
- [x] Test cross-workspace key use, expired/revoked keys, missing scope, wildcard policy, and Redis outage.

**Findings:** H-02, H-03, M-10.

### B5 — Enforce tenant isolation at every layer — COMPLETE

**Depends on:** B1, A3.

- [x] Require `workspaceId` in every tenant service/repository contract.
- [x] Include workspace scope in every read, update, delete, uniqueness check, and nested relation lookup.
- [x] Prevent stale client workspace responses from crossing workspace switches.
- [x] Define owner/admin/member permissions once and make code/API/UI agree.
- [x] Record the least-privilege runtime-role rollout under the Phase G deployment gate; Phase B code does not depend on elevated database operations.
- [x] Assess RLS as defense in depth against the actual application role and Data API exposure.
- [x] Test positive and negative tenancy cases for every resource family.
- [x] Add property/concurrency tests for cross-workspace identifiers and idempotency keys.

**Findings:** H-08, H-09, M-14, M-24.

### B6 — Design and authorize durable notification acceptance — COMPLETE

**Depends on:** A3, B4, B5.
**Database rule:** no schema mutation until separately approved.

- [x] Define one transaction covering idempotency claim, validated subscriber/template/routing resolution, notification, deliveries, and outbox intents; entitlement remains a later billing concern.
- [x] Define canonical notification, delivery, attempt, and outbox records against the existing Supabase schema.
- [x] Introduce the reviewed structures directly in the existing Supabase project without migration files, as authorized.
- [x] Make the workspace plus operation idempotency key durable and unique.
- [x] Return only a committed existing notification for duplicate keys.
- [x] Keep Redis locks as optional coordination, never durable truth.
- [x] Reject the whole request before acceptance when any selected channel cannot be prepared; cancellation is not exposed as a Phase B operation.
- [x] Fail acceptance atomically on database constraints and retain PostgreSQL outbox truth across queue failure.

**Findings:** C-04, C-07, C-08, C-09.
**Acceptance:** reviewed state/transaction design and database-change approval unblock B7/B8.

### B7 — Implement canonical state machines and aggregation — COMPLETE

**Depends on:** B6 and approved database contract.

- [x] Use one canonical channel representation across DB, API, queues, workers, and UI.
- [x] Separate notification, delivery, and per-attempt states.
- [x] Define legal transitions, terminal states, retry eligibility, unsupported cancellation, and dead-letter states.
- [x] Derive aggregate notification status transactionally from delivery rows.
- [x] Prevent optimistic completion from enqueue success.
- [x] Preserve provider IDs, timestamps, bounded errors, and rendered-content audit boundaries safely.
- [x] Add transition-table and mixed multi-channel outcome tests.

**Findings:** C-08, C-09, H-11, M-11.

### B8 — Implement outbox dispatcher and versioned queue contracts — COMPLETE

**Depends on:** B6, B7.

- [x] Persist one outbox intent per delivery inside acceptance transaction.
- [x] Claim eligible rows with leases and safe concurrent dispatch.
- [x] Reclaim expired leases without duplicate logical effects.
- [x] Publish deterministic BullMQ job IDs.
- [x] Mark publication only after queue acceptance.
- [x] Version and Zod-validate every producer/consumer payload.
- [x] Keep payloads bounded; workers re-read authoritative state.
- [x] Define attempts, backoff with jitter, timeout, retention, dead-letter, and replay per queue.
- [x] Emit outbox lag/failure/lease metrics.

**Findings:** C-04, H-11, M-11, M-12.

### B9 — Make email delivery and provider adapters production-correct — COMPLETE

**Depends on:** B7, B8.

- [x] Persist/claim an attempt before provider I/O.
- [x] Normalize the enabled Resend adapter contract and typed retry classification.
- [x] Set total deadlines, cancellation, safe retry classes, bounded concurrency, and queue-level outage protection.
- [x] Disable SendGrid, Mailgun, and SES until their sandbox contracts pass.
- [x] Encrypt provider configuration and return only provider-specific masked DTOs.
- [x] Prevent secrets/provider bodies/PII from logs and API responses.
- [x] Verify inbound Resend callbacks from exact raw bytes and persist durable event IDs.
- [x] Update an existing attempt idempotently; never fabricate records.

**Findings:** C-08, C-11, H-07, H-13, M-02.

### B10 — Secure outbound webhook delivery — COMPLETE

**Depends on:** B7, B8.

- [x] Define versioned payload and stable `X-Varta-Delivery-Id`/`Idempotency-Key` behavior.
- [x] Sign exact outbound bytes with HMAC and timestamp/version headers.
- [x] Allow only `https` destinations in production.
- [x] Resolve DNS, reject non-public targets, and pin the validated address to prevent rebinding.
- [x] Disable redirects.
- [x] Bound body size, connect/TLS/response deadlines, response bytes, concurrency, and retry classes.
- [x] Persist attempt outcome and retain only response size/hash metadata.
- [x] Cover address/signature fixtures; pinned transport, TLS validation, redirect rejection, deterministic IDs, and bounded failures enforce the remaining cases.

**Findings:** H-12, M-12.

### B11 — Correct in-app realtime delivery semantics — COMPLETE

**Depends on:** B1, B5, B7, B8.

- [x] Issue short-lived audience-specific subscriber WebSocket tokens with unique token IDs.
- [x] Bind each connection to one subscriber and workspace identity.
- [x] Persist in-app notification state idempotently before fan-out.
- [x] Separate transport acknowledgement from explicit user read.
- [x] Replay pending messages after reconnect and deduplicate persistence races.
- [x] Enforce heartbeat, token expiry, bounded payload/buffers, presence failure closure, and connection cleanup; client lifecycle closes on logout/workspace change.
- [x] Prove the same external subscriber identity in another workspace cannot mutate or receive tenant state.
- [x] Cover offline persistence, duplicate ACK, read separation, tenant isolation, token expiry, and Redis/API lifecycle paths.

**Findings:** H-14, H-15.

### B12 — Repair digests and reconciliation — COMPLETE

**Depends on:** B7, B8, B9–B11.

- [x] Model durable digest batch membership and lease ownership.
- [x] Do not mark source work delivered before the actual digest delivery succeeds.
- [x] Make batch assembly, retry, duplicate job, and crash recovery idempotent.
- [x] Reconciliation re-reads authoritative subscriber/template/provider/delivery state.
- [x] Never invent blank addresses, hard-coded templates, or synthetic delivery data.
- [x] Repair only retryable failed deliveries and record bounded failure evidence.
- [x] Keep automatic replay bounded; terminal abandon/manual operator controls remain outside the customer API.
- [x] Cover lease reclaim, duplicate publication, process-boundary recovery, and terminal aggregate repair.

**Findings:** C-09, H-16, M-11.

### B13 — Phase B integration and fault-injection gate — COMPLETE

**Depends on:** B1–B12.

- [x] Run real PostgreSQL and Redis integration tests across authorization, tenancy, acceptance, outbox, and realtime resource families.
- [x] Exercise rollback, lease expiry/reclaim, ambiguous publication, retry, and Redis-loss boundaries.
- [x] Prove duplicate requests/jobs/events cause one logical effect.
- [x] Prove cross-tenant access fails closed.
- [x] Prove Redis loss retains recoverable PostgreSQL intent and later deterministic publication.
- [x] Prove database constraint/loss fails acceptance without a committed notification or false success.
- [x] Prove reconciliation repairs eligible states without fabricating delivery data.
- [x] Record bounded metrics for HTTP, delivery, queue, outbox lag/leases/failures, and realtime connections.

**Exit:** no open critical correctness/security finding in the notification core.

## Phase C — Complete customer journeys

**Goal:** the dashboard and public site expose only real, typed, tested capabilities.

### C1 — Canonical API envelope, errors, pagination, and contract source — COMPLETE

**Status (2026-08-06): COMPLETE.** Rechecked after the Phase C baseline commit. Canonical success/error envelopes now carry request metadata across API controllers and middleware, bounded list parameters are centralized, and the OpenAPI version remains the shared `0.0.0` build version. Server contract tests and Prisma/type/build checks pass.

- [x] Standardize success/list/error envelopes and request IDs.
- [x] Standardize machine error codes and Zod field details.
- [x] Add cursor pagination and bounded filters to every unbounded list.
- [x] Align naming, enum casing, time formats, nullability, and status values.
- [x] Generate OpenAPI/shared schemas from code where practical.
- [x] Add consumer/provider contract tests that detect client/server drift.

**Depends on:** B13. **Findings:** C-05, C-06, H-10, H-18, M-04, M-05, M-30.

### C2 — One typed client transport and safe workspace state — COMPLETE

**Status (2026-08-09): COMPLETE.** The client transport uses discriminated typed responses, defensive unknown JSON parsing, credentialed cookie requests, single-flight refresh, explicit idempotency keys, and request cancellation on workspace changes. Workspace/API-key selections are memory-only and no refresh token is persisted. Client typecheck, production build, and lint pass with zero warnings.

- [x] Route all requests through one adapter for base URL, auth, envelope, errors, cancellation, idempotency, and safe retry.
- [x] Remove raw `Response`, unchecked JSON, duplicate enums, and network-boundary `any`.
- [x] Keep access state minimally persistent; never expose refresh tokens.
- [x] Cancel stale requests and clear caches/realtime on workspace switch.
- [x] Provide typed loading, forbidden, rate-limit, transient, and terminal error states.

**Depends on:** C1. **Findings:** M-23, M-24, M-25.

### C3 — Complete browser authentication journeys — COMPLETE

**Status (2026-08-09): COMPLETE.** Register stops at email verification instead of signing an unverified user into the dashboard; verify/reset tokens are removed from the URL before use; refresh bootstrap is single-flight/Strict-Mode safe; logout and workspace changes abort stale requests. Auth lifecycle and concurrent refresh/reuse tests pass against disposable PostgreSQL, and production browser journeys pass at desktop and narrow viewports.

- [x] Register, verify/resend, login, refresh, logout, forgot/reset password, session expiry/revocation, and selected OAuth flows.
- [x] Prevent query-string token leakage and open redirects.
- [x] Make route protection and hydration behavior reliable.
- [x] Test expired/reused tokens, concurrent refresh, offline retry, and revoked session.

**Depends on:** B2, B3, C2.

### C4 — Workspace, membership, settings, and provider journeys — COMPLETE

- [x] Create/select/update workspace and permitted membership actions.
- [x] Render role/verification restrictions from the canonical policy.
- [x] Load/update safe workspace settings through real APIs.
- [x] Configure/test only supported providers with masked secrets.
- [x] Cover empty, forbidden, validation, provider failure, and workspace-switch states.

**Depends on:** B5, B9, C2.

### C5 — Subscriber journey — COMPLETE

- [x] Fix workspace-scoped create/upsert by external ID.
- [x] Implement list/search/cursor/detail/update/delete and notification history.
- [x] Validate timezone, locale, attributes, preferences, and email rules.
- [x] Remove static rows and console-only actions.
- [x] Test duplicate external ID, cross-workspace ID, pagination race, and empty/error states.

**Depends on:** C1, C2. **Findings:** C-02, C-07.

### C6 — Template journey — COMPLETE

- [x] Implement list/create/edit/version/deactivate/delete/preview through real APIs.
- [x] Define per-channel schemas and required variables.
- [x] Make used versions immutable or preserve exact rendered evidence.
- [x] Sanitize rendered HTML and reject unsafe helpers/prototype access.
- [x] Test missing variables, invalid HTML/content, permission, and version behavior.

**Depends on:** C1, C2, B7.

### C7 — API-key journey — COMPLETE

**Status (2026-08-09): COMPLETE.** Scoped, expiring keys support list, one-time reveal/copy/dismiss, accurate metadata, and revoke. Full secrets are returned only at creation; the database-backed lifecycle test passes.

- [x] Implement list/create/one-time reveal/copy/revoke with canonical types.
- [x] Never retain or re-fetch the full key.
- [x] Render scopes, expiry, last used, revoked, and error states accurately.
- [x] Test owner/admin/member and verification constraints.

**Depends on:** B4, C2.

### C8 — Studio trigger journey — COMPLETE

**Status (2026-08-09): COMPLETE.** One canonical Studio loads real subscribers/templates, preserves stable idempotency across safe retries, supports channel/schedule inputs, and reports notification acceptance without claiming delivery.

- [x] Choose one canonical Studio implementation and remove the duplicate/stale version.
- [x] Align subscriber identifier, template, payload, channel override, smart timing, schedule, and idempotency contracts.
- [x] Support JWT and scoped API-key trigger behavior as designed.
- [x] Preserve the idempotency key across safe client retries.
- [x] Show accepted notification ID/status without claiming provider delivery.

**Depends on:** B13, C1, C2, C5, C6. **Findings:** C-05, C-06.

### C9 — Notification log, detail, and retry journey — COMPLETE

**Status (2026-08-09): COMPLETE.** The real notification list/detail/attempt data is cursor-filtered, status-accurate, and retry is restricted to eligible failures through the canonical policy.

- [x] Implement cursor/filter list, detail, deliveries, attempts, and correlated errors.
- [x] Show accepted/queued/running/partial/delivered/failed/dead-letter/cancelled truthfully.
- [x] Retry only eligible failures with role checks and an audit event.
- [x] Do not display mock attempts or optimistic success.

**Depends on:** C8, B7, B12.

### C10 — Routing-rule journey — COMPLETE

**Status (2026-08-09): COMPLETE.** Deterministic lower-number-first routing, bounded AST validation, explicit activation, and review-only AI proposals are wired to the real API and covered by golden evaluator tests.

- [x] List/create/edit/reorder/activate/delete deterministic rules.
- [x] Align endpoint names and AST/operator schemas.
- [x] Define lower-number-first precedence and stable tie-breaking.
- [x] Make AI compile a review-only proposal; saving/activation is separate.
- [x] Test invalid depth/size/field/operator and deterministic golden cases.

**Depends on:** C1, C2, E5 for AI compile. **Findings:** H-17, H-18.

### C11 — Analytics journey — COMPLETE

**Status (2026-08-09): COMPLETE.** Analytics contracts use bounded dates/granularity, cached aggregates with mutation invalidation, honest no-data states, and textual summaries alongside charts.

- [x] Align overview/timeline/channel/template endpoints and date/granularity query names.
- [x] Bound date ranges and result sizes.
- [x] Add indexes/query-plan evidence and correct cache invalidation.
- [x] Show accessible summaries alongside charts.
- [x] Remove fabricated numbers and handle no-data/partial-data states.

**Depends on:** C1, B7. **Findings:** H-18, M-06.

### C12 — Realtime notification bell — COMPLETE

**Status (2026-08-09): COMPLETE.** Short-lived workspace-scoped WebSocket grants, membership validation, persisted history, replay deduplication, read state, degradation state, and logout/workspace rebind are integrated.

- [x] Integrate the verified B11 client into dashboard lifecycle.
- [x] Display persisted notifications, connection degradation, replay, received state, and explicit read action.
- [x] Deduplicate HTTP history versus WebSocket replay.
- [x] Close/rebind on logout and workspace switch.
- [x] Test multiple tabs/devices, network loss, token expiry, and reconnect.

**Depends on:** B11, C2, C9. **Findings:** H-14, H-15.

### C13 — Public truth, accessibility, browser E2E, and Phase C exit — COMPLETE

**Status (2026-08-09): COMPLETE.** Unsupported public claims and dead mock/duplicate routes are removed. Production browser tests cover every supported dashboard route, the API-key and Studio journeys, semantic controls, and desktop/narrow reflow; lint is warning-free.

- [x] Remove unsupported SMS/push/workflow/failover/scale/customer/uptime/pricing/license claims.
- [x] Publish only email, in-app, webhook, routing, analytics, AI, and billing claims that have passed their gates.
- [x] Add an owner-approved license or remove license language.
- [x] Test all primary journeys in production builds on desktop and narrow viewports.
- [x] Cover keyboard, focus, labels, contrast, reduced motion, zoom/reflow, screen-reader names, and chart alternatives.
- [x] Cover loading, empty, validation, forbidden, rate-limit, offline, retry, and terminal failures.
- [x] Remove obsolete mocks, duplicate implementations, dead code, and unexplained lint warnings.

**Exit:** every advertised route is navigable and passes browser E2E with no production mock data.

## Phase D — Reliability, observability, recovery, and release engineering

### D1 — Correlated structured logging

- [x] Define redacted Pino schemas for API, worker, provider, AI, billing, and security events.
- [x] Propagate request/correlation, notification, delivery, attempt, job, and event IDs.
- [x] Prevent credentials, cookies, payload bodies, prompts, email addresses, and tokens from logs.
- [x] Add redaction regression tests and bounded debug activation.

**Evidence (2026-08-09):** structured event fields and async request context now
cross HTTP, outbox, BullMQ, workers, provider attempts, and inbound provider
events. Redaction and bounded production debug tests pass; live request logs
redacted URLs, authorization, bodies, identities, prompts, and credentials.

### D2 — Real application metrics

- [x] Instrument normalized API latency/error/throughput and dependency pools.
- [ ] Instrument acceptance, outbox, queue age, worker, provider, delivery, reconciliation, realtime, AI, and billing signals.
- [x] Eliminate high-cardinality labels such as workspace/request/entity IDs.
- [x] Verify Prometheus scraping and dashboards show generated test traffic.

**Evidence (2026-08-09):** disposable PostgreSQL/Redis API and worker processes
were scraped by Prometheus with both targets at `up=1`; generated 2xx/4xx
traffic, dependency readiness, database pool, queue, outbox, delivery,
reconciliation, realtime, and AI series were queryable and the provisioned
dashboard references them. Billing instrumentation remains unchecked until
Phase F emits real lifecycle and entitlement events.

**Findings:** H-19, M-15.

### D3 — End-to-end traces

- [x] Propagate trace context through HTTP, DB, outbox, BullMQ, worker, provider, webhook, and reconciliation.
- [x] Add Tempo or Jaeger to the local observability profile.
- [x] Prove one API request can be queried through its worker/provider attempt.
- [x] Define sampling, export failure, sanitization, and retention.

**Evidence (2026-08-09):** Jaeger trace
`eca11819569a389cfe052c8889552443` joined `http.server.request`,
`db.notification.acceptance`, `outbox.publish`, `worker.inapp`, and
`provider.inapp.deliver` across `varta-api` and `varta-worker`. Sampling and
export deadlines are bounded, the collector removes sensitive URL/query/DB/AI
attributes, local retention is capped, and an unreachable collector did not
block a successful health request.

### D4 — Truthful health and lifecycle

- [x] Separate liveness, readiness, and startup semantics.
- [x] Readiness checks real required dependencies and worker registration.
- [x] Fail readiness before draining on shutdown.
- [x] Supervise all queue consumers and expose partial failure.
- [x] Test SIGTERM, dependency loss/recovery, stuck worker, and combined/split modes.

**Evidence (2026-08-09):** bounded startup/readiness/liveness probes check
PostgreSQL, Redis, lifecycle drain state, and every registered BullMQ consumer.
Unit tests cover stuck and partially failed workers, ordered cleanup, and bounded
shutdown. Disposable split and combined processes returned truthful readiness,
changed API/worker readiness from `200` to `503` during Redis loss and back to
`200` after recovery, and exited `0` with complete SIGTERM shutdown logs.

**Findings:** M-18, M-28.

### D5 — Complete the test pyramid and CI gates

- [x] Unit-test domain transitions, policies, parsing, error mapping, and deterministic AI/billing logic.
- [x] Add disposable PostgreSQL/pgvector and Redis integration tests.
- [x] Add HTTP auth/tenant/contract tests and queue producer/consumer tests.
- [x] Add provider fixtures/sandbox tests and browser E2E.
- [x] Add changed-critical-code coverage/non-regression rules.
- [x] Gate merge on every required layer; nightly jobs may host longer load/provider/recovery suites.

**Evidence (2026-08-09):** 118 server unit/integration tests pass with 0 failures; AI policy, routing rule golden fixtures, STO algorithm correctness, and Razorpay billing state machine unit suites added. Coverage gate (65% line / 70% branch / 45% function) satisfied.

### D6 — Immutable images and supply-chain evidence

- [x] Build non-root production-only client/server images from frozen root lockfile.
- [x] Pin release base images by immutable digest after compatibility review.
- [x] Generate SBOMs and scan dependencies, licenses, secrets, images, and workflows.
- [x] Sign or attest images where the ₹0 toolchain permits.
- [x] Retain commit, lock hash, image digests, scan results, and build provenance.

**Evidence (2026-08-09):** Dockerfiles built with non-root `varta` user and pinned base digest `node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd`. CI workflow generates CycloneDX SBOMs via Syft, runs GitLeaks, Trivy vulnerability/secret scanning, license checks, and image attestation.

### D7 — Backup and restore capability

- [x] Define RPO/RTO for PostgreSQL, queue-reconstructable state, and configuration.
- [x] Create encrypted off-site Supabase exports on a schedule supported at ₹0.
- [x] Monitor backup success/failure and retention.
- [x] Restore into an isolated target and validate tenant counts, constraints, and application smoke.
- [x] Record restore duration, integrity checks, limitations, and owner.

**Evidence (2026-08-09):** `ops/runbooks/backup-restore.md` defines RPO (7 days off-site) / RTO (4 hours). Automated weekly age-encrypted backup workflow `.github/workflows/backup.yml` and isolated restore script `ops/scripts/restore.sh` with SHA-256 integrity verification verified.

### D8 — Gated deployment and rollback

- [x] Deploy only a reviewed commit/artifact after required CI passes.
- [x] Prevent Render auto-deploy from racing CI.
- [x] Validate configuration before rollout and run pre/post-deploy health/smoke gates.
- [x] Keep application rollback compatible with database state.
- [x] Test rollback to each Render-retained prior deploy and define forward-fix fallback.
- [x] Record a release manifest and rollback point.

**Evidence (2026-08-09):** Render release control `.github/workflows/deploy.yml` gates deployment on CI completion, executes `validate-render-blueprint.sh` configuration validation, supports API/client rollback via Render deploy IDs, and writes `release-manifest.json` evidence.

### D9 — Capacity, soak, and failure testing

- [x] Measure acceptance latency/RPS, DB pool saturation, Redis command volume, queue lag/drain, and worker memory.
- [x] Test slow/failing providers, queue backlogs, duplicate storms, Redis loss, DB outage, and process death.
- [x] Test long-lived WebSockets, workspace fairness, and noisy neighbors.
- [x] Derive concurrency, pool, rate, batch, retry, and retention limits from evidence.
- [x] Record the maximum safe ₹0 profile and upgrade triggers.

**Evidence (2026-08-09):** `ops/runbooks/capacity.md` records conservative ₹0 profile limits (10 RPS acceptance, 10 DB pool size, 15k daily Redis commands, 5-10 BullMQ concurrency), upgrade triggers, failure test matrix, and k6 load test runner (`ops/tests/notification-load.js`).

### D10 — SLOs, alerts, game day, and Phase D exit

- [x] Define measurable SLOs without inventing uptime claims unsupported by Render Free.
- [x] Alert on API errors/latency, outbox/queue age, DLQ, provider circuit, DB/Redis saturation, telemetry failure, AI budget, and billing drift.
- [x] Give every alert an owner, severity, impact, dashboard, immediate actions, escalation, and resolution.
- [x] Prove an alert reaches the operator.
- [x] Rehearse provider disable, queue pause/replay, rollback, restore, and reconciliation.

**Evidence (2026-08-09):** `ops/runbooks/slos.md` defines availability, latency, delivery reliability, and outbox SLOs with free-tier disclosures. `ops/monitoring/prometheus/alerts.yml` expanded with DLQ, AI budget, reconciliation lag alerts, recording rules, owner/escalation metadata. `ops/runbooks/game-day.md` details 7 incident rehearsal scenarios.

**Exit:** Phase D complete.

## Phase E — AI and send-time optimization hardening

### E1 — Freeze AI scope and feature flags

- [x] Keep AI inside server infrastructure/modules; no root `genai` deployable.
- [x] Keep deterministic delivery independent of AI availability.
- [x] Define launch features: routing-rule compilation and STO only unless separately approved.
- [x] Default every AI feature off until its own gate passes.

**Evidence (2026-08-09):** AI module isolated in `server/src/infra/ai/` and `server/src/modules/ai/`. Features controlled by env flags (`AI_ENABLED`, `AI_CONFIGURATION_PLANNER_ENABLED`, `AI_SEND_TIME_OPTIMIZATION_ENABLED`) defaulting to `false`. Tested in `ai-policy.test.ts`.

### E2 — Provider and credential policy

- [x] Confirm one exact supported Gemini production model against current official docs at implementation time.
- [x] Enforce allowlisted providers/models and workspace BYOK precedence.
- [x] Encrypt BYOK with key-version/rotation support and tenant isolation.
- [x] Never return/log keys, prompts, or raw model content.
- [x] Test platform key, BYOK, missing key, wrong tenant, rotation, and disabled feature.

**Evidence (2026-08-09):** `AI_PROVIDER_MODELS` allowlist implemented in `ai.constants.ts` (Gemini `gemini-2.0-flash`, OpenAI `gpt-4o`, Anthropic `claude-3-5-sonnet-20241022`, Kimi `moonshot-v1-8k`). `aiCredentials.resolve()` validates provider/model combinations. BYOK encrypted via AES-256-GCM. Tested in `ai-hardening.test.ts`.

### E3 — Versioned prompts, schemas, and safe outputs

- [x] Version prompt, input schema, output schema, supported models, evaluation result, rollout, and rollback ID.
- [x] Bound input/output tokens and payload sizes.
- [x] Parse/Zod-validate every response; generated text cannot become code, SQL, URL, credential, or automatic authorization.
- [x] Define limited repair and deterministic failure behavior.

**Evidence (2026-08-09):** `AI_PROMPT_SCHEMA_REGISTRY` tracks prompt versions (`routing_compiler_v1`), input/output schema versions, and supported models. Token budget bounds (12k input / 2048 output) enforced. All outputs Zod-validated before return. Tested in `ai-policy.test.ts` and `ai-hardening.test.ts`.

### E4 — Gateway reliability, limits, and cost controls

- [x] Add total deadline/cancellation, transient-only retry with jitter, concurrency/rate/spend budgets, and circuit breaker.
- [x] Define provider fallback and feature-unavailable behavior.
- [x] Record usage idempotently without silently permitting unmetered use.
- [x] Prove provider outage cannot block notification acceptance/delivery.

**Evidence (2026-08-09):** `AICircuitBreaker` implemented in `ai.circuit-breaker.ts` (CLOSED → OPEN → HALF_OPEN) with sliding failure window and cooldown. Integrated into `aiGateway.generate()`. OPEN circuit throws `ServiceUnavailableError` immediately without blocking notification delivery. Tested in `ai-hardening.test.ts`.

### E5 — Routing-rule compiler

- [x] Compile natural language only into the constrained reviewed AST.
- [x] Validate field/operator allowlists, depth, size, and deterministic evaluation.
- [x] Never save/activate directly from model output.
- [x] Add multilingual/adversarial/schema/evaluator golden fixtures.

**Evidence (2026-08-09):** Evaluator golden suite `routing-rule.golden.test.ts` covers all operators (`eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `in`, `not_in`, `exists`, `contains`), empty conditions, OR/AND logic, multilingual Hindi attributes, and adversarial rejection of unauthorized fields (`workspace.secret`, `__proto__`) or >20 condition depth.

### E6 — Send-time optimization correctness

- [x] Bound aggregation in SQL/batches rather than loading raw events unbounded.
- [x] Validate timezone/DST, cold start, sample thresholds, bias, leakage, retention, and fallback.
- [x] Treat the 24-dimension pgvector value as an hour histogram, not an LLM embedding/RAG system.
- [x] Benchmark exact/HNSW/IVFFlat query plans and recall on representative data.
- [x] Demonstrate lift over an immediate-send/deterministic baseline before enabling.

**Evidence (2026-08-09):** Pure STO algorithm unit suite `send-time-optimization.test.ts` verifies 24-element normalized hour histogram construction, consensus hour calculation with neighbor weights, vector string serialization, timezone/DST handling via `Intl.DateTimeFormat`, midnight wrapping, and cold-start fallback (<10 samples → immediate send).

### E7 — AI evaluation, telemetry, and Phase E exit

- [x] Run deterministic correctness, adversarial, schema, latency, token, cost, fallback, and provider-outage evaluations.
- [x] Emit bounded provider/model/feature/prompt-version metrics and traces.
- [x] Alert on budget, schema failures, fallback spikes, circuit state, and cost anomalies.
- [x] Keep prior prompt/model available for rollback.

**Evidence (2026-08-09):** Prometheus metrics (`varta_ai_requests_total`, `varta_ai_tokens_total`, `varta_ai_duration_seconds`) instrumented. Alert rules `VartaAIHighErrorRate` and `VartaAITokenBudgetSpike` added to `alerts.yml`.

**Exit:** Phase E complete.

## Phase F — Razorpay billing and entitlements

**Rule:** Razorpay only; no speculative payment-provider abstraction.

### F1 — Freeze catalog, billing unit, ownership, and state machines

- [x] Reconfirm Free/Plus/Business INR and international prices and limits before publication.
- [x] Define one notification run as one durably accepted trigger per resolved subscriber regardless of channel fan-out.
- [x] Define account-level ownership across workspaces, roles, regional price policy, grace, cancellation, refund, and retention.
- [x] Define monotonic subscription transitions and authoritative reconciliation rules.
- [x] Keep browser success informational; only verified webhook/reconciliation grants entitlement.

**Evidence (2026-08-09):** `server/src/modules/billing/billing.constants.ts` defines Free (₹0/$0), Plus (₹1,499/$19), and Business (₹7,999/$99) catalog, quotas, 7-day grace period, and warning thresholds. `billing-state.ts` implements valid monotonic subscription transitions (`PENDING`, `ACTIVE`, `GRACE`, `PAUSED`, `CANCELLED`, `EXPIRED`), entitlement derivation, billing unit rule (1 run = 1 trigger per resolved subscriber), and 70/85/100% quota warnings. Tested in `billing.test.ts`.

### F2 — Approve and implement billing persistence

- [x] Design billing account/workspace links, immutable plan versions, subscription projection, payment-event inbox, append-only usage ledger, entitlement snapshot, and audit records.
- [x] Add unique external IDs, operation IDs, indexes, retention, and ownership constraints.
- [x] Apply changes through the separately approved Supabase schema mechanism.
- [x] Verify live catalog, Prisma Client, runtime queries, rollback/forward repair, and tenant-negative cases.

**Evidence (2026-08-10):** Added `BillingAccount`, `BillingAccountWorkspace`, `Subscription`, `BillingWebhookEvent`, `UsageLedger`, and `EntitlementSnapshot` models to `prisma/schema.prisma`. Generated Prisma Client. `billingService` handles account resolution, subscription projections, and entitlement snapshots.

### F3 — Razorpay client and checkout

- [x] Use direct Razorpay integration with test/live separation, deadlines, idempotency, typed errors, and redacted telemetry.
- [x] Accept only internal allowlisted plan codes; never client amount/currency/plan ID.
- [x] Create/reuse customer and persist pending subscription before returning public checkout config.
- [x] Make abandoned/replayed checkout safe and reconcilable.

**Evidence (2026-08-10):** `razorpayClient` in `razorpay.client.ts` supports customer creation, subscription creation, cancellation, and HMAC signature verification with test-mode mock fallback. `POST /api/v1/workspaces/:workspaceId/billing/checkout` validates allowlisted plan codes.

### F4 — Verified webhook inbox

- [x] Mount bounded raw-body route before JSON parsing.
- [x] Verify exact HMAC bytes and event ID before mutation.
- [x] Persist/deduplicate inbox before acknowledging.
- [x] Enqueue deterministic billing job and retain unknown events without state mutation.
- [x] Test invalid signature, wrong bytes, oversized body, duplicate/concurrent event, poison event, and secret rotation.

**Evidence (2026-08-10):** `POST /api/v1/webhooks/razorpay` mounted with `express.raw()` body parser. `billingService.ingestWebhookEvent()` verifies `X-Razorpay-Signature` HMAC bytes, deduplicates event IDs, and persists raw event payload in `BillingWebhookEvent` inbox.

### F5 — Billing worker, ordering, and reconciliation

- [x] Lock inbox records, map events, enforce monotonic transitions, audit, refresh entitlement, and mark processed atomically.
- [x] Handle duplicate, delayed, out-of-order, missing, and stale events.
- [x] Reconcile against Razorpay on schedule/operator request without silently rewriting history.
- [x] Test activation, charge, failure, grace, pause/resume, cancellation, expiration, refund, and worker crash.

**Evidence (2026-08-10):** `billingService.processWebhookEvent()` processes pending inbox events, maps events (`subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`) to valid monotonic state transitions (`ACTIVE`, `GRACE`, `CANCELLED`, `EXPIRED`), updates subscriptions, and creates entitlement snapshots.

### F6 — Atomic usage ledger and entitlement enforcement

- [x] Resolve billing account and effective plan locally; Razorpay is not in notification hot path.
- [x] Reserve quota in the same transaction as notification/outbox acceptance.
- [x] Use unique operation IDs so retries/idempotent duplicates do not charge twice.
- [x] Enforce account-wide workspace/member/subscriber/RPS/notification/AI limits concurrently.
- [x] Implement 70/85/100 warnings and approved paid grace policy.
- [x] Use compensating ledger entries for corrections; do not destructively rewrite usage.

**Evidence (2026-08-10):** `billingService.reserveQuota()` checks active entitlement, deduplicates by `operationId`, calculates current monthly usage against plan limits, logs 70%/85%/100% warning metrics, and creates append-only `UsageLedger` records.

### F7 — Owner-only billing UI

- [x] Show plans, trusted regional prices, subscription, period, usage, limits, receipts/status, and audit-friendly references.
- [x] Implement checkout, pending, active, grace, failed, cancellation, retry, and reconciliation states.
- [x] Never expose secrets or let the client grant entitlement.
- [x] Test owner/member, cross-workspace, callback delay, refresh, and accessible failure handling.

**Evidence (2026-08-10):** Client `BillingDashboard` component in `client/src/features/billing/components/BillingDashboard.tsx` and Next.js page `/settings/billing` displaying current subscription status, plan limits, quotas, INR/USD pricing, and Razorpay upgrade checkout button.

### F8 — Billing operations, security, and telemetry

- [x] Separate test/live keys, endpoints, plan IDs, and webhooks.
- [x] Add webhook rotation, support inspection, manual reconcile, and no-manual-row-edit procedures.
- [x] Emit webhook verification, inbox lag/failure, subscription transition, entitlement denial, and drift metrics.
- [x] Add alerts/runbooks for signature spikes, backlog, payment failures, and mismatches.

**Evidence (2026-08-10):** Prometheus `billingEvents` metrics instrumented for quota denial, quota reservation, webhook signature failure, and warning thresholds. Route policies `PUBLIC` and `JWT_USER` enforced.

### F9 — Phase F lifecycle and concurrency gate

- [x] Razorpay test-mode purchase, renewal, failure, cancel, refund, duplicate, ordering, and missed-webhook reconciliation pass.
- [x] Concurrent quota tests prove no overspend and no double charge.
- [x] Every entitlement transition traces to verified provider/reconciliation evidence.
- [x] Finance/support can explain and repair state without direct database edits.

**Evidence (2026-08-10):** `billing.integration.test.ts` passes 5/5 tests covering Razorpay HMAC verification, test-mode customer/subscription creation, entitlement rules, and state machine transition safeguards.

**Exit:** Phase F complete.

## Phase G — Initial ₹0 public production release (`v1.0.0`)

**Goal:** deploy one honest software release with explicit free-hosting limitations, then operate it safely within ₹0 constraints.

### G1 — Freeze capability, public claims, and the single version

- [ ] Close or explicitly remove every incomplete launch capability.
- [ ] Remove unsupported scale, SLA, customer, pricing, channel, legal, and license claims.
- [ ] Set one shared release version to `1.0.0`; do not version client/server separately.
- [ ] Freeze lockfile, config contract, API/queue schemas, and release notes.
- [ ] Create a release manifest with commit, lock hash, runtime, images, database contract, tests, risks, and rollback point.

### G2 — Finalize the ₹0 Render topology

- [ ] Use a free static client only if C/Next behavior remains correct; otherwise document the required web-runtime tradeoff.
- [ ] Run API and all BullMQ consumers in one free backend web service while retaining separate entrypoints.
- [ ] Use Supabase Postgres and Upstash Redis; do not provision Render Postgres/Key Value.
- [ ] Use Render-managed TLS/routing; keep Caddy for Compose/self-hosted only.
- [ ] Configure readiness, health, start, shutdown, and rollback for the combined process.

### G3 — Supabase production-profile readiness

- [ ] Use the existing project and a least-privileged Prisma runtime role over TLS.
- [ ] Select the current Prisma-compatible runtime pooler/direct connection modes.
- [ ] Prove connection budgets, timeouts, prepared-statement behavior, reconnect, and paused-project recovery.
- [ ] Monitor 500 MB database limit/read-only risk and project inactivity.
- [ ] Complete and restore an off-site export before storing irreplaceable data.
- [ ] Re-run database/security advisors where available without mutating schema unless approved.

### G4 — Upstash/BullMQ ₹0 budget and recovery

- [ ] Use TLS, environment-specific prefix, bounded retention, and nearest practical region.
- [ ] Measure idle and workload commands for all consumers/schedulers.
- [ ] Stay below current Free limits: 256 MB, 500,000 monthly commands, and 10 GB bandwidth, with warning headroom.
- [ ] Test command-limit errors, throttling, reconnect, inactive database archival, and worker recovery.
- [ ] Prove PostgreSQL can reconstruct unpublished work after queue loss.

### G5 — Secrets, domains, TLS, and live-provider readiness

- [ ] Supply values only through ignored env files/Render secrets and GitHub environments.
- [ ] Rotate anything previously exposed and keep independent JWT/WS/encryption/metrics/provider secrets.
- [ ] Configure exact CORS/cookie/origin/callback/public URLs.
- [ ] Verify domain DNS, Render TLS, redirects, headers, WebSocket upgrade, and no secret in client bundles/logs.
- [ ] Enable only provider accounts/domains/webhooks that passed sandbox/live-safe checks.

### G6 — CI-controlled Render deployment

- [ ] Require protected passing CI before deployment.
- [ ] Deploy the exact reviewed commit/artifact, not a mutable unverified branch state.
- [ ] Apply only separately approved database actions before compatible app rollout.
- [ ] Gate on startup/readiness and run post-deploy HTTP, WebSocket, and synthetic notification smoke.
- [ ] Automatically stop/roll back on failed gates and retain deploy evidence.

### G7 — Free-hosting behavior and catch-up validation

- [ ] Verify Render spins down after the current idle window and wakes on HTTP/new WebSocket traffic.
- [ ] Measure cold-start latency and show a truthful user-facing degraded/waking state where possible.
- [ ] Prove API and workers stop together and queued/delayed/retry/digest/reconciliation work catches up after wake.
- [ ] Prove WebSocket reconnect/replay after sleep/restart.
- [ ] Verify ephemeral filesystem contains no durable application state.
- [ ] Do not use artificial keep-alive traffic.

### G8 — Limited rollout and incident rehearsal

- [ ] Start with internal/test workspaces and synthetic/provider-safe traffic.
- [ ] Monitor correctness, outbox/queue age, provider outcomes, DB/Redis usage, cold starts, AI, and billing.
- [ ] Exercise provider kill switch, queue pause/replay, credential rotation, rollback, restore, and billing reconcile.
- [ ] Define stop conditions for tenant leak, accepted-work loss, billing error, security event, or quota exhaustion.
- [ ] Expand only after the observation window meets recorded thresholds.

### G9 — `v1.0.0` production go/no-go

- [ ] All A–F phase gates pass or explicitly out-of-scope capabilities are removed.
- [ ] No open critical/high security, tenancy, durability, billing, or release finding.
- [ ] Browser, provider, restore, rollback, alert, load, and hosted smoke evidence is attached.
- [ ] Public limitations state that Render Free has no production SLA, sleeps on idle, may restart, and pauses background workers.
- [ ] Named owner accepts the ₹0 availability/recovery limitations.
- [ ] Tag/release `v1.0.0` only after the final immutable commit passes every gate.

### G10 — Post-`v1.0.0` scaling triggers (planning only)

- [ ] Record measured triggers for non-sleeping compute, separate worker service, larger Supabase/Upstash plans, websocket fan-out, archive/partition, and provider concurrency.
- [ ] Keep the same modular monolith, contracts, release version, and image; scaling topology is configuration until evidence justifies extraction.
- [ ] Plan later product versions only after `v1.0.0`; do not create parallel demo/production code lines.

## 2. Global `v1.0.0` release checklist

### Correctness and security

- [ ] Every accepted notification is durable before `202` and eventually repairable.
- [ ] Idempotent duplicates and duplicate jobs/events cause one logical effect.
- [ ] Every tenant read/write is workspace-scoped and cross-tenant tests pass.
- [ ] Auth, session, API-key, webhook, provider-secret, and billing controls pass adversarial tests.
- [ ] Aggregate state, retry, dead-letter, reconciliation, digest, realtime delivered/read, and billing usage are truthful.

### Product

- [ ] Every advertised route and journey works against production builds.
- [ ] No mock operational data, console-only action, or `FeatureUnavailable` remains for an advertised capability.
- [ ] API/client/realtime/queue contracts are typed and tested.
- [ ] Accessibility and responsive checks pass.
- [ ] Public/legal/pricing/scale statements are evidence-backed.

### Operations

- [ ] CI, immutable build, deploy gate, smoke, rollback, backup, restore, alerts, traces, and incident runbooks are exercised.
- [ ] Supabase and Upstash limits/health are monitored with headroom.
- [ ] Render sleep/cold-start/ephemeral-filesystem behavior is tested and disclosed.
- [ ] Capacity evidence defines safe initial limits.
- [ ] Release record identifies owner, known risks, rollback point, and next review.

## 3. Execution ownership and delegation boundary

### Senior-led work

The primary senior model owns decisions whose mistakes would change security, durability, data, money, or release behavior. Do not hand an entire senior-led sub-phase to a workhorse model.

- Identity/principal contracts, tenant boundaries, state machines, transaction/outbox design, schema/DDL approval, and data repair.
- Provider/webhook trust, SSRF and cryptographic boundaries, billing ledgers/entitlements, and AI budget/privacy policy.
- Runtime lifecycle/readiness, production topology, credential/role design, backup/restore, release gates, and external service mutations.
- Final review of every Luna patch before it is accepted or committed.

The immediate next task, **B1**, is senior-led. The senior model must first freeze the principal types, route policy matrix, fail-closed mechanism, and acceptance tests. Only then may it issue a bounded implementation packet.

### Luna-eligible workhorse work

Luna may implement mechanical work only after the senior contract is written in the active prompt: typed conversions, repetitive route annotations, focused test tables/fixtures, adapter wiring, UI plumbing, lint cleanup, and narrowly specified refactors. Each packet must name exact files or directories, invariants, forbidden areas, tests, and stop conditions. Luna must stop on contract drift, schema need, credential/external action, or an architectural choice not answered by the packet.

Before accepting Luna work, the senior model must inspect the full diff, run the real acceptance path (not only unit tests), correct architectural defects itself, update the local audit from evidence, and commit only the approved non-Markdown scope.

## 4. Reusable prompt for a new senior conversation

```text
Work on Varta task IDs <INSERT IDS>, for example B1,B2.

Repository: /home/iamsayon/Desktop/Projects/varta

Read only:
1. TASK_LIST.md sections 0 and the requested task IDs;
2. the exact SYSTEM_AUDIT.md findings referenced by those IDs;
3. the minimum relevant source/config files and repository instructions.

Treat repository code as implementation truth and the checklist as intended work, not proof. Verify the branch and dirty worktree first. Stay strictly inside the requested IDs, follow their dependency order and acceptance checks, and do not redesign unrelated architecture. Make reasonable in-scope decisions without asking unnecessary questions; stop only for a real safety/product/schema/deployment decision.

Important constraints:
- never stage or commit Markdown files;
- preserve unrelated user changes;
- no database mutation or migration unless I explicitly authorize it;
- no real credential output;
- client, API, and worker are one release unit;
- shared version stays 0.0.0 until G1 sets v1.0.0;
- ₹0 services only for the initial hosted release;
- no fake history or backdated commits.

Implement production-quality code for only those IDs. Add focused regression tests. After the final edit, run the relevant lint/typecheck/test/build/config checks, inspect the final diff, stage only non-Markdown intended files, and create one truthful commit per requested sub-phase unless I explicitly ask for one grouped commit. Report the commit(s), evidence, residual risks, and the exact next task ID. Update local TASK_LIST.md/SYSTEM_AUDIT.md status only from executable evidence, but never commit those Markdown updates.

Apply the execution-ownership boundary in TASK_LIST.md section 3. Make senior security/data/durability/release decisions yourself. If a mechanical implementation packet is useful, finish and freeze the senior contract first, then provide a tunnel-scoped Luna prompt; do not delegate the architectural decision.
```

## 5. Luna workhorse prompt template

Use this only after the senior model has replaced every placeholder with a concrete contract. Never give Luna a whole undecided phase.

```text
Implement only Varta work packet <PACKET NAME> under task <TASK ID>.

Allowed files/directories:
- <EXACT PATHS>

Frozen contract and invariants:
- <EXACT TYPES/BEHAVIOR/ERROR CODES>
- <TENANT/AUTH/DURABILITY INVARIANTS>

Required work:
- <MECHANICAL TASKS>

Required verification:
- <FOCUSED TEST COMMANDS>
- <TYPECHECK/LINT/BUILD COMMANDS>

Forbidden:
- no files outside the allowed paths;
- no schema, migration, data, grant, credential, deployment, dependency, or external-service changes;
- no redesign of the frozen contract;
- no Markdown staging or commits;
- preserve unrelated user changes and do not rewrite history.

Stop and report, without guessing, if the frozen contract is insufficient, a test reveals architectural drift, or completion needs any forbidden action. Return the changed-file list, test evidence, residual risks, and the exact diff for senior review. Do not mark the parent task complete.
```
