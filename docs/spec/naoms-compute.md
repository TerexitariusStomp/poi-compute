# NAOMS ↔ PoI Compute — Shared Specification

**Status:** draft v0.2 — delegates: Terex (PoI/LocalChimera), Mujo
(NAOMS). Both signatures required for changes.
**License:** CC BY 4.0. Implementations stay separate; only this spec is
shared.
**Transport:** signed DIDComm messages over iroh (QUIC), through the
NAOMS execution package. No HTTP surface, no bearer tokens.

v0.2 adopts the resolutions in the NAOMS-side design document
"NAOMS × PoI Compute Bridge · v1.0" (erex, 2026-10-15): account links,
usage-metered receipts, the dispute model, and single-payee settlement.
Remaining OPENs are marked.

The table of contents is the open-questions list, settled or open.

---

## 1. Identities & roles

- Node identity: `did:key` (ed25519) on both sides. It is the ONLY
  signing identity on the hive side — `did:pkh` / `did:ethr` are refused
  at the shared check.
- Bridge identity is **hive-issued** via the capability grant's
  `subjectDid` — never self-declared.
- Lender identity is hive-issued; appears on receipts as `lenderDid`.

### 1a. Account links (EOA participation)

An Ethereum account participates through a **link record**, never by
signing hive records directly:

- `AccountLink` statement fields: `{didKey, hiveDid, account (CAIP-10),
  purpose, nonce, expiry}`.
- `purpose` is `node` (an account-controlled device behind a bridge) or
  `payout` (a member's withdrawal address).
- Dual signature, like receipts: the EOA signs the statement in a
  standard Ethereum format (EIP-712, or EIP-191 as PoI already uses);
  the `did:key` countersigns the same digest. The hive records the link.
- Either side can sign an unlink record at any time.
- A link is an alias for payment and accountability. The linked account
  **never signs anything in NAOMS** — all records stay single-key-type.
- The bridge remains the one accountable identity (the grant's
  `subjectDid`). PoI's EOA nodes appear **behind** the bridge as linked
  accounts with purpose `node` — they are not individually authorized.

## 2. Capability grants

- `CapabilityGrant`: `{id, issuerHiveDid, subjectDid, lanes[], expiresAt, issuerSig}`.
- Signed by the hive; bound to the caller's node key; expiring.
- Scope: which lanes/task-types the grant opens, per-hive.
- Renewal: `acquireCapability` again before expiry — no sliding session.

## 3. Revocation

- Signed `RevocationEvent` gossiped between peers: `{grantId, issuerHiveDid, revokedAt, issuerSig}`.
- Bridges check the event stream on every dispatch — revoked grants die
  mid-flight, not at reconnect.
- OPEN: event transport detail (DIDComm message type vs. peer pubsub).

## 4. Job envelope (inward: bridge → hive)

Fields: `bridgeJobId`, `taskType`, `payload`, `classification` (PUBLIC
only — enforced), `modelClass?`, `deadline?`, `repro?`, `paid`.
Explicitly absent: consumer identity, `amountWei`, site tags, any
marker distinguishing test traffic. **Amounts never cross in an
envelope — they arrive only in the settlement statement (§8).**
`repro` is the dispatch-time replay request (§6, §10): the receipt
commits the parameters actually used.

## 5. Task-type ↔ lane map

PoI taxonomy (canonical 0–3, wp-cloud 100–103, project 200–206, swarm
300–301) ↔ hive-advertised lanes (`inference`, `fetch`, `jury`, …).
OPEN: whether hives ever open swarm lanes; durable-tier criteria.

## 6. Receipts

- `SignedReceipt` signs a canonical, domain-separated digest:
  `sha256("naoms-compute-receipt/v1" || 0x00 || canonicalJSON(fields))`.
- Committed fields: `bridgeJobId, lenderDid, inputHash, outputHash,
  engine?, usage?, repro?, executedAt` — plaintext `result` is NOT
  committed, so the digest survives forgetting.
- `usage`: `{unit: "tokens" | "seconds", amount}` — metering so pay can
  be priced against what was really done.
- `repro`: the replay parameters the lender actually used — `{mode:
  "exact" | "deterministic" | "none", seed?, decoding?,
  engineVersion?}`. This is what a challenge replays under (§10).
- Dual signature: lender first, borrower (bridge) countersigns the same
  digest — prevents replay under a different grant.

## 7. Canaries

- PoI canaries (`taskType 206`, nonce echo) cross **unmarked**.
- NAOMS condition: hive rules must openly state that covert testing
  happens. The envelope never flags them — the obligation is in hive
  governance text, not the wire.
- OPEN: whether hive-level honesty measurement exists in return.

## 8. Retention & settlement

- Default window: 7 days, then receipts reduce to hash commitments.
- `paid: true` → the commitment is retained past the window.
- NO full-receipt carve-out — the bridge keeps its own signed copy for
  the PoI dispute window. One exception: **a disputed receipt stays in
  full until the dispute closes** (§10).
- `SettlementStatement` — a signed periodic message from the bridge:
  `{period, entries: [{bridgeJobId, receiptDigest, amount, asset}],
  total, txHash, bridgeSig}`. The job envelope carries no amount, so
  this is the only message in which money crosses. The hive reconciles
  each statement against its own receipts and the on-chain transfer,
  and records `reconciled` or `mismatch` as a fact — not a judgement.

## 9. Economics

- Single payee: the **hive treasury Safe** (an Ethereum Safe), linked
  to the bridge's grant via an `AccountLink` with purpose `payout`.
  PoI's payout ledger credits the bridge identity; the bridge's payout
  address IS the treasury. Lenders are never paid by PoI directly.
- The lender ↔ treasury split is **hive-internal**: each hive votes its
  share, a minimum payout, and a payout rhythm through its own
  governance.
- Each receipt becomes a hive earnings entry: `{gross, hiveShare,
  lenderShare, state}` where `state ∈ pending | held | released |
  forfeited`. An entry stays `pending` until its challenge window
  closes (§10).
- Lender payout is the lender's choice: a batched payment from the Safe
  to their payout address once the minimum is reached, or a transfer on
  the hive's credit ledger. The hive's share stays in the Safe.

## 10. Failure & honesty semantics

- `JOB_REJECTED` equivalents: capacity, unsupported lane, bad grant.
- **Non-delivery** is a recorded fact: no countersigned receipt by the
  deadline → nothing is paid, and the lender's reliability record notes
  a miss. No one adjudicates.
- **Wrong result** is machine-checked by the bridge's replay prover.
  The bridge posts a signed `ChallengeResult`: `{receiptDigest,
  reproduced: false, attestationHash, counterHash, bridgeSig}`. The
  hive records it and holds the lender's share. The hive runs no prover
  of its own and **never overrides** the prover's verdict.
- **Member review:** the lender can ask the hive's members to review.
  Three members — never the lender — are drawn by the hive's verifiable
  sortition. They see structured evidence (receipt, attestation,
  counter-result), not free text. Uphold → held share returns to the
  treasury, lender reputation drops. Dismiss → share released,
  challenger reputation drops. Challenges are not free.
- **Time limits:** challenge within 72h of the receipt; member review
  within 4 days; everything closes inside the 7-day retention window.
- **Exposure cap:** no deposits in v1 — holding pay until the window
  closes is the exposure bound.
- **Replay determinism** (answer to NAOMS's question): the prover's
  guarantee is scoped by the committed `repro`, not asserted globally —
    - `exact`: hash equality of output. Covers fetch, storage proofs,
      and canary nonces — always challengeable.
    - `deterministic`: LLM lanes that commit `seed` + deterministic
      decoding (greedy / temperature-0) and `engineVersion`. The prover
      replays under identical parameters and decides equivalence with
      its per-task-type predicate — normalized exact match for text
      lanes, field-level comparison for structured results (this is
      what PoI's prover already returns as `reproduced: bool`).
    - `none` (or uncommitted): the prover never asserts semantic
      equivalence. Wrong-result challenges on these jobs reduce to
      structural validity — schema conformance and known-answer
      predicates. A lender disputing a semantic complaint on a
      `none` job goes straight to member review with structured
      evidence.
  So which jobs can be machine-challenged is decided at dispatch:
  `repro` is requested in the envelope and committed in the receipt.

## 11. Privacy invariants

- INTERNAL never crosses; SECRET rejected at PoI intake.
- Market data never crosses (§4) — amounts arrive only at settlement
  (§8), and only per-receipt, never per-consumer.
- What a lender can infer: task type, payload, timing — the spec should
  state this plainly rather than pretend it's opaque.

---

*Draft written by Terex's PoI implementation (`poi-compute`,
rad:z2yQjfF2eoGti9tyLfJxJU1NcdHn6). v0.2 resolves the §1 EOA, §6
usage, §8/§9 settlement, and §10 dispute questions per the NAOMS design
document of 2026-10-15. Remaining OPENs: revocation transport (§3),
swarm lanes (§5), hive-side honesty measurement (§7).*
