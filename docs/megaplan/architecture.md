# Proof-of-Interest Compute — Architecture

Verified against source, post-implementation. Every path, endpoint, storage
key, task type, and license claim below was checked against the checked-out
trees (`localchimera`, `wp-cloud`, `delta-git`). Divergences from the
original megaplan text are marked **[DRIFT]**.

One-line: a **tokenless, three-tier compute network** where a project's
supporters donate compute — page scripts run workload-parallel small-model
jobs, a store-compliant extension graduates supporters to persistent
shard-holding nodes, and Chimera desktop/qvac daemons form the
weight-sharded batch-inference backbone — powering project agents and
serving project content back to visitors. Contributors are paid in
**USDC only** (no project token, no ChimeraToken, no emissions) plus
reputation.

---

## 0. Competitive landscape & surpass strategy

Full field, grouped by what they actually are:

| Class | Players | What they proved | What they lack |
|---|---|---|---|
| Browser/bandwidth | Grass | Residential-fetch demand is real | No compute, install/mercenary funnel |
| Agent/compute | Virtuals, Olas | Agents as treasury consumers | Treasury burn; no community supply |
| Mercenary GPU | Nosana, io.net, Render, Akash, Salad | GPU marketplace works | Install-first, no rep, no loop |
| Swarm inference | Bittensor, Petals, exo, **Parallax** | Sharded inference is feasible | Parallax is closest comp — pipeline-parallel, heterogeneous GPU+MLX, 72B-class, 3.1× latency; Apache-2.0 → **adopt at P6 gate, don't rebuild** |
| Agent nodes | Dria, GaiaNet | Single-binary llama.cpp, OpenAI-compat, USDC — validated the demand pattern | Install-first mercenary supply, no browser tier, no rep, one model/node |
| Extension nodes | Gradient Network (Sentry) | Millions of Chrome-extension installs — the funnel works at scale | Nodes did connectivity "Taps", not compute; mercenary season rewards |
| Orchestration | Chasm (scouts + Scrolls) | Decentralized-MoE routing parallel to our dispatch | Mercenary rewards, no project alignment |
| Training | Gensyn, Prime Intellect | — | Explicit non-goal |
| Edge/DePIN | Fleek (runs on CF Workers itself), AIOZ, Theta, LivePeer, Meson | DePIN can serve | None have supply=demand identity |
| **Integrate, not compete** | Filecoin/Storj/Arweave, Tableland/Kwil, **ERC-8004 registries, x402 payments** | Mature primitives | — |

**Internalized value props**: WEB_FETCH absorbs Grass's residential-fetch
business as a job type; BUILD_VERIFY gives durable nodes a CI/CD workload
no community-compute rival offers; the agent service catalog + x402 turns
pools into revenue engines.

**Five surpass properties no incumbent has**:

a. **Supply = demand are the same people.** Visitors serve the project to
   each other; self-referential infrastructure is immune to price wars.
b. **Graduated-commitment funnel** — script → extension → daemon.
   Gradient proved extension nodes scale to millions but was install-first
   and compute-less; only we offer the zero-install script entry.
c. **Alignment > emission retention.** Supporters stay for the project,
   not the yield; we never need to outbid a mercenary.
d. **Trust architecture** — canaries, juries, trust scores, rep-staked
   validation — makes zero-stake nodes capable of meaningful work.
e. **Compose, don't compete** — Filecoin/Storj storage, Tableland
   metadata, ERC-8004/x402 standards adopted as adapters.

**Non-goals**: raw throughput, interactive latency, training (except the
P8 stretch track), mercenary-node markets, any token.

## 1. Vision & flywheel

**visitor energy → compute → agent work → project advancement → supporter
benefit → more supporters.**

Token projects add a buyback variant: treasury spend recirculates to the
token-aligned community. Every project is a codebase (open or private —
delta-git `visibility` supports both, so commercial projects are in scope)
plus a community, plus optionally a treasury. Agents advance code,
marketing, and trading — and need resources. Website visitors are a
project's most aligned supporters.

## 2. Design principles

- **Consent-first**: nothing computes before a click; the card stays
  visible while running; opt-out persists across visits.
- **Keys never leave agent runtime** — sealed handles, injection only at
  the outbound boundary.
- **Project-scoped pools** — `project:<slug>` namespace.
- **USDC + rep** — no token anywhere.
- **Rep-first bootstrap / zero-treasury mode** — pools function on rep
  rewards alone (the BOINC donation model); USDC is additive, not
  load-bearing. This is what makes the design viable without capital —
  Grass/Bittensor/marketplaces all need funds flowing to bootstrap.
- **Right-tier routing** — taskType decides the tier, not node bidding.
- **Untrusted-results doctrine** — node output is hostile input until
  schema-validated, sandboxed, and (for consequential jobs) juried.
- **Every job is telemetry** — outcomes feed routing, juries, pricing,
  and agent evolution; the network compounds capability.
- **Degrade gracefully** — pool → spillover → Workers AI → fail-closed.

## 3. Component map (verified)

### localchimera — `workers/coordinator/`

One global `CoordinatorDO` (`src/coordinator-do.ts`). Transport:

- **WebSocket** `GET /?token=<VOLUNTEER_TOKEN>` → REGISTER / REGISTERED /
  HEARTBEAT / JOB_DISPATCH / JOB_RESULT / JOB_REJECTED / JOB_POKE.
- **HTTP**: `POST /jobs` (sync result wait), `POST /jobs/batch` (≤50,
  fire-and-forget), `POST /v1/chat/completions` (OpenAI shim →
  AGENT_INFER), `POST /patronage`, `POST /pools/unpause`,
  `POST /admin/tokens` + `DELETE /admin/tokens` (DO-storage project
  tokens), `POST /settle`, `GET /status[?project=]`,
  `GET /earnings?[id|site|project]=`, `GET /results/:id` (admin),
  `GET /metrics` (Prometheus), `GET /badge/:project`, `GET /r/:ref`
  (referral redirect), `GET /rep/:volunteerId`, `GET /audit` (admin).
- **Chain**: `pollChain()` event scan via `src/chain.ts`
  (`BASE_RPC_URLS` failover list).

Auth: `POST /jobs*`, `/v1/chat/completions`, `/patronage` accept the
global `DISPATCH_AUTH_TOKEN`, a `PROJECT_TOKENS` env-map token
(`{"<slug>": "<token>"}`) **[DRIFT: slug→token, not token→slug]**, or a
`dtok:<slug>` entry provisioned at runtime via `/admin/tokens` — project
tokens pin the job to that slug's pool. `/settle`, `/results/*`,
`/pools/unpause`, `/admin/tokens`, `/audit` need `ADMIN_TOKEN`.
`AGENT_DAILY_QUOTA` caps submissions per token-slug/day; `POW_DIFFICULTY`
adds an optional hashcash gate.

Durable storage keys: `handled:<jobId>`, `pending:<jobId>`,
`assigned:<jobId>`, `result:<jobId>`, `seen:<taskType>:<sha256(result)>`,
`ledger:<volunteerId>`, `ledger:site:<site>`, `ledger:project:<project>`,
`ref:<volunteerId>`, `dtok:<slug>`, `paused:project:<slug>`,
`spend:project:<slug>`, `quota:<day>:<slug>`, `canary:<jobId>`,
`group:<id>`, `dispute:<jobId>`, `recip:<a>:<b>`, `trust:<id>`,
`rep:<id>`, `lastBlock`, `schema:v`, `audit:<ts>:<id>`.

Job metadata (all additive to the upstream protocol): `site`, `project`,
`classification` (`PUBLIC` only), `difficulty` (≥high prefers
above-median capability), `domain`, `modelClass`,
`priority` (`interactive` dispatches ahead of `batch` in `flushPending`),
`group`/`redundant` (jury-sibling dispatch), `verifyOf` (spot-check
replicas), `deadline`.

Volunteer REGISTER carries `taskTypes`, `capabilities`
(`hasWebGPU/cpuCores/ramGb/batterySaver`), `site`, `project`, `referrer`,
optional DID binding (`did` + `sig` over `chimera-bind:<volunteerId>` —
EIP-191 for `0x…` addresses, raw Ed25519 for `did:key:z…` multibase
DIDs, persisted under `didbind:<id>` so offline identities stay
verifiable), and durable-tier fields (`durable`, `shardCapacity`). Swarm
claims (300+) are gated on `durable` at both register and dispatch —
non-durable claims collapse to 0. Result proofs: a DID-bound node signs
`chimera-result:<jobId>:<sha256(result)>` and attaches it as `resultSig`;
the coordinator verifies eagerly, stores `{did, sig, verified}` on the
result record (a bad sig audits `result.bad-sig` and stores unproven), and
`GET /verify/<jobId>` exposes the bundle with dispatch provenance.

Result validation (`registry.ts` `validateJobResult`, zod):

| Type | Task | Schema |
|---|---|---|
| 0 / 100–103 / 200 | infer | non-empty string |
| 201 | MARKET_RESEARCH | `{summary: string}` |
| 202 | REPO_INDEX | `{vectors: number[][]}` |
| 203 | SOCIAL_COPY | `{drafts: string[]}` (≥1) |
| 205 | WEB_FETCH | `{bodyHash: 64-hex, bytes ≥0}` |
| 1 | STORAGE pin | `{cid: 64-hex, verified: true}` |
| 3 | BANDWIDTH | `{served: true, bytes ≥0}` |
| 206 | CANARY | nonce echo (never credited) |

Invalid typed results store `result:<jobId>` with `invalid: true`, earn
nothing, don't retry. Two dedup layers: `result:<jobId>` replay
idempotency, and `seen:<tt>:<hash>` — identical results across *different*
jobs store but skip credit **and** rep.

Payload lint (`src/lint.ts`): regex layer (PEM, secret-assignment,
labeled hex keys, provider token formats, ≥18-word seed runs, emails,
PANs) + **`@secretlint/core` deep layer** (preset-recommend rules;
profiler disabled — workerd lacks `PerformanceObserver`; failures degrade
to regex-only with a logged error). `SEALED_VALUES` env → `[SEALED:name]`
redaction before dispatch (audit-logged). `MAX_PAYLOAD_BYTES` 8192,
`MAX_RESULT_BYTES` 256 KiB.

Economics: `credit()` → volunteer + 10% `ledger:site:*`/`ledger:project:*`
host share; `PROJECT_BUDGETS` cap → `paused:project:` circuit breaker +
`/pools/unpause`; `ANON_CAP_WEI` → anonymous overflow converts to rep;
`MIN_PAYOUT_WEI` dust → rep at `/settle`; `REFERRAL_JOB_CAP`-bounded
referral rep; `REP_WEBHOOK_URL` rep-event bridge; CANARY(206) honesty
jobs on `CANARY_INTERVAL_MS`; `PRICE_TABLE`; reciprocity ledger
(`recip:<a>:<b>` — time-banked cross-project credit); `/metrics` for
scrapers; hash-chained `audit:` log with `audit:last` head.

### wp-cloud

- `src/earn.ts` — `visitorInfer()` coordinator-first (100–103 site-scoped
  + `project`/`priority`/`classification:"PUBLIC"`), Workers AI fallback.
  `src/lint.ts` — same regex set, run pre-dispatch so a leaked key in a
  site prompt never transits the wire.
- `src/serving.ts` — injects `/visitor-node.js` with `data-site`,
  `data-coordinator`, `data-project`, `data-model`, `data-netjobs`.
- `src/usdc.ts` — salted-amount USDC deposits on Base → `credits`.
- `d1/migrations/0007_project.sql` — `project_slug` on sites.
- `public/visitor-node.js` — the tier-0 client (below).
- `wp-plugin/chimera-earn.php` + vendored `visitor-node.js` —
  `test/visitor-node-sync.test.mjs` pins the copy in sync.
- Site-owner surface: `POST/GET /api/sites/:id/earn`,
  `POST /api/sites/:id/project`.

### visitor-node.js (tier-0 client)

Consent-first: nothing computes before a click; `chimera-consent:<scope>`
persists for auto-resume; `No thanks` sets `chimera-optout:<scope>` and
wipes identity. Scope = `PROJECT || SITE`.

- Task claims: compute `[0, 100–103, 200–203, 206]` always;
  `[1, 205]` (fetch/pin — URLs chosen by projects) only behind the
  net-jobs toggle / `data-netjobs`.
- Handlers: 0/100–103/200 → text-gen `infer()`; 201 → `{summary}`;
  202 → `{vectors}` via lazy `feature-extraction`
  (`Xenova/all-MiniLM-L6-v2`); 203 → `{drafts}`; 205 → `{bodyHash,bytes}`
  (https-only, ≤1 MB, 10 s, CORS-bound); 1 → hash-verified Cache-API pin
  (≤8 MB); 206 → nonce echo.
- Models: `onnx-community/SmolLM2-135M-Instruct` default,
  `SmolLM2-360M-Instruct` on ≥8 GB/6-core; `data-model`/`data-host`/
  `data-local`/`data-lib` overrides. Weight fetch deferred on
  metered/cellular/save-data connections.
- UX: intensity slider 25–100% (probabilistic reject), supporter count
  from `/status?project=`, session recap on stop + `pagehide` → persisted
  `chimera-lastsession:<scope>` shown on next visit, watt-hour estimates
  (device-class formula, labeled as estimates), earnings poll,
  visibility pause, opt-out wipes consent/identity/intensity/netjobs/
  lastsession keys.

### delta-git

- `src/worker/compute/pool.ts` — `computeEnabled`, `repoPoolProject`
  (`dg:<owner>/<repo>`), `poolStatus`, `poolEarnings`, `poolInfer`
  (`/v1/chat/completions`, 45 s default), `poolDispatch` (`/jobs/batch` —
  the only fire-and-forget surface). Every entry point takes `visibility`
  and refuses non-`public` before any network call.
- `src/worker/tasks/adjudicate.ts` — public + configured pool ⇒ poolInfer
  first per conflicted file, Workers AI fallback; rationale records
  engine mix. Private/E2E repos never reach the pool.
- `GET /api/v1/repos/{o}/{r}/+/pool` — `{project, enabled, supporters,
  idle, pendingJobs, jobsSettled, earnedWei, coordinatorWs, scriptUrl}`;
  private repos get `enabled:false`.
- `POST /api/:owner/:repo/dg/work/:id/dispatch` — write-gated (push PAT /
  REPO_WRITE scope / signed agent) manual intent→pool trigger; result
  lands on `result` as `pool-draft: …`, trigger user notified.
  `POST /dg/work` auto-dispatches on public repos under `waitUntil`.
- `GET /badge/{o}/{r}/community` — live supporter count badge (public
  only — renders real coordinator numbers, can't be faked).
- `GET /power.js` — vendored `visitor-node.js` (synced copy) from SPA
  assets; `RepoPowerCard` lazy-injects it; `/.well-known/delta-node` +
  `llms.txt` advertise `compute_pool`.
- Env: `COMPUTE_COORDINATOR` (var), `COMPUTE_DISPATCH_TOKEN` (secret),
  `COMPUTE_ENABLED`, `COMPUTE_TIMEOUT_MS`.

### Other verified assets

- Contracts (`localchimera/contracts/`): `EscrowChannel.sol` (USDC
  escrow), `ProofOfInferenceVerifier.sol` (spot-checks). Token contracts
  unused — by design.
- `browser-sdk/` — pure-web compute SDK (`coordinator-client.ts`,
  `browser-node.ts`); `@helia/*`, transformers, web-llm declared as peer
  deps (the P6 substrate is pre-wired).
- Wallet-extension (Rooted) — MV3 machinery: offscreen/alarms/storage
  perms, CWS+AMO store-review experience. Precedent: `Wasmer.fromRegistry`
  remote-WASM violates remote-executable-code policy → **bundled runtime
  + weights-as-data (OPFS) is the compliant extension design**.
- Rooted contrib-worker — DID + **`ed25519`** `X-Did`/`X-Sig` over
  `sha256(method\npath\nsha256(body))` **[DRIFT: comment/megaplan say
  secp256k1; code is ed25519]**. Signature pattern for node DID binding.
- Trading daemon (VPS microfund) — key-holding executor; submits
  MARKET_RESEARCH jobs.

## 4. Compute topology, data plane, federated coordination plane

**Three-tier ladder:**

- **Tier 0 — page script**: zero-install entry at point of interest;
  capability-graded models 135M→360M; ephemeral tabs; juried results.
  Never holds shards, keys, or secrets.
- **Tier 1 — extension**: one store click → wllama (llama.cpp→WASM) in a
  cross-origin-isolated offscreen document (manifest COOP/COEP →
  SharedArrayBuffer + JSPI → threaded build; WebGPU where available),
  weights as data via Cache API — same GGUF format as the durable lane.
  Store policy bans remote-fetched executables → wasm ships in-package.
- **Tier 2 — daemon** (Chimera desktop/qvac): always-on, full GPU,
  committed shard holders; honest ~1 tok/s WAN → batch/nightly
  positioning only; honest-exit commitments (churn ≠ fraud).

**Self-serve data plane**: the swarm powers the *verifiable,
content-addressed* half of a project's Cloudflare slice — CDN/static
serving (Helia), batch inference, erasure-coded storage, DDoS absorption
for cached content. Includes the forge itself: delta-git packs/objects
are content-addressed — supporters serve clones/fetches to each other.
Workers stays the thin trusted control plane.

**Federated coordination plane** (P8): per-service decentralized
substitutes for the remaining CF catalog — keystone is *sign at origin,
verify at edge*:

| CF service | Decentralized mechanism |
|---|---|
| Durable Objects | Rep-staked BFT committee; high-value state → escrow chain; ATProto signed-repo for user state |
| D1 | Tableland / Kwil; hot reads via content-addressed snapshots |
| DNS | Eliminated — ENS → content-hash + Helia (Handshake optional) |
| WAF | Privacy Pass / Anubis-style PoW; rep-staked filter tier |
| Workers (arbitrary compute) | WASM jobs + ProofOfInferenceVerifier → opML/zkVM (RISC Zero/SP1) |
| Queues/cron | BFT replicated scheduler |

Honest note: federated coordination ≠ trustless — a 7-node rep-staked
committee is "sufficiently decentralized" for project workloads, not
Bitcoin-grade. Phase it in only when multi-project scale demands.

## 5. Project namespace

`site:<id>` (wp-cloud host attribution) is parallel to `project:<slug>`
(pool membership). A volunteer carries both; `selectVolunteer` prefers
same-project, then same-site, then global. Pool slugs: `dg:<owner>/<repo>`
(delta-git), `wp:<siteId>` (wp-cloud), free slugs for standalone pools.
Back-compat: `site:` semantics and the upstream WS protocol are
untouched; all new fields are additive and optional.

## 6. Task registry & specialization lanes

Registry (coordinator `registry.ts`): CANONICAL 0–3, WPCLOUD 100–103,
PROJECT 200–206, SWARM 300–301 (durable-volunteer gated).

- **CODE**: REPO_INDEX(202) + code-context AGENT_INFER(200) +
  BUILD_VERIFY(301)
- **MARKETING**: SOCIAL_COPY(203), INFER_SEO(101), MARKET_RESEARCH(201)
- **SUPPORT**: SUPPORT(103)
- **RESEARCH/FETCH**: WEB_FETCH(205)
- **JURY**: HUMAN_JURY(204 — schema `{verdict, rationale?}`; wp-cloud
  opt-in card prompt, 60s human-timeout → re-dispatch)
- **INFRA**: STORAGE(1)/BANDWIDTH(3)/serving
- **TRUST**: CANARY(206 — coordinator-generated, never credited)

Jobs carry `domain` + `modelClass` hints; model-class mapping: REPO_INDEX
→ embedding models (browser-ideal), code lanes → code-tuned models,
copy/support → instruct models. Specialization is declared (registered
taskTypes), emergent (cached models + accuracy history attract
in-domain jobs), and verified (rep lanes, §10).

**Payload classification**: `PUBLIC` (any node) and `INTERNAL` are
accepted; `INTERNAL` jobs dispatch only to volunteers that are both
`durable` and DID-bound (`selectVolunteer` gate — verified live and in
registry tests). `SECRET` and unknown values are 400'd. Strict-E2E repos
never emit code into jobs at all.

## 7. Protocols

- **WS**: REGISTER gains `project`, `referrer`, `durable`,
  `shardCapacity`, optional `did`+sig. JOB_DISPATCH is signed when
  `COORDINATOR_PRIVATE_KEY` is set — `GET /pubkey` exposes the signer
  (EIP-191 over `chimera-job:<jobId>`) so nodes verify dispatches.
  `EXIT` + disconnect release a node's assignments for re-dispatch
  (honest exit).
- **HTTP**: `POST /jobs` gains `project`, `classification`, `priority`,
  `domain`, `modelClass`, `group`/`redundant`; per-project tokens via
  env map **or** runtime `dtok:` via `/admin/tokens`; `POST /jobs/batch`.
- **OpenAI-compat shim**: `POST /v1/chat/completions` → AGENT_INFER →
  OpenAI-shaped response; `stream:true` replays the completed result as
  `chat.completion.chunk` SSE deltas + `[DONE]` (compatibility streaming —
  the wire protocol returns whole results). `classification:"INTERNAL"`
  restricts the job to durable+DID-bound nodes. Makes the pool a drop-in
  backend for ElizaOS/LangChain/our agents.
- **Standards interop (shipped groundwork)**: `/.well-known/agent.json`
  ERC-8004-style card, **x402** `exact` challenge on priced `/jobs`
  (EIP-3009 signature verify; when `X402_FACILITATOR` is set the
  authorization is POSTed to `<facilitator>/settle` for on-chain
  settlement — without it, or with `COORDINATOR_PRIVATE_KEY` funded, the
  coordinator can broadcast `transferWithAuthorization` itself via
  `USDC_EIP3009_ABI`; `chain.ts`), **MCP** adapter (`GET /mcp` tool
  catalog + `POST /mcp/call` for `chimera_infer`/`chimera_fetch`;
  `scripts/mcp-bridge.mjs` bridges stdio MCP clients). Adapters isolate
  spec drift. **Deterministic-replay prover** (`scripts/prover.mjs`,
  `PROVER_URL`): an independent service re-executes each completed job —
  301 inside its own probed `bwrap`/`unshare` sandbox, 300 on the same
  engine the node declared (`engine` on the JOB_RESULT — `ollama`
  llama.cpp, `onnx` transformers.js, or `wllama` on the extension tier;
  cross-engine outputs legitimately
  differ so replay is engine-matched) — and returns a signed artifact
  (claimed vs recomputed sha256, field diffs, prover DID + ed25519 sig)
  that lands as `execProof` on the result and surfaces via `/verify`.
  `/challenge` turns this into the opML-style dispute game: a DID-bound
  challenger with staked rep signs a counter-hash; the prover adjudicates;
  the losing side is slashed. Honest scope: reproducible re-execution for
  deterministic task types, not a zkVM proof of execution.
- **Privacy Pass (RFC 9578)**: anonymous `/jobs` accepts
  `Authorization: PrivateToken token=…` redeemed origin-side via
  `@cloudflare/privacypass-ts` (pure-WebCrypto, workerd-compatible —
  round-trip tested); replay-protected per `pptoken:<sha256>`; Turnstile
  remains the browser-challenge alternative. Both fail closed.
- **Operator rollup**: `GET /operator?did=` aggregates every volunteerId
  bound to a DID — total rep/jobs/ledger + per-node breakdown with live
  online status. The human DID is the principal; tabs/extensions/daemons
  are instruments.
- **Latency classes**: `priority: interactive|batch` — interactive is
  dispatched head-of-queue in `flushPending`; batch fills idle capacity.
  (Interactive SSE token streaming is P2-deferred.)
- **Swarm directory**: DO registry now; DHT decision deferred to the
  federation pass. DO sharding groundwork: `SHARD_KEY` per-deploy override
  + `SHARD_COUNT` FNV-1a slug-hash project-range sharding (`project-N`);
  ledgers are per-shard, settle aggregates.
- **Economics extras (shipped)**: `LANE_PREMIUMS` domain multipliers on
  `PRICE_TABLE`, `REP_PREMIUM_PCT` rep-tier payout bonus (≥10 rep),
  `RECIP_FLOOR_WEI` free-rider floor (over-floor projects must have
  supporters serving other pools or pay `amountWei`), `AGENT_DAILY_QUOTA`,
  `POW_DIFFICULTY`, sealed-value leak killswitch (result containing a
  sealed value → `trust −20`, dispatch-excluded), per-project settle
  statements (`/settle {project}`), rep channel matrix
  (`rep:`/`rep:ch:`/`rep:lane:`/`rep:chlane:` — performed vs provisioned).
- **Anti-abuse/naming**: `/.well-known/ens?name=` resolves ENS address +
  text records + EIP-1577 `contenthash` via `ENS_RPC` (decoded to an IPFS
  CIDv1 and gateway URL via `IPFS_GATEWAY_URL`); Turnstile gates anonymous
  `/jobs` submissions (`TURNSTILE_SECRET` — token auth bypasses, unset
  fails closed); **2-phase committee** at `/committee/propose` +
  `/committee/vote` — motions flow prevote→precommit→committed/failed,
  each phase needing `JURY_QUORUM` rep-weighted signatures over
  `chimera-vote:<id>:<phase>:<yes|no>` verified against the voter's
  persisted DID (phase-bound ballots can't replay across phases;
  forged/unsigned/cross-phase/post-commit rejected — 18/18 live in
  `scripts/committee-test.mjs`); DR drill `GET /drill` recomputes the
  audit hash chain + reconciles ledgers (admin).
- **Durable node**: `scripts/durable-node.mjs` — ed25519 `did:key`
  identity, EIP-191 dispatch-sig verification against `/pubkey`,
  `durable:true` + `shardCapacity` REGISTER, 300 via
  `@huggingface/transformers` text-generation (optional Helia/IPFS weight
  fetch via `TRANSFORMERS_IPFS_CID` + mandatory `…_SHA256` pin — dynamic
  import, never in the worker bundle), 301 via allowlisted sandboxed
  subprocess (tmpdir, no shell, scrubbed env, sha256 artifacts, **net
  isolation**: `bwrap --unshare-net` or `unshare -Urn` when available —
  probed and reported per-result as `isolation`), signed `resultSig`
  proofs, `JOB_REJECTED` on failure, `EXIT` on SIGTERM/SIGINT.
- **Extension node**: `extension/` MV3 service worker — consent-gated,
  bundled (store-CSP compliant), ed25519 `did:key` in
  `chrome.storage.local` (Ed25519 needs Chrome/Edge ≥137; older builds
  register anonymous — degrade, don't break), signed REGISTER +
  signed results, `EXIT` on consent revoke, alarm-driven reconnect.
  Claims fetch/pin/canary lanes only — no infer until weights are
  bundled.

## 8. Financial flow

USDC six decimals — all `*Wei` fields are actually **micro-USDC**
(`1e6 = $1`; the wei naming is historical, kept for key compatibility).

Flow: deposits (salted amounts via wp-cloud `usdc.ts`, or `POST
/patronage` direct pool donations) → jobs carry `amountWei` → `credit()`
on validated results → `ledger:<volunteerId>` + 10% host share to
`ledger:site:*`/`ledger:project:*` → monthly `/settle` (dust
`MIN_PAYOUT_WEI` → rep) → EscrowChannel/direct USDC payout on Base.
Funding sources: budgets, donations, grants, sponsor pools — **or zero**
(rep-only mode).

**Award leg (Slop "pay for what merges")**: `POST /patronage
{fund:"award"}` earmarks deposits into `poolfund:<slug>` — a
project-controlled award pool. delta-git fires `POST /award` on accepted
outcomes (verified work intents, resolved arena matches; `ref`-idempotent)
which debit the pool and credit payee ledgers. Splits use the vendored
Slop largest-remainder allocator (exact integer micro-USDC). Optional
`AWARD_REVIEW_MS` holds awards pending for a review window. Awards are
ledger entries — settlement stays the monthly on-chain runbook; nothing
holds or moves keys.

Three participation modes: **performed** (device labor, full rep),
**provisioned** (agents/fleet enabled work, diminished rep), **patronage**
(USDC → provisioned rep). External revenue leg (P7): pool agents listed
in ERC-8004 sell services via x402 — income flows into pools.

Honest cost model: per-job economics vs Workers AI, jury tax (redundant
dispatch = 2–3× job cost on consequential jobs), weight-mirror egress,
dust thresholds — spend justified as community recirculation.

## 9. Agent layer

`agentInfer` bridge = delta-git's `poolInfer` (adjudication + intent
drafts consume it). **Result sandboxing contract**: schema-validate →
treat as quoted/delimited data → never raw-concat into privileged
prompts; coordinator stores results with `sandbox: 'quoted'` markers.
Secrets-broker grants (delta-git): sealed handles, scoped per-agent-DID
grants, per-request injection at the outbound boundary, `redactSecret`
egress, echo-canary decoys + CanaryTrip killswitch, hash-chained audit.
Trading daemon submits MARKET_RESEARCH jobs — agents are compute
consumers, compute nodes are never credential holders.

**Per-project marketing arm** (P3+): swarm generates SOCIAL_COPY /
INFER_SEO / announcements / MARKET_RESEARCH / SUPPORT; distribution
reuses the defi4refi outreach-engine pattern (leads → LLM drafts →
multi-channel sends with human approve). Works for private/commercial
projects too — marketing payloads are PUBLIC by nature.

**Agent service catalog** (P7): each project publishes sellable agent
services (8004-listed, USDC-priced, x402-settled).

## 10. Reputation & operator identity

**Operator model**: the human DID is the principal; volunteerIds (tabs,
extensions, daemons, old devices) and agent DIDs are instruments.
**Linking ceremony**: sign `chimera-bind:<volunteerId>` — EIP-191 for
wallet addresses, raw Ed25519 for `did:key:z…` (self-contained key
material, no resolver needed; `didkey.ts` decodes the base58btc
multicodec). Wallet extension is the natural anchor; delta-git
`findRepTargetByUserId` resolves owner DIDs. Committee ballots sign
`chimera-vote:<id>:<yes|no>`; result proofs sign
`chimera-result:<jobId>:<sha256(result)>`.

**Two-channel rep**: performed (full weight) + provisioned (diminished) —
a human running 100 paid agents can't drown out a laborer. **Lane matrix**
(P4): rep is channel×lane, not scalar — code-lane rep weights code
juries; jury rep comes only from accurate verdicts; INTERNAL-capable
rep-bound nodes earn lane premiums. Contribution events key on operator
DID → roll-up score; device set stays private (only aggregates public).

## 11. Threat model & robustness — full register

Organized by trust boundary; every risk → designed mitigation → phase.

| # | Risk | Severity | Mitigation | Phase |
|---|---|---|---|---|
| 1 | Payload privacy — nodes see job content | High | PUBLIC-only classification gate; schema lint; then broker redactSecret + canary trip pre-dispatch | P1✓ + P3 |
| 2 | Prompt injection via results | **Critical** | Result sandboxing: per-taskType zod schemas ✓, `sandbox:'quoted'` markers ✓, instruction-stripping + jury consensus for consequential jobs (P3) | P2✓ + P3 |
| 3 | Malicious payloads to visitors | Medium | Data-only payloads (never eval'd — verified); 8KB cap; signed jobs P3; node-side lint ✓ | P1✓ + P3 |
| 4 | Result replay/impersonation | Low | `assigned:` binding ✓; `result:` replay dedup ✓; `seen:` content-hash dedup ✓ | P1✓ |
| 5 | Key exfiltration through agent | High | Sealed handles; outbound-boundary injection; echo-canary decoys + killswitch; scoped grants; audit export | P3 |
| 6 | Sybil farming | High | Trust tiers (anon `ANON_CAP_WEI` cap ✓ / DID-bound / rep premium); deviceTrustScore via canaries ✓; jury cost | P4+P5 |
| 7 | Pool drain / treasury griefing | High | `PROJECT_BUDGETS` circuit breaker ✓; `AGENT_DAILY_QUOTA` ✓; per-agent quotas + price ceilings P5 | P5 |
| 8 | Dust payouts | Low | `MIN_PAYOUT_WEI` threshold → rep conversion at settle ✓ | P4✓ |
| 9 | No emission-funded bootstrap | Medium | Rep-first bootstrap; USDC optional accelerant; reciprocity co-op | P1✓ |
| 9b | Legal classification of payouts | Low | Tokenless → USDC payments are ordinary payments; rep-only fallback per jurisdiction | — |
| 10 | Host-share gaming | Medium | ownVisitor check ✓; tiers + jury make fake traffic unprofitable | P5 |
| 11 | Model weights too heavy for casual opt-in | High | 135M default ✓; Cache API persist ✓; wifi-only fetch ✓; R2 mirror via `data-host` ✓ | P1✓ |
| 12 | Browser fragmentation | Medium | WASM baseline works everywhere; WebGPU = capability bonus | P1✓ |
| 13 | Coordinator single-DO SPOF + 5k cap | High | `flushPending` hibernate recovery ✓; `schema:v` versioning ✓; per-range DO shards P7 | P7 |
| 14 | esm.sh CDN supply-chain | Medium | `data-lib`/`data-host` self-host prep ✓; pin+SRI + R2 mirror P7 | P7 |
| 15 | Base RPC dependence | Medium | `BASE_RPC_URLS` multi-RPC failover ✓; direct jobs unaffected | P7✓ |
| 16 | PII in jobs (GDPR) | Medium | Lint rejects email/PAN ✓; DID optional; pseudonymous ledger | P1✓ |
| 17 | Legal/tax reporting | Low | Tokenless removes securities question; payout thresholds + rep-only fallback | — |
| 18 | Transparency/perception | Low | Consent card discloses what runs + who pays ✓; persistent opt-out ✓ | P1✓ |
| 19 | Weight-mirror egress cost | Medium | R2 caching + model pinning; cost-model line item | P6 |
| 20 | DO schema drift | Medium | `schema:v` versioned keys ✓; migration discipline | P7✓ |
| 21 | Thin middle — browsers can't synthesize | Structural | Honest positioning; Workers AI floor; swarm tier for batch | — |
| 22 | Cold-start pools | Medium | Global spillover ✓; reciprocity sharing ✓; pool-sharing policy | P5 |
| 23 | Churn punished like fraud | Medium | Honest-exit commitments; slash only verifiable fraud | P6 |
| 24 | Swarm ~1 tok/s overpromising | Medium | Batch/nightly positioning only; docs language locked | — |
| 25 | Settlement ops burden | Low | Scan+prepare automation, human approves; runbook | P4+P7 |
| 26 | Persistent opt-in → stealth compute | Medium | Card always visible while running ✓; one-click revoke ✓; no resume without prior consent record ✓ | P1✓ |
| 27 | Reciprocity free-riding | Medium | `recip:` time-bank ledger ✓; balance floors P5 | P5 |
| 28 | Human-jury low-effort votes | Low | Rep-weighted votes; consensus-agreement bonus; unpaid until accuracy proven | P4 |
| 29 | Extension store bans remote code | High | Bundled runtime + OPFS weights-as-data (uBlock precedent); web page fallback ✓ | P6 |
| 30 | MV3 SW killed ~30s idle | Medium | Offscreen-document keep-alive; alarms wakeup | P6 |
| 31 | Mobile lacks extensions | Low | Chimera mobile app = mobile durable tier | P6 |
| 32 | OPFS eviction loses shards | Medium | `storage.persist()`; N-of-M shard redundancy | P6 |
| 33 | Coordination-plane overreach | Medium | BFT committee at "sufficiently decentralized" grade; chain escape; honest docs | P8 |
| 34 | BFT committee safety | High | 2-phase prevote→precommit→commit; phase-bound signed ballots vs persisted DID ✓; forged/unsigned/cross-phase/post-commit rejected — 18/18 live; **multi-deployment live** — roster-snapshot proposals replicated to `COMMITTEE_PEERS`, ballot gossip carries equivocation evidence to all replicas, per-replica independent QCs — 15/15 live across two isolated deployments; remaining: peers are configured mutually-authenticated deployments, not an open validator set | P8 |
| 35 | External protocol deps die | Medium | Adapters everywhere; coordinator works if deps die | P8 |
| 36 | Proof cost/latency | Medium | Spot-check only (ProofOfInferenceVerifier pattern ✓); proofs for consequential jobs | P6+P8 |
| 37 | Private-repo code → visitor payloads | **Critical** | PUBLIC/INTERNAL classification; code jobs tier-gated; strict-E2E never emits; redaction + canary pre-dispatch | P1✓ + P3 |
| 38 | Marketing agent spam | Medium | Human-approve queue; per-channel caps; kill-switch | P3 |
| 39 | Referral self-sybil | Medium | `REFERRAL_JOB_CAP` ✓; contribution-gated vesting P4 | P4 |
| 40 | Store review delays | Medium | wallet-extension already passed CWS+AMO — reuse machinery; web fallback | P6 |
| 41 | Badge abuse (fake "community powered") | Low | Badge renders live coordinator stats — can't fake ✓ | P2✓ |
| 42 | Compat endpoint public abuse | High | Per-project dispatch tokens ✓; `AGENT_DAILY_QUOTA` ✓; budgets ✓ | P2✓ + P5 |
| 43 | Energy metrics overstated | Low | Device-class estimates only, labeled ✓; no carbon-credit claims | P4✓ |
| 44 | Device-multiplication rep gaming | Medium | Per-contribution credits; operator caps; canaries; two-channel rep | P4+P5 |
| 45 | Device-linking privacy | Medium | Device set private; only aggregate operator score public | P4 |
| 46 | Standards drift (8004/x402) | Medium | Adapter isolation; pinned spec versions | P7 |
| 47 | Verifiability overclaim vs SOTA | Medium | "Spot-check + jury-verified" wording locked until P8 proofs | — |
| 48 | Incumbents add browser tier | Low | Moat is the closed loop, not the runtime; compat-API parity via adapter | — |
| 49 | Gradient owns extension channel | Medium | Win project-aligned pools, not "extension compute" generally | P6 |
| 50 | Parallax adoption risk | Medium | Adopt-vs-build gate; adapter seam; custom fallback = minimal sharder | P6 |
| 51 | Lane-gaming (farm easy rep → jury hard lane) | Medium | Lane-scoped rep; entry needs demonstrated accuracy | P4 |
| 52 | Lane cold-start | Medium | Global pool + Workers AI floor; premium pricing advertises scarce lanes | P5 |
| 53 | Lane capture (one operator dominates) | Medium | Per-operator lane caps; spillover; dashboards | P5 |
| 54 | Eval-corpus poisoning | Medium | Canary verdicts = un-gameable anchors ✓; juror-accuracy weighting; audits | P4+P7 |
| 55 | Goodhart drift | Medium | Corpus rotation; human spot-audits; rollback on prod-vs-eval gap | P7 |
| 56 | Distilled specialist regresses/leaks | Medium | P8+ stretch only; PUBLIC-lane outputs only; E2E never enters corpus | P8 |
| 57 | WEB_FETCH abuse (ToS scraping via visitor IPs) | High | Opt-in toggle ✓; https-only + ≤1MB + 10s ✓; CORS-bound; domain allowlists + robots.txt + per-domain kill-switch P5 | P1✓ + P5 |
| 58 | BUILD_VERIFY sandbox escape | High | Durable-node subprocess: argv-allowlist (`BUILD_ALLOWLIST`), no shell, fresh tmpdir, scrubbed env (no secrets inherit), size+time caps, sha256 inputs/artifacts ✓ (`durable-node.mjs`); **net isolation live** — `bwrap --unshare-net` / `unshare -Urn` probed at startup, `isolation` reported per-result; deeper isolation (gVisor) deferred | P6 |
| 59 | Interactive queue starvation | Medium | `priority` head-of-queue ✓; batch preemptible; hard deadline → Workers AI floor | P2✓ |
| 60 | MCP/tool abuse vector | Medium | Same token auth + quotas + budgets; pool-scoped capabilities only | P7 |

Deferred to design: rep-oracle collusion, swarm shard integrity (P6).
Multi-deployment committee consensus is implemented (roster-snapshot
replication + ballot gossip + per-replica QCs + cross-replica equivocation
conviction, 15/15 live) within the configured-peer trust model — open
membership across mutually distrustful operators remains design work.

## 12. End-to-end sequences

- **Browser path**: visitor sees consent card → opts in → WS REGISTER
  (taskTypes, capabilities, project, referrer) → JOB_DISPATCH → local
  model → JOB_RESULT → schema gate → credit + host share + rep event.
- **Swarm path** (P6, live): `durable-node.mjs` REGISTERs `durable:true` +
  `shardCapacity` with a did:key binding → JOB_DISPATCH (EIP-191 sig
  verified against `/pubkey`) → 300 transformers.js inference / 301
  sandboxed build-verify → signed `resultSig` over
  `chimera-result:<jobId>:<sha256>` → credit + rep + `/verify` provenance.
- **Adversarial path**: fabricated result → schema gate or canary/jury
  divergence → trust score drop → `invalid` audit, no credit.
- **Division of labor**: humans file intents → code agent synthesizes
  (durable tier, INTERNAL in P3) → code-lane jury validates → sandboxed
  tests → marketing agent drafts (SOCIAL_COPY, PUBLIC, browser swarm) →
  jury scores → outreach sends (human approve) → support agent fields
  replies (SUPPORT + Workers AI floor). One outcome, six lanes, humans
  holding keys + governance.

## 13. Non-monetary incentive & bootstrap mechanics

- **Persistent opt-in** ✓ — one consent → auto-resume (revocable, card
  always visible). Largest supply multiplier.
- **Reciprocity pools** ✓ — `recip:A:B` ledger + `RECIP_FLOOR_WEI`
  free-rider floor (over-drawn projects must pay or contribute).
- **Rep-staked validation** — reuse delta-git conviction/forfeit;
  group/jury tally groundwork ✓ (`group:` quorum → majority +rep /
  dissent −rep).
- **Genesis self-seeding** — user's own hardware = first durable nodes;
  own projects = first pools.
- **Bandwidth/storage tiers** — hash-verified pinning ✓ (fake results
  cryptographically impossible — lowest-trust job class).
- **HUMAN_JURY(204)** ✓ — coordinator schema + wp-cloud opt-in prompt.
- **Leaderboards + "my impact" + upsell** ✓ — coordinator `/leaderboard`
  (global + per-project lane), delta-git `/api/dg/leaderboard`, earnings/
  recap surfaces; `data-ext` extension upsell (consent-preserving).
- **Portable rep passport** ✓ groundwork — `/passport` signed rep
  attestation (ATProto PDS publication is a later transport).
- **Rep underwriting** — operators vouch-stake new contributors via
  `/api/dg/vouch`; voucher burns on fraud — P4.
- **Consent-card conversion UX** ✓ — supporter count, intensity slider,
  session recap, revoke→wipe.
- **Energy accounting** ✓ — battery guard, watt-hour estimates
  (device-class, labeled) on card + coordinator `estWh`, plugged-in
  preference in dispatch scoring (`batterySaver` −3), wp-cloud reports
  `charging`/`batteryLevel`.

## 14. Distribution & intake funnels

Existing: per-project marketing arm (push), delta-git repo surfaces
(demand), consent-script embeds (supply). By leverage:

- **Referral rep** ✓ groundwork — `/r/:id` redirect + `ref:` records +
  `REFERRAL_JOB_CAP`; vesting P4.
- **Extension store listings as discovery** — wallet-extension install
  base = pre-seeded supply; P6.
- **Selfhosted/homelab community** (r/selfhosted, HA, NAS/RPi packages)
  — zero-incentive durable-node recruitment; P6.
- **Badge/README loop** ✓ — `/badge/*/community` + npm-registry/agent
  surfaces link back to the pool.
- **Old-device funnel** — retired phone as swarm node (mobile app
  exists); P6.
- **Social broadcast** — Rooted graph + Telegram/Discord deep-links; P4.
- **Compute-as-paywall** — "power this project while you read" soft gate.
- Demand side: site-builder marketplaces, defi4refi lead DB warm
  outbound, DAO tooling, arena/hackathon showcases, reciprocity
  cross-promotion.

## 15. Open design questions

Pricing oracle; credits-vs-escrow pools; rep attestation format; swarm
directory mechanism (DO vs DHT — P6 gate); reciprocity abuse surface;
model-mirror ops; payout tax classification; referral attribution rules;
ERC-8004 sync cadence; x402 facilitator (CDP-hosted vs self-settle);
lane taxonomy governance; lane-weighting curve.

## 16. State of the art & measured-surpass gates

Checked 2026-10: **ERC-8004** live EVM standard (adopt, don't compete).
**x402** (x402 Foundation, Coinbase-origin) — emerging HTTP-native agent
payment rail → accept on compat endpoint (P7). **Dria/GaiaNet** shipped
prior art validating demand; lacks our supply loop. **Verifiable
inference frontier**: DeepProve zk proofs ~86–174 tok/min; OTR
TEE-rollups ~99% centralized throughput claims; zk-OPML hybrids — our
spot-check tier is deliberately pragmatic; no "cryptographically
verifiable" claims until P8. **Browser inference**: transformers.js v4
native WebGPU; WebLLM ~80% native to 7B; LlamaWeb −30% memory. **Swarm
inference**: Parallax sets the bar (pipeline-parallel, paged KV,
heterogeneous GPU/MLX, 3.1× latency, 72B-class) — adopt rather than
rebuild; Petals 70B public swarm; exo 405B LAN-mesh. **Extension-scale
precedent**: Gradient Sentry's millions of installs on connectivity-only
nodes — our extension does real work, capability-per-install can exceed
it.

**Benchmark matrix** (P8 gate, draft targets): onboarding friction
(consent→first-result <60 s vs install+config for Dria/GaiaNet/exo);
tier-1 persistence (extension survives tab close ≥24h); swarm batch
throughput vs Petals on identical model+node count; cost-per-useful-
result vs Workers AI; verification overhead measured. The eval harness
(§17) produces the report before any external surpass claims.

## 17. Self-improvement & evolution loops

- **Routing learns** (per job): duration/quality/failure per
  (device-class × modelClass × lane) recalibrates difficulty hints and
  capability scores — groundwork: `trust:` scores, canary outcomes,
  `difficulty` routing ✓.
- **Juries learn** (per verdict): juror accuracy-vs-consensus tracked →
  in-lane jury weight evolves — `group:` tally groundwork ✓.
- **Agents evolve** (per generation): jury scores on real outputs feed
  prompt/policy versioning — delta-git adjudicator + rep events are the
  substrate ✓.
- **Eval corpus accrues** (continuous): jury verdicts + canary outcomes →
  per-project benchmark datasets — the system generates its own ground
  truth.
- **Swarm trains its own specialists** (P8+ stretch): jury-approved
  outputs → LoRA/distill → served back through the swarm.

All policy changes are versioned, benchmarked, rollback-able —
self-modification inside a verified harness, never silent drift.

---

✓ = shipped and verified this implementation. See `roadmap.md` for phase
detail and `oss-inventory.md` for the dependency/license ledger.
