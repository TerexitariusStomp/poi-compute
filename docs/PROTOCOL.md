# PoI Protocol

The canonical definitions live in `packages/node-core` — this document is
the human-readable spec. When they disagree, the code is right; file a bug.

## Transports

| Transport | Direction | Purpose |
|---|---|---|
| WebSocket `/volunteer` | coordinator ⇄ node | registration, dispatch, results |
| HTTP `POST /jobs`, `/jobs/batch` | consumer → coordinator | job submission |
| HTTP `GET /results/<id>?token=` | consumer ← coordinator | result fetch |
| HTTP `POST /v1/chat/completions` | consumer → coordinator | OpenAI-compat inference |
| HTTP misc | ops | `/status` `/metrics` `/services` `/settle{,/prepare}` `/blobs` `/site/<name>` `/verify/<jobId>` `/audit` `/drill` |

## Task-type taxonomy

| Range | Lane | Types |
|---|---|---|
| 0–3 | canonical | INFERENCE 0, STORAGE 1, COMPUTE 2, BANDWIDTH 3 |
| 100–103 | wp-cloud | INFER_TEXT 100, INFER_SEO 101, MODERATE 102, SUPPORT 103 |
| 200–206 | project pool | AGENT_INFER 200, MARKET_RESEARCH 201, REPO_INDEX 202, SOCIAL_COPY 203, HUMAN_JURY 204, WEB_FETCH 205, CANARY 206 |
| 300–301 | swarm (durable-gated) | SWARM_INFER 300, BUILD_VERIFY 301 |

Out-of-range claims collapse to 0. Swarm types require `durable: true` at
REGISTER *and* dispatch. `CANARY` is a coordinator control job — nodes
echo the nonce; it bypasses lane filtering everywhere (including the
hive bridge) and is never marked.

## Envelope (`JobEnvelope`, `node-core/src/envelope.ts`)

One JSON object per WS message; `type` discriminates.

- `REGISTER`: volunteerId, address?, did?, sig, taskTypes, capabilities,
  networks, site?, project?, referrer?, durable?, shardCapacity?,
  shareData?
- `JOB_DISPATCH`: jobId, taskType, payload, amountWei?, classification?,
  difficulty?, domain?, modelClass?, priority?, deadline?, dispatchSig?
- `JOB_RESULT`: jobId, result, resultSig?, engine?
- `JOB_REJECTED`: jobId, reason
- `HEARTBEAT`/`EXIT`: status housekeeping; EXIT releases assignments
  for redispatch instead of timing out.

## Signing formats (`node-core/src/formats.ts`)

| Message | Signed by | Format |
|---|---|---|
| register bind | node | `chimera-bind:<volunteerId>` |
| dispatch auth | coordinator | `chimera-job:<jobId>` |
| result proof | node | `chimera-result:<jobId>:<sha256(result)>` |
| committee ballot | voter | `chimera-vote:<motionId>:<phase>:<yes|no>` |
| challenge | challenger | `chimera-challenge:<jobId>:<counterHash>` |

Node identity is `did:key` (ed25519, self-certifying — the DID *is* the
key) or an EOA (EIP-191). Coordinator dispatch signatures are EIP-191 and
verify against `GET /pubkey`. Nodes SHOULD verify dispatches
(`VERIFY_DISPATCH` on by default in durable-node).

## Dispatch policy

`selectVolunteer` (node-core `registry.ts`): heartbeat-alive (<60s),
taskType claimed, `trust > -15` killswitch (three failed canaries),
durable-gate for ≥300, `durable && did` for `classification:INTERNAL`,
then site → project preference cascade, idle-first, capability score.
`difficulty >= 2` filters to `HARD_JOB_MIN_SCORE` (15) when capable nodes
exist.

## Result schemas

Per-taskType zod schemas (`PROJECT_JOB`): pin `{cid, verified:true}`,
serve `{served:true, bytes}`, research `{summary}`, index `{vectors}`,
copy `{drafts[]}`, fetch `{bodyHash, bytes}`, jury `{verdict, rationale?}`,
inference is free-form non-empty text. Schema-less types pass through.

## Settlement

Micro-USDC throughout. `/settle` marks ledgers (monthly runbook);
`/settle/prepare` returns the statement without committing. Balances
under `MIN_PAYOUT_WEI` dust-convert to rep. Awards use a pending→
auto-credit window with `/award/<ref>/approve` early admin release.
x402: EIP-3009 `transferWithAuthorization` via `X402_FACILITATOR` or
direct broadcast by `COORDINATOR_PRIVATE_KEY`; verify-only otherwise.

## Trust machinery

- **Canaries**: covert nonce-echo probes; fabricated results cost rep
  (−5 each, killswitch at ≤−15).
- **Prover**: independent deterministic-replay service (`packages/prover`),
  attests `reproduced:true|false` per result → `execProof` on `/verify`.
- **Challenge**: `/challenge` optimistic dispute — prover adjudicates,
  loser slashed `CHALLENGE_SLASH`.
- **Committee**: 2-phase signed ballots (prevote→precommit→committed),
  quorum over a roster snapshot, cross-deployment gossip
  (`/committee/replicate`, `/committee/ballot`) with equivocation
  conviction on all replicas.
- **Reputation**: performed-labor channel (full weight) vs provisioned
  channel (diminished); non-transferable; `/passport` exports a signed
  attestation.

## Classification

`PUBLIC` (default) dispatches anywhere. `INTERNAL` dispatches only to
durable + DID-bound nodes and never crosses the hive bridge.
`SECRET` is rejected at intake.
