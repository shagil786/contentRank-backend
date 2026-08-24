# OUTRANK — Technical Gaps

A comprehensive inventory of every known technical gap in the OUTRANK project.
Each item is described with: **what's missing today**, **why it matters**, and
**the concrete next step to close it**. Items are grouped by category and ordered
roughly by production-readiness priority within each group.

The codebase today is a working prototype: real layered backend (API → application →
domain → repositories → Prisma), realtime engine, and editorial frontend. The gaps
below are what stand between "working prototype" and "production marketplace".

---

## 1. Infrastructure

### 1.1 SQLite instead of PostgreSQL — resolved locally 2026-08-24
- **Resolved**: Prisma now uses PostgreSQL, with a reproducible Docker setup in `compose.yaml`, a local Postgres instance on port 5433, and the app services running against it.
- **Migration note**: production still requires a managed Postgres provider and secret-managed `DATABASE_URL`; the local container is the development/staging baseline.

### 1.2 Shared Redis for rate limits/idempotency and Socket.IO — partially resolved 2026-08-24
- **Resolved**: `src/server/infrastructure/rate-limiter.ts` and `idempotency.ts` now use Redis when `REDIS_URL` is configured, with an in-process fallback for local resilience. The realtime engine also uses `@socket.io/redis-adapter` for cross-instance event broadcast. The local Docker baseline is defined in `compose.yaml`.
- **Remaining**: the realtime engine's canonical entity state, presence, and activity still use in-process `Map`s. Each realtime replica would therefore still maintain its own board state and watcher counts.
- **Why it matters**: rate limits and idempotent retries are now shared across Next.js
  workers, but presence and "watching now" counts remain per-process undercounts and
  realtime replicas can still diverge on entity mutations.
- **Next step**: move canonical realtime entities, presence, and activity into Redis
  (or another shared authoritative store), then add replica-safe simulator/worker
  ownership and reconciliation.

### 1.3 Same-origin image proxy and caching — partially resolved 2026-08-24
- **Resolved**: remote `og:image` URLs now flow through `/api/image`, which validates
  the target scheme/host, enforces image content type and a 5 MB limit, and returns
  cache headers for same-origin reuse. `Poster.tsx` still falls back to its deterministic
  SVG poster if the proxy fails.
- **Remaining**: images are not yet copied into durable object storage or served by a
  dedicated production CDN.
- **Why it matters**: hot-linking remote images still couples the first proxy fetch to
  the source site's CDN, while replicas do not share a durable image asset.
- **Next step**: fetch and store approved images in object storage (S3/R2 or equivalent)
  at submit time, then serve immutable resized variants through a production CDN.

### 1.4 Horizontal scaling and realtime ownership — partially resolved 2026-08-24
- **Resolved**: Socket.IO broadcast uses the Redis adapter, and synthetic realtime
  traffic now uses a short Redis leader lease so multiple replicas do not all run the
  simulator. The realtime REST service exposes `/health` with instance and adapter
  status for load-balancer checks.
- **Remaining**: `mini-services/outrank-realtime` still keeps entity mutations,
  presence, activity, and boost history in process-local memory. Replicas therefore
  still need shared canonical state and sticky/session-aware routing before production
  horizontal scaling.
- **Why it matters**: the realtime engine is still the canonical source of the live
  board. Without shared mutable state, a load balancer can route clients to replicas
  with divergent scores, presence, and activity.
- **Next step**: externalize entities, presence, activity, and boost history to Redis
  or PostgreSQL-backed commands, then deploy replicas behind a sticky-session load
  balancer (Caddy `lb_policy ip_hash` or a dedicated LB).

---

## 2. Data & Persistence

### 2.1 Time-decay on scores — resolved 2026-08-24
- **Resolved**: the realtime engine tracks timestamped boosts, applies a 24-hour full-weight window, linearly decays backing to a 50% residual over seven days, and reranks every 30 seconds.
- **Follow-up**: durable decay/audit columns on `OrganicRanking` remain a future persistence enhancement.

### 2.2 Cursor pagination on leaderboard — partially resolved 2026-08-24
- **Resolved**: `/api/leaderboard` and the realtime `/state` endpoint now accept
  bounded `limit` (maximum 48) and numeric `cursor` parameters, return `nextCursor`
  and `total`, and paginate before loading per-entity ranking history. The frontend
  requests only its visible 48-row page by default.
- **Remaining**: the repository still reads and sorts all live content before slicing;
  a database-level keyset query is needed when the board becomes very large.
- **Why it matters**: the client payload and history hydration are now bounded, but
  the server still pays the full list/sort cost for each request.
- **Next step**: add a stable `(score, createdAt, id)` keyset query in PostgreSQL and
  build an infinite-scroll/load-more UI around `nextCursor`.

### 2.3 No data migration strategy — resolved 2026-08-24
- **Resolved**: PostgreSQL is now managed through the checked-in `prisma/migrations/20260823234548_init/migration.sql` baseline. Deployments should use `prisma migrate deploy`; `db push` is no longer the production path.
- **Why it matters**: the moment there's real user data (emails, claims, payments),
  `db push` becomes dangerous — it can silently drop columns. Production deploys
  need forward-only migrations with review, rollback, and a changelog.
- **Next step**: add migration review and `prisma migrate deploy` to the production release pipeline.

### 2.4 Backup/restore process — partially resolved 2026-08-24
- **Resolved**: `bin/backup-postgres.sh` creates a timestamped PostgreSQL custom-format
  dump, SHA-256 checksum, and manifest. `bin/restore-postgres.sh` verifies the checksum
  when present and requires `CONFIRM_RESTORE=YES` before the destructive restore.
- **Remaining**: production still needs managed daily snapshots, point-in-time recovery,
  offsite retention, and a scheduled staging restore drill.
- **Why it matters**: accidental deletion or a bad migration must not lose submitted
  entities, boosts, payment records, or audit history.
- **Next step**: connect the backup script to encrypted object storage or managed
  PostgreSQL backups and rehearse the restore procedure quarterly in staging.

---

## 3. Security

### 3.1 Authentication — intentionally deferred
- **Decision**: OUTRANK remains an anonymous attention-market experience for the current
  project scope. The existing lightweight PostgreSQL session identifies a browser session
  for rate limiting and audit attribution; no frontend login or backend auth provider is
  required.
- **Why this is acceptable now**: browsing, boosting, content submission, realtime
  participation, and email subscriptions do not require persistent user identity.
- **Future trigger**: revisit authentication only if the product adds verified ownership,
  saved user history, account administration, or payment ownership that must survive
  across devices.

### 3.2 Anti-sybil protection — partially resolved 2026-08-24
- **Resolved**: all abuse-sensitive API limits now key by client IP in the Redis-backed
  token bucket, with anonymous session IDs retained only as a fallback when no network
  address is available. Rotating anonymous sessions therefore does not bypass the
  normal write limits.
- **Remaining**: IP rotation, botnets, and automated paid activity are not fully
  addressed. The product intentionally does not impose a daily HYPE allowance or
  require login/CAPTCHA at this stage.
- **Why it matters**: the leaderboard is the product, so manufactured activity can
  reduce trust even when request-rate limits are working.
- **Next step**: add graduated bot detection and payment-risk controls if abuse appears
  in real traffic; only introduce CAPTCHA or identity-based quotas when the product
  requires that tradeoff.

### 3.3 Webhook HMAC verification — resolved 2026-08-24
- **Resolved**: `src/server/adapters/payments/dodo.ts` computes HMAC-SHA256 over the
  raw body, supports hex/base64 signatures and an optional `sha256=` prefix, compares
  with `timingSafeEqual`, and rejects missing or invalid secrets/signatures. The route
  returns `401` for signature failures and `503` when the server secret is not configured.
- **Operational requirement**: `DODO_WEBHOOK_SECRET` must be supplied through secret
  management in every deployed environment; it is never committed to source.

### 3.4 Same-origin CSRF checks — partially resolved 2026-08-24
- **Resolved**: `prepareApiContext` rejects mutating API requests with a mismatched
  `Origin` or `Referer` using HTTP 403. Requests with no browser navigation header
  remain valid for the realtime and worker server-to-server calls. The current product
  has no authenticated cookies, so this is the appropriate lightweight boundary.
- **Remaining**: if cookie-based authentication is introduced later, add secure
  `SameSite` cookies and a token-based CSRF defense for sensitive actions.
- **Why it matters**: a malicious site should not be able to use a visitor's browser
  context to submit API mutations to OUTRANK.

### 3.5 Plain-text input/XSS hardening — partially resolved 2026-08-24
- **Resolved**: the source audit found no user-controlled `dangerouslySetInnerHTML`;
  React escapes rendered text, generated poster SVG text is not injected as markup,
  and external links are scheme-validated. Persisted titles, blurbs, claim names, and
  moderation reasons now remove control characters and enforce length bounds through
  `plainText` normalization.
- **Remaining**: a production CSP and a dedicated rich-text sanitizer remain future
  work if the product ever accepts HTML/Markdown content.
- **Why it matters**: defense-in-depth prevents control-character payloads from
  reaching attributes, logs, or downstream renderers while keeping content plain text.
- **Next step**: add CSP headers and a vetted sanitizer only when rich text is introduced.

### 3.6 IP rate limiting on content submission — resolved 2026-08-24
- **Resolved**: `/api/content` uses the Redis-backed `submit` token bucket (10/min),
  and `prepareApiContext` keys it by client IP before falling back to an anonymous
  session only when no address is available. The same boundary protects claim and
  subscription routes with their tighter presets.
- **Follow-up**: adjust capacities or add graduated bot detection from observed traffic;
  this is complementary to the broader anti-sybil controls in 3.2.

---

## 4. Real Platform Integrations

### 4.1 OpenGraph fetcher is the only real integration
- **Today**: `src/lib/outrank/og.ts` fetches the submitted URL, parses `<meta>` tags,
  and extracts `og:title` / `og:image` / `og:description`. This works for any URL
  but only returns what the source site chooses to expose — no engagement metrics,
  no real view counts, no follower counts.
- **Why it matters**: the leaderboard's metric layer (`Metric` model in Prisma) is
  designed to hold real platform engagement data (views, likes, comments, shares).
  Without real API integrations, every `Metric` row is a stub and the ranking is
  purely boost-driven (no signal from actual platform traction).

### 4.2 YouTube Data API — partially resolved 2026-08-24
- **Resolved**: the registered YouTube adapter optionally calls the official
  `videos.list` endpoint with `part=statistics` and maps public view, like, and comment
  counts into the existing metric contract. Missing credentials, channel keys, API
  failures, and timeouts safely return no metric.
- **Remaining**: configure `YOUTUBE_API_KEY` in deployment secrets and add shared
  caching/quota accounting before enabling broad refreshes.
- **Why it matters**: YouTube is a major content source; official metrics provide a
  real engagement signal beyond OpenGraph metadata.
- **Next step**: add Redis metric caching and quota-aware scheduling, then cover
  Instagram/TikTok only when their official access requirements are satisfied.

### 4.3 Instagram Graph API
- **Today**: `src/server/adapters/platforms/instagram.ts` parses URLs (post, reel,
  profile) but doesn't call the Graph API.
- **Why it matters**: Instagram content has real like/comment counts that would
  feed the ranking.
- **Next step**: requires a Facebook app + business account verification (Instagram
  Graph API is gated). Implement `fetchMetrics` calling `/{media-id}?fields=like_count,comments_count`.
  Higher friction than YouTube — defer until the platform mix justifies it.

### 4.4 TikTok Research API
- **Today**: `src/server/adapters/platforms/tiktok.ts` parses URLs only.
- **Why it matters**: TikTok is a top-3 platform for the target audience but
  their API is the most restrictive.
- **Next step**: apply for TikTok Research API access (requires academic /
  registered research org status). Until then, no real metrics from TikTok —
  acceptable for prototype, blocking for production.

### 4.5 Spotify Web API
- **Today**: no Spotify adapter exists in `src/server/adapters/platforms/`.
- **Why it matters**: songs/albums are a content kind in the schema and a category
  in the UI, but Spotify URIs can't be parsed for real play counts.
- **Next step**: add `src/server/adapters/platforms/spotify.ts`, register a Spotify
  client (Client Credentials flow — no user context needed for public track data),
  implement `fetchMetrics` calling `https://api.spotify.com/v1/tracks/{id}` for
  popularity score. Register the adapter in `src/server/adapters/platforms/index.ts`.

### 4.6 Steam Web API
- **Today**: no Steam adapter exists.
- **Why it matters**: `game` is a content kind and `games` is a category, but Steam
  games have no real concurrent-player or review data feeding the rank.
- **Next step**: add `src/server/adapters/platforms/steam.ts`, register a Steam
  Web API key, implement `fetchMetrics` calling
  `ISteamUserStats/GetNumberOfCurrentPlayers` and `appreviews/get` for review
  sentiment. Register the adapter.

### 4.7 TMDB API (for movies/TV)
- **Today**: no TMDB adapter exists. Movies and TV are submitted via Letterboxd /
  IMDB URLs and ranked purely by boosts.
- **Why it matters**: `movies` and `tv` are categories, and TMDB exposes real
  vote counts, popularity scores, and release dates that would make the rankings
  more authoritative.
- **Next step**: add `src/server/adapters/platforms/tmdb.ts`, register a TMDB API
  key, implement `fetchMetrics` calling `/movie/{id}` and `/tv/{id}` for
  `vote_count` / `popularity`. Register the adapter.

### 4.8 Metric refresh worker — partially resolved 2026-08-24
- **Resolved**: the scheduled worker now looks up each registered adapter, calls its
  optional `fetchMetrics`, writes successful results to `Metric`, and isolates failures
  per content so one provider cannot abort the batch. It reports updated, skipped, and
  failed counts. The five-item batch remains a quota-safe prototype guard.
- **Remaining**: rotate through all content instead of always selecting the first five,
  add per-platform Redis quota/rate limiting, and persist `lastFetchedAt` for durable
  scheduling across worker restarts.
- **Next step**: add a metric-refresh cursor and Redis quota budget, then increase the
  batch only for providers with configured official credentials.

---

## 5. Payment

### 5.1 Dodo checkout — test configuration partially complete (2026-08-24)
- **Resolved**: Dodo Test Mode now has an `OUTRANK Boost` one-time product at
  `$1 USD` with product ID `pdt_0Nm5MbuqCwASLh6uyy6GO`.
- **Resolved**: the adapter now calls Dodo's hosted `/checkouts` API with the
  configured product, variable bid amount, idempotency key, return/cancel URLs,
  and internal metadata, then persists the provider payment/session ID.
- **Still open**: the generated Test Mode API key must be copied by the user into
  the runtime secret environment; `.env` was intentionally not changed. A full
  sandbox payment plus webhook round trip remains to be verified before live use.

### 5.2 Idempotency on bid creation — resolved 2026-08-24
- **Resolved**: `/api/bids/checkout` now caches retries with `withIdempotency`, passes the caller's `Idempotency-Key` into the application service, and checks the unique `SponsoredBid.idempotencyKey` in the database before creating a new bid.
- **Verification**: the database-backed lookup protects retries across separate application workers; the in-process in-flight map protects concurrent duplicate requests within one worker.

### 5.3 No refund flow
- **Today**: `Payment.status` has `refunded` in the enum but there's no API route,
  no worker job, and no admin UI to initiate a refund. `confirm-payment.ts` only
  handles the `succeeded` webhook event.
- **Why it matters**: real payments get disputed, fail, or need customer-service
  refunds. Without a flow, every refund is a manual DB edit and a manual Dodo
  dashboard action — error-prone and unaudited.
- **Next step**: add a `POST /api/bids/:id/refund` admin-only route that calls a
  new `refundPayment` method on the `PaymentProvider` interface, marks the
  `Payment.status = "refunded"`, marks the linked `SponsoredBid.status =
  "refunded"`, writes an `AuditLog` entry, and emits a realtime event to update
  the board. Requires 3.1 (auth) for the admin gate.

### 5.4 No payment dispute handling
- **Today**: no code path handles Dodo `payment.dispute.created` or
  `payment.chargeback` webhook events. They'd land in the webhook handler and be
  silently ignored (the `verifyWebhook` → event dedup → settlement pipeline
  doesn't recognize dispute events).
- **Why it matters**: disputes are a normal cost of operating a payment-enabled
  marketplace. Unhandled disputes mean we don't pull the bid off the board, don't
  flag the account, and don't trigger a manual review.
- **Next step**: extend the webhook handler to recognize dispute events, mark the
  linked `SponsoredBid` as `disputed`, hide the entity from the sponsored slot,
  write an `AuditLog` entry, and fire an alert (see 8.3 Sentry / 8.2 monitoring).

---

## 6. Realtime

### 6.1 Socket.io single instance (no Redis adapter)
- **Today**: `mini-services/outrank-realtime/index.ts` creates a single socket.io
  server with the default in-memory adapter. There's no `@socket.io/redis-adapter`
  and no pub/sub bus.
- **Why it matters**: with N realtime replicas (1.4), a boost event emitted on
  replica A doesn't reach clients connected to replica B. The board desyncs
  between users.
- **Next step**: install `@socket.io/redis-adapter` + `redis`, call
  `io.adapter(createAdapter(pubClient, subClient))`. Already-compatible with the
  existing event payload shapes — no client change required.

### 6.2 Reconnection state sync — partially resolved 2026-08-24
- **Resolved**: the client tracks the latest event timestamp and requests `state.sync`
  with `{ since }` after every socket connection. The realtime service responds with
  an authoritative bounded snapshot plus activity events observed after that watermark.
- **Remaining**: rank deltas are not yet replayed individually; the snapshot is the
  consistency boundary. Durable event history in PostgreSQL/Redis is needed for exact
  replay across long disconnects.
- **Why it matters**: reconnecting users now converge to current ranks and recent
  activity instead of depending only on live events that occurred while offline.
- **Next step**: persist rank-event history and replay compact deltas for long gaps.

### 6.3 Realtime boost backpressure — partially resolved 2026-08-24
- **Resolved**: rank updates are coalesced per entity into a 100 ms broadcast window.
  The first previous rank/score and latest rank/score are preserved, while boost
  acknowledgements remain immediate for the source socket.
- **Remaining**: activity events are still emitted individually, and client rendering
  is not explicitly frame-debounced.
- **Why it matters**: high-velocity boosts should not force every connected client to
  process one rank event per boost.
- **Next step**: batch activity events and debounce visible leaderboard updates to one
  animation frame under sustained bursts.

---

## 7. Frontend

### 7.1 Leaderboard virtualization — deferred with bounded pages
- **Current mitigation**: the API, realtime state, and `Leaderboard.tsx` all cap a
  client page at 48 entities; the component renders rows 4–48 only. The DOM therefore
  cannot grow to hundreds of rows under the current product flow.
- **Why this is deferred**: virtualization becomes worthwhile when `nextCursor` is
  connected to a load-more UI and pages can accumulate beyond the current 48-row view.
- **Next step**: add `@tanstack/react-virtual` when the frontend supports multi-page
  browsing, preserving the animated top-three treatment.

### 7.2 SSR leaderboard data — partially resolved (2026-08-24)
- **Resolved**: `src/app/page.tsx` is now a dynamic server component. It fetches
  the first 48 leaderboard entities server-side and passes the result to
  `src/app/HomeClient.tsx` as TanStack Query `initialData`.
- **Resolved**: the initial HTML contains real leaderboard content rather than
  only the loading skeleton. A live `curl /` smoke check returned HTTP 200 and
  found a seeded entity name in the HTML.
- **Still open**: the interactive client shell still hydrates in the browser,
  TanStack Query may refetch after hydration, and per-entity
  `generateMetadata`/OG tags for `?e=<slug>` are not implemented yet.

### 7.3 PWA / offline support — partially resolved (2026-08-24)
- **Resolved**: added `public/manifest.webmanifest` with OUTRANK branding,
  standalone display mode, theme color, and install icon.
- **Resolved**: added a small production-only service worker in `public/sw.js`.
  It uses network-first behavior for navigation and `/api/leaderboard`, then
  falls back to the cached shell or last-known leaderboard response offline.
- **Resolved**: `PwaRegister` registers the worker without affecting local
  development or normal app behavior when service workers are unavailable.
- **Still open**: offline mutations are intentionally not queued, and the
  service worker should receive a broader device/browser compatibility test
  before being treated as a production offline guarantee.

### 7.4 Accessibility — partially resolved (2026-08-24)
- **Resolved**: leaderboard rows and the top-three cards can now receive focus
  and open details with Enter or Space, with visible focus outlines and labels
  identifying the entity and rank.
- **Resolved**: category and timeframe controls expose their selected state via
  `aria-pressed`; live activity feeds expose polite live regions.
- **Still open**: run axe-core in CI, complete a contrast audit for muted
  typography, add arrow-key movement if the leaderboard becomes a roving-focus
  interaction, and verify nested row controls with a screen reader.

### 7.5 Error boundaries — partially resolved (2026-08-24)
- **Resolved**: `ErrorBoundary` isolates the leaderboard section and offers a
  branded retry without unmounting the rest of the page.
- **Resolved**: `src/app/error.tsx` catches route-level render errors and offers
  both Next.js segment recovery and a full page reload.
- **Still open**: modal-level boundaries can be added if modal components become
  independently shipped features; the route-level fallback remains the final
  safety net for those dialogs.

---

## 8. Observability

### 8.1 Structured logging — partially resolved (2026-08-24)
- **Resolved**: `src/server/infrastructure/logger.ts` emits JSON log entries with
  timestamp, level, service, event, request ID, method, path, status, session ID,
  and duration when responses use the shared `jsonResponse` helper.
- **Resolved**: CSRF and rate-limit rejections are emitted as structured warning
  events, and audit write failures now carry their request ID.
- **Still open**: direct `NextResponse.json` routes need to migrate to the shared
  response helper for complete end-to-end request coverage; worker/realtime logs
  should adopt the same logger contract later.

### 8.2 Metrics/monitoring — partially resolved (2026-08-24)
- **Resolved**: `/metrics` now exposes Prometheus-compatible request counters,
  duration buckets, request count, and process uptime without adding a runtime
  dependency.
- **Resolved**: completed requests using `jsonResponse` are recorded by route
  and status through the structured logging lifecycle.
- **Still open**: direct response routes, realtime/worker gauges, and a hosted
  Prometheus/Grafana or Datadog deployment are not configured yet.

### 8.3 Error tracking — partially resolved (2026-08-24)
- **Resolved**: server failures can now use a central `captureServerError`
  seam that emits structured error events with safe error details and request
  context, without logging request bodies or credentials.
- **Resolved**: leaderboard fallback failures are captured with their request ID
  before returning the stale/empty fallback response.
- **Still open**: an external Sentry transport, DSN configuration, source-map
  upload, and client-side breadcrumbs remain deployment work.

### 8.4 Request tracing — partially resolved (2026-08-24)
- **Resolved**: API requests now accept or generate a validated trace ID,
  propagate it through `RequestContext`, include it in structured request logs,
  and return it as `X-Trace-Id` on shared API responses.
- **Resolved**: request IDs and trace IDs remain separate, allowing one trace to
  contain multiple request attempts while preserving idempotency correlation.
- **Still open**: full OpenTelemetry spans for Prisma, application services,
  realtime broadcasts, and an external trace collector are deployment work.

---

## 9. Product

### 9.1 No user accounts / identity persistence
- **Today**: every visitor is an anonymous session. Their boosts, claims,
  subscriptions, and payment history are tied to a session cookie that's lost
  the moment they clear cookies or switch devices.
- **Why it matters**: returning users have no continuity. "I boosted that last
  week" is unrecoverable. Claimed entities can't be re-verified by the same
  person on a new device.
- **Next step**: see 3.1 — Auth.js with email magic-link. Anonymous sessions
  upgrade to verified users on first auth, with all prior data migrated.

### 9.2 Notification system — partially resolved (2026-08-24)
- **Resolved**: `POST /api/subscribe` validates and durably persists global or
  entity-scoped subscriptions in PostgreSQL, deduplicated by `scopeKey`.
- **Resolved**: subscriptions now receive hashed confirmation and unsubscribe
  tokens, with `/api/subscribe/confirm` and `/api/subscribe/unsubscribe`
  endpoints. Tokens are never stored in plaintext.
- **Resolved**: the Resend REST adapter sends confirmation email when
  `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured; local environments
  remain safe and explicit when delivery is not configured.
- **Resolved**: the worker now checks confirmed subscriptions every two minutes,
  compares watched ranks against stored notification state, sends movement
  emails through Resend, and advances state only after a successful send.
- **Still open**: production delivery requires a verified Resend sender and a
  long-running worker deployment; global subscriptions currently track the
  board leader while entity subscriptions track their selected entity.

### 9.3 Entity editing — partially resolved (2026-08-24)
- **Resolved**: `PATCH /api/content/:id` validates title, blurb, and link edits,
  restricts them to the original anonymous submitter session within 24 hours,
  and rejects edits after that window.
- **Resolved**: edits are persisted through the repository boundary and audited
  with changed fields plus before/after values; the existing edit dialog is wired
  to the endpoint and refreshes the board after success.
- **Still open**: realtime `entity.updated` broadcast, a moderation/admin edit
  path, and editing category/kind/image metadata remain deferred.

### 9.4 Moderation queue UI — deferred by scope
- **Current state**: anonymous users can submit reports through
  `/api/moderation`; the worker auto-resolves stale reports. There is no human
  moderation UI.
- **Reason for deferral**: moderation actions require authenticated admin
  identity and authorization, which is intentionally out of scope after the
  decision to remove login.
- **Next step**: revisit alongside an admin identity system; do not expose the
  queue or destructive actions publicly.

### 9.5 Admin dashboard — deferred by scope
- **Current state**: there is no admin surface; operational inspection uses
  protected server/database tooling.
- **Reason for deferral**: an admin dashboard without authentication and role
  checks would create a public destructive control plane.
- **Next step**: revisit only if admin identity, authorization, and audit policy
  are brought back into project scope.

---

## Priority Order (suggested)

If tackling these in sequence, this order minimizes risk per unit of effort:

1. **3.3 Webhook signature verification** — direct money loss, small fix.
2. **5.2 Idempotency on bid creation** — direct money loss, tiny fix.
3. **1.1 SQLite → PostgreSQL** — unblocks everything else at scale.
4. **1.2 In-memory → Redis** — unblocks 1.4, 6.1, and removes the rate-limit
   bypass.
5. **3.4 CSRF + 3.6 IP rate limiting** — cheap, closes obvious abuse vectors.
6. **5.1 Real Dodo payment** — the revenue path.
7. **3.1 Authentication** — unblocks 5.3, 5.4, 9.1, 9.4, 9.5.
8. **2.1 Time-decay on scores** — without this, the product has no retention.
9. **4.2–4.8 Real platform integrations + worker** — makes the board real.
10. **8.1–8.3 Logging + metrics + Sentry** — operate before you scale.
11. **2.2 Cursor pagination + 7.1 Virtualization** — scale the read path.
12. **Everything else** — product polish, observability depth, accessibility.

---

*This document is a snapshot of the project's known gaps as of the current
worklog entry. It should be updated whenever a gap is closed or a new gap is
discovered. Each closed item should be moved to a "Resolved" section at the
bottom with the date and the PR that closed it.*
