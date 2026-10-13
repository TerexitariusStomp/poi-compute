# OSS Inventory + Custom-Code Report

Full-architecture bill of materials for the proof-of-interest compute
system — every dependency the 8-phase build needs, not just what shipped
today. Licenses verified against npm/GitHub registries during planning.

## License policy

Permissive + copyleft are both acceptable. **Excluded class: SSPL, BSL,
Elastic/source-available** — anything that restricts offering the software
as a service or demands a commercial license at scale.

## BOM — shipped (Phase 1–2)

| Package | License | Used for | Where |
|---|---|---|---|
| `zod` | MIT | result schemas, job envelopes | coordinator, delta-git |
| `viem` | MIT | EIP-191 DID binding, chain reads, escrow events | coordinator, wp-cloud |
| `@secretlint/core` + `@secretlint/secretlint-rule-preset-recommend` + `@secretlint/profiler` | MIT | deep payload lint (AWS/GCP/npm/GitHub/Slack/Stripe/Shopify/SendGrid/privatekey rules); profiler disabled — workerd lacks PerformanceObserver | coordinator |
| `@huggingface/transformers` (+ `onnxruntime-node` on Node) | Apache-2.0 (MIT for onnxruntime) | durable-node SWARM_INFER executor fallback (`durable-node.mjs` dynamic import — never in the worker bundle) | coordinator scripts |
| `@wllama/wllama` (pinned 3.6.1) | MIT | browser infer lane — llama.cpp→WASM/WebGPU, threaded JSPI build in the isolated offscreen doc (only engine shipped: it is the fastest in-browser path measured; compat single-thread was slower than ONNX → removed). Same GGUF format as the durable Ollama lane | extension `wllama-entry.js` / `vendor/wllama*` |
| `onnx-community` SmolLM2-135M/360M-Instruct (weights) | Apache-2.0 (model Apache-2.0) | default instruct models | visitor-node.js / power.js |
| `itty-router` | ISC | wp-cloud routing | wp-cloud |
| `aws4fetch` | MIT | R2 signing (existing) | wp-cloud |
| `badge-maker` | MIT | shields-compatible badges (existing) | delta-git |
| `ws` | MIT | Node WS *server* for volunteer links (native WebSocket is client-only) | qvac `CoordinatorClient`, `workers/resource-provisioner` |
| `@cloudflare/workers-types` | Apache-2.0 | types (dev only) | all three |

No new OSS dependency was *required* for the shipped delta-git surface —
`zod` was already vendored; the bridge speaks plain HTTP. did:key needed
no dependency at all — `didkey.ts` is ~117 LOC of base58btc/multicodec
decode over `crypto.subtle`'s native Ed25519 (workerd + Node 22 both have
it). The standalone `@noble/ed25519` package has since been removed
entirely: the one vendored file that imported it now sources `ed25519`
from `@noble/curves/ed25519.js`, which was already a declared dep.

## BOM — declared-for-later phases

| Package | License | Phase | Surface |
|---|---|---|---|
| `@helia/*`, `helia`, `blockstore-idb` | Apache-2.0 OR MIT | 6 | pack/asset data plane, verified pinning |
| `@mlc-ai/web-llm` | Apache-2.0 | 6 | WebGPU inference tier |
| `@wasmer/sdk` | MIT/Apache-2.0 | 6 | sandboxed task runtimes |
| `comlink` | Apache-2.0 | 6 | worker-pool RPC in extension |
| `idb` | ISC | 6 | shard persistence |
| ~~`@secretlint/secretlint-rule-preset-recommend`~~ | MIT | ~~3+~~ | moved to shipped BOM — deep lint layer live in coordinator |
| `redact-pii` / `@redactpii/node` | MIT | 3 | INTERNAL-lane redaction |
| `@noble/curves` | MIT | 3 | did:key interop (p256/k256 verify) + Ed25519 via `/ed25519.js` subpath — replaces standalone `@noble/ed25519` (removed) |
| `@modelcontextprotocol/sdk` | MIT | 8 | MCP provenance/agent surface |
| `@coinbase/x402`, `x402` | Apache-2.0 | 5 | per-request payment lane |
| `@tableland/sdk` | MIT AND Apache-2.0 | 5 | on-chain receipt tables |
| `@cloudflare/privacypass-ts` | Apache-2.0 | 7 | anonymous-but-human attestation |
| `croner` | MIT | 5 | settlement cron |
| `yaml` | ISC | any | config (already in delta-git) |
| Parallax (`github.com/mudler`) | Apache-2.0 | 6/7 | GPU swarm scheduler candidate |
| Hivemind (`learning-at-home`) | MIT | 7 | distributed-training reference |
| Anubis (`TecharoHQ`) | AGPL | 7 | bot/PoW front door (self-hosted service; copyleft acceptable) |

browser-sdk already declares `@helia/ipfs`, `@helia/unixfs`,
`@huggingface/transformers`, `@mlc-ai/web-llm`, `@wasmer/sdk` as peer deps —
the Phase-6 substrate is pre-wired.

**Excluded after review**: any SSPL storage (e.g. older Mongo), BSL engines
(CockroachDB, newer Terraform), Elastic-licensed search. None needed —
D1 + R2 + KV + DO storage cover the state plane.

## Monetization-surface license audit (2026-10-08)

Full-tree `package-lock.json` license sweep on delta-git (the paid surface
— x402 lanes, hosted tiers) and the coordinator. Every dependency is
commercially usable; no SSPL/BSL/Elastic anywhere in either tree.

| License | Count | Packages / notes |
|---|---|---|
| MIT | ~367 | viem, zod, ws, esbuild, itty-router, aws4fetch, badge-maker, most of tree |
| Apache-2.0 | ~45 | @huggingface/transformers, @wllama/wllama, @cloudflare/*, Gitness SPA |
| LGPL-3.0(+/-or-later) | ~20 | **openpgp** (runtime, dynamically loaded — LGPL satisfied by dynamic linking + notices in delta-git `NOTICE`); `@img/sharp`+libvips (wrangler **dev-only**, never deployed) |
| MPL-2.0 | ~12 | **lightningcss** — Tailwind v4 build-time only; file-level copyleft, no runtime reach |
| CC-BY-4.0 | 1 | caniuse-lite — browserslist build-time target data |
| BSD-2/3, ISC, 0BSD, Unlicense, CC0 | ~35 | permissive |

Other monetization surfaces: localchimera coordinator = AGPL-3.0 (copyleft
permitted; commercial use allowed, source-availability obligations on
network use documented); wp-cloud deps (itty-router/aws4fetch/viem) all
MIT/ISC. Gitness canary = Apache-2.0 with `frontend/canary/UPSTREAM.md`
provenance note and `NOTICE` at repo root.

Attribution artifacts shipped: `delta-git/NOTICE`, `delta-git/.github/
FUNDING.yml`, `localchimera/.github/FUNDING.yml`, `docs/oss-licenses.md`.

**2026-10-10 sprint additions** (Birthday-Week/Poppy integrations — every
new surface sourced from commercially-usable OSS, licenses verified via
npm registry):

| Component | Package | License | Sourcing |
|---|---|---|---|
| WebMCP polyfill | `webmcp-core` 1.0.0 | MIT | npm dep, pinned (single stable release, Mar 2026 — passes vetting window) |
| Poppy SDK (Tier 2, if landed) | `@datalayer/personal-agent-protocol` 0.3.3 | BSD-3-Clause | **vendor** into `src/vendor/poppy/` — package is days old and churning (4 releases in 7h); vendored LOC counts as third-party |
| Clef decision model | `@cf/cloudflare/clef-flash` | Apache-2.0 | Cloudflare-hosted model via `env.AI.run` — no package dep |
| Arena entry diff | `diff` 9.x (jsdiff) + `diff2html` 3.4.22 + `@git-diff-view/react` 0.0.30 | BSD-3 / MIT / MIT | already in tree — zero new deps |
| x402 reference | `@coinbase/x402` 2.1.0 | Apache-2.0 | docs/reference only, not a dep |
| Slop award allocator | `elizaOS/slopdotcash` `allocateReviewBudgetMinor` | MIT | **vendored** → `workers/coordinator/src/vendor/slop/` (reward-allocation.ts excerpt + evm-funding/evm-settlement byte-identical, UPSTREAM.md + LICENSE) |
| Slop protocol model | `slop.cash` project.json/skill conventions | MIT | reimplemented as `dg-project-1` manifest — fields map, no code copied |

New authored LOC this sprint ≈ **460** (poppy.ts route ~70, clef.ts ~95,
adjudicate verdict seat ~80, arena judge ~75, entry-diff endpoint ~35,
SPA diff component+glue ~120, webmcp island ~85 — minus removals).
Aggregate authored share stays ≈0.4%, far under the 5% bar.

**Slop-integration pass** adds ≈ **1,120** authored LOC across both repos
(localchimera ~440: coordinator award lifecycle +240, award-test script
+105, allocator unit tests +78, README +18; delta-git ~680: poolAward
bridge +136, agent routes/project.json/skill.md +162, DO award record
+52, arena resolve trigger +28, schema/DAL +24, SPA badges/filters +126,
misc +misc — minus removals). Vendored Slop code (~520 LOC, MIT) counts
as third-party per methodology. Aggregate authored share moves to
≈0.42% — still far under the 5% bar.

## Dependency minimization audit (2026-10-11)

Full sweep: every direct dep in delta-git, localchimera (coordinator +
qvac + resource-provisioner), and wpcloud mapped to live import sites;
every material custom-code cluster checked for a commercially-usable OSS
replacement (copyleft included). Result: the tree is at/near minimal.

### Applied reductions

| Change | Saved | Evidence |
|---|---|---|
| Removed `@noble/ed25519` (delta-git) | −1 direct dep | Only imported by vendored `widespread/crypto/signing.ts` whose exports no first-party code calls. Now re-exports `ed25519` from `@noble/curves/ed25519.js` (already a dep via `verify.ts` nist/secp256k1 imports). Identical RFC8032 semantics; sync API is await-compatible. Drift recorded in vendored `UPSTREAM.md`. Worker tests 17/17 on did:key/atp/http-sig/rep-cert paths green. |
| `wpcloud/usdc.ts` hand-rolled `eth_blockNumber`/`eth_getLogs` JSON-RPC → viem `createPublicClient`+`getLogs`+`parseAbiItem` | ~net-0 LOC, −`any` helper, −manual topic padding | viem already a direct dep (`auth.ts` verifyMessage). Removes the only `as any`/`any[]` boundary in wpcloud and the hand-maintained keccak topic. Block-window + cursor semantics unchanged. |

### Rejected — would remove functionality or add churn without gain

| Candidate | Verdict |
|---|---|
| `ws` → native `WebSocket` | **Required.** qvac `CoordinatorClient` + resource-provisioner `server.js` run Node WS *servers*; native WebSocket is client-only. No removal possible. |
| `eventsource-parser` for `consumeCompletionStream` (~40 LOC SSE) | Rejected — trades ~35 authored LOC for a NEW dep; net-negative on the package-count axis. |
| `oslo` (vendored jwt/challenge helpers) | Keep — vendored Rooted code uses it; swapping edits vendored surface for zero net dep gain (crypto.subtle is already used where sufficient). |
| `diff` vs `node-diff3` | Both required — `diff` renders patches/diffs; `node-diff3` does 3-way merge. Different functions. |
| `htmlparser2` + `domhandler` | A parser+DOM pair in `markdownHtmlSanitizer.ts`, not duplication. |
| `casbin`, `@orama/orama`, `modern-tar`, `standardwebhooks`, `@simplewebauthn/server`, `openid-client`, `jose`, `@atcute/*` family, `aws4fetch`, `itty-router`, `viem`, `commander`, `chokidar`, `graphql`, `marked`, `mime`, `pako`, `zod`, `hono`, `drizzle-orm`, `badge-maker`, `@primer/*`, `react*`, `secretlint` trio, `@huggingface/transformers`, `@wllama/wllama`, `helia` (durable-node dynamic import) | Each has live import sites; no commercially-usable drop-in replacement that preserves Cloudflare Workers compatibility. See grep-verified import map (audit session 2026-10-11). |

### Irreducible-by-construction (unchanged from prior audit)

`CoordinatorDO` (consent-gated volunteer WS + USDC micro-ledger + BFT
quorum on Durable Objects — BullMQ/Celery assume trusted workers +
Redis/Postgres, wrong substrate), `visitor-node.js` (consent-first
browser node UX is the product differentiator), `compute/pool.ts` (thin
client to our own API), `VolunteerEscrow.sol` (ledger-specific escrow),
`didkey.ts` (117 LOC vs a heavier resolver dep), hash-chained op-log,
arena/work-intent domain core.

## Custom-LOC report

Methodology: `git ls-files | xargs wc -l` for tracked totals; authored-new
= `git diff` insertions + untracked file LOC, excluding lockfiles and
byte-identical vendored copies (power.js / wp-plugin/visitor-node.js are
copies of one authored file — counted once).

| Repo | Tracked LOC | Authored-new (megaplan) | % |
|---|---|---|---|
| localchimera | 1,580,089 | ~5,245 (P1–P2 coordinator diff; P3–P7 ~390; P8 pass ~900; deferral pass ~970; **no-deferral pass ~1,495: coordinator-do +505 net (federated BFT: roster snapshots/peer replication/ballot gossip/equivocation, /challenge dispute, execProof wiring, dedup fix, direct x402 settle) + chain.ts decodeEip3009Payment +25 + prover.mjs 239+50 engine replay + committee-federated-test 252 + challenge-test 198 + ollama-bench 110 + x402.test 66 + extension build/infer-entry 30 + durable-node ollama engine ~75 + heartbeat-registry fix, minus net removals**) | ~0.33% |
| wp-cloud | ~5,730 | ~680 (P1–P2 earn/serving/env/php/lint; P6 adds jury handler + card UI, battery state, extension upsell, EXIT on stop/opt-out — ~180 across visitor-node.js + plugin; wp-plugin copy deduped) | ~11.9% |
| delta-git | 288,380 | ~850 (P1–P2 pool bridge/routes/card; P3–P8 ~110; P8-eval +108; **deferral pass ~240: INTERNAL classification map + SSE consumer + `internal` visibility enum/migration + member-gate flips + tests**) | ~0.29% |
| **Aggregate** | **~1,874,000** | **~6,775** | **~0.36%** |

### Per-repo verdicts

- **localchimera** — comfortably under. The coordinator DO is the
  irreducible custom core: no OSS project provides *this* protocol
  (consent-gated volunteer WS + USDC micro-ledger + typed dispatch) on
  Durable Objects. BullMQ/Celery alternatives assume trusted workers and
  Redis/Postgres — wrong substrate.
- **wp-cloud** — ~11.9% after the P6 jury/upsell additions, over the 5%
  per-repo bar. Justification: the added
  code is almost all `visitor-node.js` — consent UX + wire client. The
  card *is* the product surface (consent-first positioning is the
  differentiator vs. every similar network), and the wire protocol is ours;
  there is no OSS base for "opt-in browser compute node with this consent
  UX." If a hard cap is required, the recovery path is vendoring
  localchimera `browser-sdk` as the protocol layer (~200 LOC replaced), at
  the cost of a build step the script currently avoids.
- **delta-git** — comfortably under; the repo's size absorbs thin glue.

### Irreducible custom components (no viable OSS base)

1. `CoordinatorDO` — volunteer registry/ledger/dispatch on DO storage.
2. `visitor-node.js` — consent card + lifecycle (see above).
3. `compute/pool.ts` — thin client to our own coordinator API.
4. `VolunteerEscrow.sol` — escrow semantics specific to this ledger.
5. wp-cloud earn/serving glue — CMS-specific injection points.

## Verification log

**2026-10-08 refresh (engine-gap close + funding pass):**
- coordinator: `tsc --noEmit` clean; `vitest run` **53/53** (incl. x402
  EIP-3009 decode round-trip 3/3).
- Federated BFT across two independent `wrangler dev` deployments:
  `committee-federated-test.mjs` **15/15** (independent commits, QC
  intersection, cross-replica equivocation conviction, forged-ballot
  rejection, post-purge recommit).
- Dispute game `challenge-test.mjs` **13/13** (liar proven false+slashed,
  honest result reproduced byte-exact, false challenger slashed,
  forgery/replay/zero-rep griefing rejected).
- Engine-matched replay: node declares `engine` on JOB_RESULT → prover
  replays on the same engine. Pool warm p50 **57ms** via Ollama/llama.cpp
  (raw Ollama 47ms — ~10ms coordination overhead; ONNX lane was ~2.4s).
- Extension: wllama-only lane — threaded build in isolated offscreen doc;
  compat+transformers.js fallbacks removed (compat measured slower than
  ONNX). Artifacts: `vendor/wllama-page.js` + `wllama.wasm` (~8.8MB).
- Node bench (shimmed, for record): Ollama 47ms / ONNX 509ms /
  wllama-compat 1374ms warm p50 — numbers archived in `roadmap.md`.

**Prior log:**

- coordinator: `tsc --noEmit` clean; `vitest run` 46/46 (incl. didkey 9/9 —
  base58 round-trip, ed25519 verify, forgery/malformed rejection,
  EIP-1577 contenthash→CIDv1 decode).
  Live wrangler-dev + `durable-node.mjs`: did:key REGISTER bound +
  revalidated, 301 sandboxed subprocess returned sha256'd artifacts with a
  `verified:true` ed25519 result proof, 300 ran real Qwen2.5-0.5B
  inference, non-allowlisted `cmd` rejected, SIGTERM → honest EXIT.
  `committee-test.mjs` 10/10 — 5 did:key voters earn rep via real jobs,
  4 honest ballots counted weighted, forged 403 / unsigned 400 /
  replay 409. `/verify/<jobId>` returns the provenance bundle. `/drill`
  reports audit-chain intact + ledgers consistent. Anonymous `/jobs`
  fails closed (401) without `TURNSTILE_SECRET`. Benchmark
  (`eval.mjs`, 1 node): 301×10 conc-4 → p50 256ms, 9.09 j/s; 300×6
  conc-2 → p50 2.4s, 0.61 j/s (CPU inference); 200 w/o supply → honest
  `accepted:false` ~50ms.
- wp-cloud: `tsc --noEmit` clean; `node --test` green (sync test);
  `node --check` on updated visitor-node.js. PHP lint unavailable locally.
- delta-git: `tsc -p test/tsconfig.json` clean; worker tests
  compute-pool 9/9 (incl. `/+/eval`), adjudication 4/4, rep-cert 3/3,
  leaderboard 1/1, agent-surface 6/6; node `pool-sanitize` 3/3;
  `db:generate` produced `0026` (eval_corpus); `npm run build` green.
- Not verified live: multi-shard routing (needs two DO instances),
  x402 real-payment settle (signature verify only — no facilitator),
  ENS mainnet resolution end-to-end (decoder unit-tested; needs
  ENS_RPC), committee *across deployments* (single-DO signed votes are
  shipped; federated consensus is not). These are documented as such.

## poi-compute consolidation (2026-10-13)

New deps introduced by the consolidated repo — all verified by
`scripts/license-check.mjs` (595 packages, 23 distinct SPDX ids, gate
green):

- `helia` + `@helia/unixfs` + `multiformats` — IPFS data plane
  (Apache-2.0/MIT duals). Peer-optional in durable-node/cli; real devDeps
  in browser-sdk.
- `@mlc-ai/web-llm` (Apache-2.0) — WebGPU inference lane, optional peer.
- `@huggingface/transformers` (Apache-2.0) — ONNX fallback inference.
- `@wllama/wllama` 3.6.1 vendored in extension (MIT; bundled, no remote
  fetch — store-compliant).
- `@cloudflare/privacypass-ts` (Apache-2.0), `viem` (MIT), `zod` (MIT),
  `@secretlint/*` (MIT), `esbuild` (MIT), `wrangler`/`workerd` (Apache),
  `vitest` (MIT).
- `@img/sharp-libvips-*` (LGPL-3.0-or-later, via sharp transitively) and
  `@ipshipyard/node-datachannel` (MPL 2.0) — copyleft allowed by policy.

Excluded by policy/scope: `@web3auth/*`, `@toruslabs/tss-dkls-lib`,
`casper-js-sdk` (wallet adapters not ported), `@wasmer/sdk` (remote WASI
module loading — store-policy violation), SSPL/BSL/Elastic/non-commercial
anything (mechanically denied).
