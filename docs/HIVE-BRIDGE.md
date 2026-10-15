# Hive Bridge — NAOMS ↔ PoI Compute

`packages/hive-bridge` is the adapter seam between a NAOMS hive's lender
pool and the PoI coordinator. It exists so a hive can contribute compute
without either codebase absorbing the other — no NAOMS source is vendored,
no PoI internals leak into the hive.

## Protocol model (corrected 2026-10-14, per the NAOMS authors)

The `/naoms/compute/1` name in the original overview was a working title —
it does not exist. The real substrate:

- **A hive is reached as a NAOMS node over iroh (QUIC)** — signed DIDComm
  messages through the NAOMS execution package. No HTTP surface, no
  protocol port, no bearer tokens. The bridge either embeds a NAOMS node
  or talks to a local one (`LocalNaomsNode` stub — transport TBD by spec).
- **Authorization is a signed, expiring `CapabilityGrant`** bound to the
  bridge's node key — not a permit id passed as a bearer token.
- **The bridge's identity is hive-issued** (`grant.subjectDid`), never
  self-declared — and it is what the bridge binds on the PoI side too, so
  both directions carry one accountable identity.
- **Revocation travels as signed events between peers** — the adapter
  re-checks the event stream on every dispatch; a revoked grant dies
  mid-flight.
- **Receipts are signatures over a canonical, domain-separated digest**
  (`naoms-compute-receipt/v1` + canonical JSON — no colon-joined
  ambiguity, no key-order dependence). Lender signs, bridge countersigns
  the same digest.
- **Remote jobs are currently limited to an owner's own devices**;
  hive co-member lending ships next — the bridge is not on the critical
  path yet.

## Answered open questions (from the authors, 2026-10-14)

| Q | Answer | Consequence in code |
|---|---|---|
| Canaries | Covert test jobs are fine **if the hive's rules openly state that testing happens** | `PROJECT.CANARY` crosses unmarked; the disclosure obligation lives in hive rules, not the envelope |
| Retention | **No settlement carve-out** — after 7 days only a hash commitment of a paid job's receipt is kept | `paid` flag on the envelope; the bridge retains its OWN full receipt copy for PoI disputes; commitment-only receipts are rejected before credit |
| Economics | Split lender ↔ hive treasury, ratio set by the hive | Bridge reports earned `amountWei`; the split is hive-internal, never crosses |
| Wire format | Execution-package jobs over DIDComm/iroh — **jointly written spec, CC BY 4.0** | `docs/spec/naoms-compute.md` is the draft skeleton |
| License | NAOMS itself unlicensed (TBD); shared spec CC BY 4.0 | Bridge code stays AGPL-3.0 under PoI; spec is the shared artifact |

## Boundary rules (enforced in `adapter.ts` / `receipt-translate.ts`)

- **INTERNAL jobs never cross.** `toNaomsEnvelope` throws on any
  non-PUBLIC classification.
- **Canaries cross unmarked** — `canaryMarker` is never set.
- **Market data does not cross.** No consumer identity, no `amountWei`,
  no site tags. `paid` is the only economic signal.
- **Results re-validate** against the coordinator's per-taskType zod
  schema before the bridge returns them for credit.
- **Receipts are countersigned** over the canonical digest.
- **Digest stability across forgetting** — signatures commit to
  `outputHash`, not retained plaintext, so a commitment-only receipt
  still verifies (tested).

## Topology

```
┌──────────┐  /jobs  ┌─────────────┐  REGISTER/WS  ┌──────────────┐
│ consumer │ ──────► │ coordinator │ ◄──────────── │ hive-bridge  │
└──────────┘         └─────────────┘  JOB_DISPATCH └──────┬───────┘
                                                        │ grant →
                                                        │ submit →   (DIDComm/iroh,
                                                        │ receipt    signed msgs)
                                                   ┌─────▼───────┐
                                                   │ NAOMS node  │
                                                   │ → hive      │
                                                   └─────────────┘
```

The bridge registers with `site = hive:<hiveDid>`; the coordinator's
site-preference + global-spillover cascade does the rest.

## Status

- `MockNaomsNode` implements the corrected model in-process; the 11-test
  suite covers hive-issued identity, boundary enforcement, digest
  stability, schema validation, and event-driven revocation.
- `LocalNaomsNode` is the honest stub pending the shared spec + NAOMS
  execution-package access.
- Next step is document, not code: the joint spec
  (`docs/spec/naoms-compute.md` skeleton) hosted on Radicle, both
  delegates' signatures required for changes.
