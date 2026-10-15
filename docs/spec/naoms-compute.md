# NAOMS ↔ PoI Compute — Shared Specification

**Status:** draft skeleton — delegates: Terex (PoI/LocalChimera), Mujo
(NAOMS). Both signatures required for changes.
**License:** CC BY 4.0. Implementations stay separate; only this spec is
shared.
**Transport:** signed DIDComm messages over iroh (QUIC), through the
NAOMS execution package. No HTTP surface, no bearer tokens.

The table of contents is the open-questions list, settled or open.

---

## 1. Identities & roles

- Node identity: `did:key` (ed25519) on both sides.
- Bridge identity is **hive-issued** via the capability grant's
  `subjectDid` — never self-declared.
- Lender identity is hive-issued; appears on receipts as `lenderDid`.
- PoI side additionally tolerates EOA subjects (EIP-191) — spec should
  state whether hives accept EOA-bound bridges or require did:key only.

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
only — enforced), `modelClass?`, `deadline?`, `paid`.
Explicitly absent: consumer identity, `amountWei`, site tags, any
marker distinguishing test traffic.

## 5. Task-type ↔ lane map

PoI taxonomy (canonical 0–3, wp-cloud 100–103, project 200–206, swarm
300–301) ↔ hive-advertised lanes (`inference`, `fetch`, `jury`, …).
OPEN: whether hives ever open swarm lanes; durable-tier criteria.

## 6. Receipts

- `SignedReceipt` signs a canonical, domain-separated digest:
  `sha256("naoms-compute-receipt/v1" || 0x00 || canonicalJSON(fields))`.
- Committed fields: `bridgeJobId, lenderDid, inputHash, outputHash,
  engine?, executedAt` — plaintext `result` is NOT committed, so the
  digest survives forgetting.
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
  the PoI dispute window. Reconcile: PoI challenge deadlines must fit
  inside 7 days, or the bridge archives receipts itself.

## 9. Economics

- Bridged earnings split lender ↔ hive treasury; ratio set by the hive.
- PoI's site-owner analogue: `site = hive:<hiveDid>` rollup could route
  the hive share — spec should name whether the split happens on-hive
  or is accounted via the bridge's payout ledger.

## 10. Failure & honesty semantics

- `JOB_REJECTED` equivalents: capacity, unsupported lane, bad grant.
- Non-delivery vs. wrong-result: receipt absence vs. signature mismatch.
- OPEN: dispute surface on the NAOMS side (does a hive adjudicate, or is
  the bridge's signed receipt + PoI prover the whole story?).

## 11. Privacy invariants

- INTERNAL never crosses; SECRET rejected at PoI intake.
- Market data never crosses (§4).
- What a lender can infer: task type, payload, timing — the spec should
  state this plainly rather than pretend it's opaque.

---

*Draft written by Terex's PoI implementation (`poi-compute`,
rad:z2yQjfF2eoGti9tyLfJxJU1NcdHn6). Sections marked OPEN need joint
resolution before either side ships an implementation.*
