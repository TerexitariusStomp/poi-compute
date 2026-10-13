# Proof-of-Interest Compute — Roadmap

Eight phases, reverified against shipped code. "Done" means implemented +
typecheck/test-verified in this pass; "deferred" items are called out in
`architecture.md` §6.

## Phase 1 — Coordinator hardening + browser tier (DONE)

**localchimera coordinator** — `project:<slug>` namespace parallel to `site:`;
`ledger:project:*` 10% host share; per-project dispatch tokens via
`PROJECT_TOKENS` env map **and** runtime `POST/DELETE /admin/tokens`
(`dtok:<slug>` in DO storage — new pools self-serve without redeploy); payload
lint + PUBLIC-only classification (regex layer + `@secretlint/core` deep
layer, live-verified catching a SendGrid key the regexes miss); `SEALED_VALUES`
redaction; zod result schemas; `result:` replay dedup **and**
`seen:<tt>:<hash>` content dedup (identical results across jobs earn neither
credit nor rep); invalid-result audit; `/jobs/batch`; `priority`
(interactive-first under contention); difficulty-aware selection;
site→project preference cascade; `/status?project=`; OpenAI shim
`/v1/chat/completions`; `PROJECT_BUDGETS` circuit breaker + `/pools/unpause`;
`/patronage`; anonymous payout caps; dust→rep at settle; referral records;
`REP_WEBHOOK_URL`; `BASE_RPC_URLS` failover; `schema:v` migration groundwork;
CANARY(206) honesty checks; redundant `group` dispatch; audit log;
`/metrics`; reciprocity ledger; DID/operator binding (`did`+`sig` at
REGISTER — EIP-191 for `0x…` addresses, **Ed25519 `did:key:z…`** for
self-contained key DIDs; heartbeat rebind), `durable`/`shardCapacity` fields,
Turnstile anonymous-submission gate on `/jobs` (`TURNSTILE_SECRET` — tokens
bypass; unset fails closed).

Swarm types `SWARM_INFER(300)`/`BUILD_VERIFY(301)` were reserved here;
Phase 6 unlocked them for durable volunteers (see below).

**wp-cloud** — `data-project` end-to-end (plugin settings → serving → script);
persistent consent + auto-resume; consent card with supporter count,
intensity slider, session recap (persisted across visits via
`chimera-lastsession`), watt-hour estimates (device-class, labeled),
full opt-out wipe including recap/netjobs keys; net-jobs toggle gating
WEB_FETCH/pin; instruct-tuned SmolLM2 defaults (135M base, 360M on capable
devices); metered-connection weight deferral; project task handlers 200–203
returning schema-valid envelopes; `src/lint.ts` pre-dispatch payload lint
(flagged prompts never leave the worker); Workers AI fallback kept; USDC
settlement untouched; plugin/public script sync enforced by test.

## Phase 2 — delta-git integration (DONE)

`compute/pool.ts` bridge (status / earnings / chat-completions / batch
dispatch); adjudicator pool-first for public repos with Workers AI floor;
`+/pool` repo API returning supporters + `jobsSettled`/`earnedWei`;
`/power.js` vendored consent script + `RepoPowerCard` (live jobs/earnings
in the card); `community` supporters badge; work-intent → pool dispatch
with result write-back — both automatic on `POST /dg/work` and manual via
write-gated `POST /dg/work/:id/dispatch` (result lands on the intent +
trigger user notified); agent-surface/llms.txt discovery entries.

Not shipped (by design): pack offload (P6 data plane), pool jobs for
private/E2E repos (never), SSE streaming.

## Phase 3 — Identity + reputation (MOSTLY DONE)

Done: EIP-191 DID-binding handshake (`did`+`sig` at REGISTER), `GET /pubkey`
(coordinator's dispatch-signing address — nodes verify `JOB_DISPATCH` sigs
are EIP-191 `chimera-job:<jobId>` from that key), rep-webhook event bridge,
anon caps, instruction-strip result sandboxing (`sandbox: 'quoted'` on the
result envelope — pool output can never carry prompt authority downstream),
sealed-value leak killswitch (`trust −20` → excluded from dispatch),
`/passport` signed rep attestation, `/leaderboard` + `/rep` surfaces,
`/results/<id>?token=` per-job bearer reads. **Ed25519 `did:key` interop
shipped**: `didkey.ts` (base58btc/multicodec decode, `crypto.subtle`
verify) — registered-bound nodes carry `did:key:z…` identities end-to-end.
Daemon submitter: `scripts/submit.mjs` (JSON spec on stdin/file → dispatch
→ poll result). Deferred: operator rollups.

## Phase 4 — Adjudication + jury (DONE)

Done: `group`/`redundant` sibling dispatch (N-of-M, ≤5) with majority
tallying under `group:<id>.verdict`; HUMAN_JURY(204) schema + wp-cloud
prompt handler (opt-in toggle, 60s human-timeout → re-dispatch); rep
channel×lane matrix — `addRep(id, pts, reason, lane?, channel)` writes
`rep:` / `rep:ch:<channel>:` / `rep:lane:<lane>:` / `rep:chlane:`, with
performed vs provisioned split (dust-conversion, anon-cap conversion,
referrals, patronage accrue as `provisioned`); **signed rep-weighted
committee ballots** (`/committee/propose`, `/committee/vote` — every ballot
must carry `sig` over `chimera-vote:<id>:<yes|no>` verifiable against the
voter's persisted `didbind:<id>`; forged/unsigned/replayed ballots
rejected, one vote per rep holder, quorum = `JURY_QUORUM`); energy-aware
dispatch (`batterySaver −3` score, wp-cloud reports
`charging`/`batteryLevel`); referral vesting cap (`REFERRAL_JOB_CAP`,
default 50). **Byzantine test log: `scripts/committee-test.mjs` — 5 did:key
voters earn rep via real jobs, 4 honest ballots counted, 1 forged ballot
rejected 403, unsigned 400, replay 409 (10/10 pass live).** Deferred:
consumer-side aggregation policy beyond majority.

## Phase 5 — Economics (DONE)

Done: budgets/circuit-breaker (`PROJECT_BUDGETS` → `paused:project:` +
`/pools/unpause`), patronage (`/patronage`, provisioned rep for donors),
dust→rep at settle, per-project settle statements (`/settle {project}`),
anon→rep conversion cap (`ANON_CAP_WEI`), sybil-tiered rep premium
(`REP_PREMIUM_PCT` — nodes with ≥10 rep earn a % bonus; anon can't reach it
since rep only accrues from real work), per-lane price premiums
(`LANE_PREMIUMS` — `{"domain": multiplier×100}` on `PRICE_TABLE` defaults),
per-agent daily quota (`AGENT_DAILY_QUOTA`), reciprocity free-rider floor
(`RECIP_FLOOR_WEI` — a project over its net cross-project draw must either
have supporters serving other pools or pay `amountWei`), PoW gate
(`POW_DIFFICULTY`), x402 `exact` payment lane on priced submissions
(`X402_PAYEE`/`X402_USDC`, EIP-3009 verify — signature-only; settlement is
the facilitator's).

## Phase 5b — Funded outcomes, Slop model (DONE)

"Pay for what merges" — project-controlled award pools pay only accepted
outcomes, adopted from Slop.cash (vendored MIT allocator):

- Coordinator award lifecycle: `POST /award` (`ref` idempotent, `did` or
  score-weighted `split` via vendored `allocateReviewBudgetMinor`),
  `GET /award/<ref>`, `GET /awards?did=`, `POST /award/<ref>/approve`
  (admin), optional `AWARD_REVIEW_MS` pending window.
- Award pool funding: `/patronage {fund:"award"}` → `poolfund:<slug>`;
  `GET /poolfund/<slug>` accounting (deposited/spent/pending/available).
- delta-git metadata: `work_intents.reward_wei`, `matches.prize_wei`
  (micro-USDC decimal strings; drizzle migration 0012).
- Triggers: verify-quorum acceptance pays `claimed_by` (`work:<id>` ref);
  arena resolve splits `prize_wei` across submitted entries by composite
  score (`match:<id>` ref). Every attempt lands an `award.grant` op-log
  entry — auditable including `unfunded` refusals.
- Discovery: `/api/:o/:r/dg/project.json` (dg-project-1 manifest),
  `/dg/skill.md`, `/dg/awards/:ref` status proxy, `awards` capability in
  `/.well-known/delta-node`.
- Frontend: USDC badges on work queue + arena, funded-only filter,
  match award-status badge.
- Non-custodial throughout: pool debits only, no keys, `credited` ≠
  `settled` — settlement stays the monthly on-chain runbook.
- Verified: coordinator instant+pending round-trips 21/21 live, allocator
  unit tests 5/5.

## Phase 6 — Data plane + extension (PARTIAL — groundwork shipped)

Done: swarm types `SWARM_INFER(300)`/`BUILD_VERIFY(301)` unlocked for
durable volunteers only (`stripSwarmClaims` at REGISTER+HEARTBEAT plus the
dispatch-side `durable` gate — non-durable claims collapse to 0); honest
exit (`EXIT` ws message + `releaseVolunteerAssignments` on close — in-flight
jobs re-dispatch instead of timing out); `shardCapacity` field recorded;
`/weights/*` redirect endpoint (`WEIGHTS_MIRROR_URL` → R2/CDN mirror, bytes
stay off worker CPU); wp-cloud jury/netjobs/ext data-attrs + self-hosted
`data-lib`/`data-host` transformers.js paths (kills the esm.sh dep);
**real durable node daemon `scripts/durable-node.mjs`** — did:key identity,
dispatch-sig verification against `/pubkey`, `shardCapacity` concurrency,
300 → transformers.js `text-generation` (live-verified: Qwen2.5-0.5B
inference, signed result proof `verified:true`), 301 → sandboxed subprocess
(fresh tmpdir, argv-allowlist `BUILD_ALLOWLIST`, no shell, scrubbed env,
sha256'd inputs/artifacts, size+time caps; live-verified with artifact
hashes), honest `JOB_REJECTED` on capacity/unsupported/bad-sig, `EXIT` on
SIGTERM/SIGINT.
Deferred: pack-object offload, helia weight sharding, store-compliant
bundled extension runtime.

## Phase 7 — Scale hardening (PARTIAL — adapters shipped)

Done: multi-DO sharding groundwork (`SHARD_KEY` deploy override +
`SHARD_COUNT` deterministic FNV-1a project-range sharding — `project-N`
shards by slug hash); MCP tool catalog + `POST /mcp/call` (`chimera_infer`,
`chimera_fetch`); ERC-8004-style agent card at `/.well-known/agent.json`;
x402 402-challenge on `/jobs` (see P5); eval harness `scripts/eval.mjs`
(count/timeout/concurrency/taskType/payload args — **measured** this pass,
see Verification matrix); ENS resolution at `/.well-known/ens?name=`
(`ENS_RPC` — address/text/resolver plus EIP-1577 `contenthash` decode to
IPFS CIDv1 via `contentHashToCid`, gateway URL through `IPFS_GATEWAY_URL`,
honest 501 unconfigured); committee voting with signed ballots (P4).
Committee upgraded to **2-phase BFT-lite**: motions flow prevote → precommit
→ committed/failed with quorum at each phase; ballots sign
`chimera-vote:<id>:<phase>:<yes|no>` (phase-bound, so a prevote can't
replay as a precommit); one vote per voter per phase; verified live against
a forged ballot, unsigned ballot, cross-phase replay, and post-commit
replay (`committee-test.mjs` 18/18). **Cross-deployment BFT shipped** —
proposals carry a roster snapshot (top-`COMMITTEE_SIZE` voters by weight,
quorum = floor(W/3)+1 over the snapshot) and are replicated to
`COMMITTEE_PEERS` replicas (POST `/committee/replicate`, `FEDERATION_TOKEN`
Bearer). Every signature-valid ballot is gossiped (`/committee/ballot`) —
including equivocation evidence, so a Byzantine double-vote convicts the
voter on *all* replicas, not just the first to see it. Each replica
verifies signatures against its own DID bindings and computes its own QC;
future-phase ballots buffer instead of dropping; equivocators are purged
and tallies recomputed. Verified live: two independent `wrangler dev`
deployments with separate `--persist-to` storage both committed a motion
independently, QCs satisfied quorum with intersecting signer sets (safety),
and a cross-replica equivocation was convicted on both
(`committee-federated-test.mjs` 15/15). Remaining limit: federation is
configured-peer replication, not open membership — peers are trusted
endpoints, so this is multi-deployment BFT within one operator's fleet or
between mutually-registered deployments, not a public validator set.
**Privacy Pass (RFC 9578) shipped** —
`@cloudflare/privacypass-ts` origin-side redemption; anonymous `/jobs`
accepts `Authorization: PrivateToken token=…` verified against
`PRIVACYPASS_ISSUER_KEY`, replay-protected via `pptoken:<sha256>`;
round-trip issue→redeem proven in tests (3/3 — valid accepted, wrong
issuer/malformed rejected). **INTERNAL classification lane shipped** —
`classificationOk` accepts INTERNAL (SECRET rejected); `selectVolunteer`
restricts INTERNAL jobs to `durable && did`-bound volunteers;
`/v1/chat/completions` accepts `classification:"INTERNAL"`; delta-git maps
`visibility:"internal"` → INTERNAL (members-only repos, member-gated like
private everywhere, pool-eligible; CHECK constraint extended via migration
0027). **Operator rollup** `GET /operator?did=` aggregates all volunteerIds
bound to a DID (rep, jobs, ledger, per-node online). **Rep-weighted jury
tally** — group adjudication weighs each sibling's result by accrued rep
(min 1) instead of one-vote-each. **x402 settle** — verified
EIP-3009 authorizations POST to `X402_FACILITATOR`/`settle` when a
facilitator is configured; otherwise `COORDINATOR_PRIVATE_KEY` broadcasts
the `transferWithAuthorization` itself (`settleX402Direct` →
`decodeEip3009Payment` in `chain.ts`, unit-tested); with neither,
payments remain verify-only (honest credit promise).
**Deterministic-replay prover shipped** — `scripts/prover.mjs` is an
independent service (separate process, independent re-executors — not a
code-share with the node) that re-runs completed jobs: 301 BUILD_VERIFY
inside its own probed sandbox (`bwrap`/`unshare`, no network), 300
SWARM_INFER via greedy-decode transformers.js on the same model. The
coordinator calls `PROVER_URL` per completed result under
`state.waitUntil` (no hibernate-lost writes); the signed artifact lands as
`execProof` on the result record and surfaces in `/verify`: reproduced
flag, claimed vs recomputed sha256, field-level diffs, prover DID +
ed25519 signature, isolation mode, timing. Payloads are stored on the
result record (resultToken-gated) so the prover fetches the I/O through a
scoped URL — it never receives raw payloads in the request.

## Phase 8 — Interop + provenance (PARTIAL — groundwork)

Done: `/passport` signed rep attestations; hash-chained `/audit` export;
**signed result proofs + `/verify/<jobId>` provenance bundle** — DID-bound
nodes sign `chimera-result:<jobId>:<sha256(result)>` (ed25519/EIP-191 by
DID scheme), verified eagerly and stored on the result record; bad sigs
audit `result.bad-sig` and store `verified:false` rather than being
trusted; `/verify` returns dispatch provenance, resultHash, DID, sig,
verification status, and the scheme labels; **did:key agent interop
end-to-end** (register → dispatch → signed result → /verify — exercised
live by `durable-node.mjs` + `committee-test.mjs`); **disaster-recovery
drill `GET /drill`** (admin) — recomputes the audit hash chain and
reconciles ledgers vs recorded credits, reports `intact`/`brokenAt` and
inconsistent rows; eval-corpus in delta-git is **wired end-to-end** —
`eval_corpus` written per public adjudication, `markEvalOutcome` backfills
on quorum-merge (`agent.ts`), PR close (`pullreqs.ts` ×2), and intent
reject (`apiv3.ts`); read surface `GET /api/v1/repos/{ref}/+/eval`
(visibility-gated; private repos 404 before the surface runs);
`sanitizePoolResult` on pool output; `GET /api/dg/leaderboard`.
**Dispute game shipped** — `POST /challenge` implements optimistic
verification (the opML mechanism): a DID-bound challenger signs
`chimera-challenge:<jobId>:<counterHash>`; the coordinator asks the prover
to re-execute and adjudicates on the recomputed hash (byte-exact or
field-level semantic match). Challenger wins → result producer slashed;
result stands → challenger slashed (`CHALLENGE_SLASH`, default 10 rep).
Guards live: signed challenges only, one challenge per result,
challengers with zero rep can't trigger paid re-execution. Verified
end-to-end (`challenge-test.mjs` 13/13): fabricated BUILD_VERIFY result
auto-proven `reproduced:false` → challenger-wins → liar slashed; honest
SWARM_INFER byte-exact `reproduced:true` → false challenge →
result-stands → challenger slashed; forged signature and double-challenge
rejected. Honest scope: deterministic replay is the dispute oracle for
deterministic task types — it attests "re-running produced/didn't produce
this output", not a zk proof of execution.
**Competitor baseline measured** — `scripts/ollama-bench.mjs` runs the
same workload (same prompt, max_tokens, greedy, ~0.5B instruct) through
Ollama (llama.cpp GGUF), direct transformers.js (the swarm's executor),
and the pool dispatch lane. See the verification matrix.

## Verification matrix (this pass)

| Repo | Check | Result |
|---|---|---|
| coordinator | `npm run typecheck` | clean |
| coordinator | `vitest run` | 46/46 (incl. didkey 9/9: round-trip, forgery, malformed, contenthash→CIDv1) |
| coordinator | live: `/admin/tokens` create→scope→revoke; secretlint deep-lint rejects a regex-clean SendGrid key | pass |
| coordinator | live swarm tier: `durable-node.mjs` registered `durable:true` + did:key; 301 → sandboxed subprocess w/ artifact hashes + `verified:true` result proof; 300 → real Qwen2.5-0.5B inference (transformers.js), proof verified; `curl` cmd rejected by BUILD_ALLOWLIST | pass |
| coordinator | Byzantine committee: `committee-test.mjs` — 5 did:key voters, 4 honest ballots weighted-counted, forged 403, unsigned 400, replay 409 | **10/10 pass** |
| coordinator | `/verify/<jobId>` provenance bundle; `/drill` (audit chain intact, ledgers consistent); `/jobs` anonymous gate fails closed (401 w/o TURNSTILE_SECRET) | pass |
| coordinator | benchmark `eval.mjs` vs wrangler dev + 1 durable node: 301×10 conc-4 → 10/10, p50 256ms, p95 663ms, 9.09 jobs/s; 300×6 conc-2 → 6/6, p50 2375ms (CPU, warm Qwen2.5-0.5B), 0.61 jobs/s; 200×4 no supply → 0/4 honest `accepted:false` ~50ms, queued pending | measured |
| coordinator | **2-phase committee live**: 4 prevotes → precommit at quorum; 4 precommits → committed; forged precommit 403; unsigned 400; cross-phase prevote 409; post-commit replay 404 | 18/18 pass |
| coordinator | **ENS live** via `ENS_RPC=ethereum.publicnode.com`: vitalik.eth → real addr + EIP-1577 contenthash → CIDv1; brantly.eth → addr+text, null contenthash | pass |
| coordinator | **multi-shard live** `SHARD_COUNT=2`: `?project=alpha`→project-1 DO (1 volunteer visible), project-0+global show 0 — isolated registries | pass |
| coordinator | **INTERNAL gate live**: INTERNAL job → dispatched to durable+did:key node only (visitor never saw dispatch); PUBLIC → visitor; SECRET → 400 | pass |
| coordinator | **SSE live**: `stream:true` → `text/event-stream`, `chat.completion.chunk` deltas + `[DONE]` | pass |
| coordinator | **operator rollup live**: `/operator?did=` aggregates bound nodes w/ online status | pass |
| coordinator | **Privacy Pass**: full RFC 9578 issue→redeem round-trip; wrong-issuer + malformed rejected | 3/3 |
| coordinator | **direct-inference baseline** (same Qwen2.5-0.5B, in-process): p50 2032ms, 0.53 jobs/s → pool adds ~370ms coordination overhead (~18%) | measured |
| coordinator | **federated BFT** `committee-federated-test.mjs` — 2 wrangler deployments, isolated `--persist-to`: proposal replicated w/ roster snapshot; B converged via gossip alone; both replicas committed independently; both QCs satisfy quorum + intersect (safety); equivocation convicted on BOTH replicas via evidence gossip; post-purge quorum recommits; forged ballot rejected cross-deployment | **15/15 pass** |
| coordinator | **dispute game** `challenge-test.mjs` — liar's fabricated 301 auto-proven `reproduced:false` → `/challenge` challenger-wins → liar slashed to 0; honest 300 inference byte-exact `reproduced:true` → false challenge → result-stands → challenger slashed; forged sig + double-challenge + zero-rep griefing all rejected | **13/13 pass** |
| coordinator | **competitor baseline + engine fix** `ollama-bench.mjs` (same prompt/max_tokens=8/greedy, ~0.5B instruct): Ollama qwen2.5:0.5b cold 4653ms (load 4392), warm p50 47ms; transformers.js ONNX direct warm p50 509ms; **the gap is closed at the engine layer — the durable node prefers a reachable local Ollama/llama.cpp daemon (`OLLAMA_URL`/`OLLAMA_MODEL`, `INFER_ENGINE=auto|ollama|onnx`), reports `engine` on JOB_RESULT, and the prover replays on the SAME engine**: pool end-to-end via llama.cpp **p50 57ms** (~10ms coordination overhead over raw Ollama; ~40× faster than the ONNX pool lane). Engine is declared by the node and verified by replay — claiming a different engine produces a mismatch by construction | **measured, gap closed** |
| coordinator | `tests/x402.test.ts` — `decodeEip3009Payment` round-trips a real viem signature into v/r/s + auth fields; malformed base64/missing fields/truncated sig rejected | 3/3 |
| coordinator | vitest | **53/53** (didkey 9, registry 22, lint 16, privacypass 3, x402 3) |
| extension | infer lane — `npm run build` produces `vendor/wllama-page.js` + `vendor/wllama.wasm` (esbuild, 320KB + 8.5MB); manifest `type:"module"` for MV3 dynamic import; absent bundle → taskType 200 silently unclaimed | pass |
| extension | **wllama lane** (llama.cpp → WASM, `taskType 200` — the no-install browser engine) — `wllama-page.html` offscreen doc under manifest COOP/COEP (`require-corp`/`same-origin`) → `crossOriginIsolated` → threaded JSPI build only; GGUF `loadModelFromUrl` (default `Qwen2.5-0.5B-Instruct-GGUF` q4_k_m — same model/format as the durable Ollama lane); `engine` reported on JOB_RESULT. Measured on Node harness (compat build only — Node lacks memory64/JSPI): warm p50 1374ms vs ONNX-direct 509ms — compat is *slower*, so it and the transformers.js lane were **removed** rather than shipped as fallbacks; the lane engages only where the threaded build can run, else taskType 200 is unclaimed. Real-device threaded/WebGPU numbers pending a browser run | built; fallback-free |
| coordinator | **bwrap/unshare net isolation**: `fetch()` inside sandboxed BUILD_VERIFY → `NET:isolated` (both modes probed live on host) | pass |
| wp-cloud | `npm run typecheck` | clean |
| wp-cloud | `node --test` | sync test green (plugin ↔ public script) |
| delta-git | `npm run typecheck` | clean (worker + gitness `tsc -b`) |
| delta-git | worker tests | compute-pool 9/9 (incl. `/+/eval` public read + private hidden), adjudication 4/4, leaderboard 1/1, rep-cert 3/3, agent-surface 6/6 |
| delta-git | `pool-sanitize.test.ts` (node) | 6/6 (incl. SSE consumer: assemble, onDelta, garbled/split chunks) |
| delta-git | internal visibility | `internal` repos: member-gated (anonymous 404), pool-eligible via INTERNAL classification; migration 0027 extends CHECK |
| delta-git | `npm run build` | green — `power.js` ships in `dist/client` |

Live smoke (wrangler dev): coordinator `/status`, `/jobs` auth-gate,
`/admin/tokens` lifecycle, visitor WS loop + `/v1/chat/completions`
round-trip (JSON + SSE), durable-node WS loop + 300/301 dispatch → signed
results → `/verify`, `/operator?did=` rollup, `/drill`; delta-git
`+/pool`, `+/eval`, `/badge/community`, `/power.js`, dispatch-route
auth/visibility gates (public 503 unconfigured, internal 503, private 403).

Remaining honest limits (operational, not structural): the BFT federation
is configured-peer replication between deployments that share
`FEDERATION_TOKEN` — Byzantine *replicas* themselves are not yet slashed
(peer auth is symmetric secret, not quorum-of-operators); deterministic
replay covers deterministic task types (301 builds, 300 greedy-decode
inference) — sampling-based or IO-dependent tasks would need a different
proof regime; the prover must run the same model/quantization the node ran
(TRANSFORMERS_MODEL/OLLAMA_MODEL alignment) or honest results
false-negative; the engine tag is unauthenticated metadata — a node
claiming the wrong engine is caught by replay, but a payload could pin
`engine:onnx` to force the slow path; x402 direct settlement needs a
funded `COORDINATOR_PRIVATE_KEY` wallet on Base; Privacy Pass needs
`PRIVACYPASS_ISSUER_KEY`; ENS gateway serving needs `IPFS_GATEWAY_URL` +
reachable swarm fetcher.
