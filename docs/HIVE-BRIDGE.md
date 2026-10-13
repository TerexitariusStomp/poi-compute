# Hive Bridge — NAOMS ↔ PoI Compute

`packages/hive-bridge` is the adapter seam between a NAOMS hive's lender
pool and the PoI coordinator. It exists so a hive can contribute compute
without either codebase absorbing the other — no NAOMS source is vendored,
no PoI internals leak into the hive.

## Topology

```
┌──────────┐  /jobs  ┌─────────────┐  REGISTER/WS  ┌────────────┐
│ consumer │ ──────► │ coordinator │ ◄──────────── │ hive-bridge│
└──────────┘         └─────────────┘  JOB_DISPATCH └─────┬──────┘
                                                        │ permit→
                                                        │ submit→
                                                        │ receipt
                                                   ┌────▼──────┐
                                                   │ NAOMS hive│
                                                   │  lenders  │
                                                   └───────────┘
```

Outward the bridge is an ordinary volunteer: it binds a `did:key`,
registers over the coordinator WebSocket, and receives `JOB_DISPATCH`
envelopes. Inward it is a NAOMS borrower per the documented
`/naoms/compute/1` flow: present VRCs → short-lived permit → capability
set → submit → dual-signed receipt.

## Scoping

The bridge registers with `site = hive:<hiveDid>`. The coordinator's
existing site-preference + global-spillover cascade does the rest:
hive-tagged jobs go hive-first; capacity overflow reaches the hive; a
hive that detaches simply stops receiving its tag.

## Boundary rules (enforced in `adapter.ts` / `receipt-translate.ts`)

- **INTERNAL jobs never cross.** `toNaomsEnvelope` throws on any
  non-PUBLIC classification.
- **Canaries cross unmarked.** `PROJECT.CANARY` bypasses lane filtering
  and `canaryMarker` is never set — covert honesty measurement requires
  indistinguishability at the boundary.
- **Market data does not cross.** No consumer identity, no `amountWei`,
  no site tags reach the lender.
- **Retention signal only.** Paid jobs (`amountWei > 0`) set
  `retention: 'settlement'` — a request that the receipt outlive the
  default forgetting window. Whether the hive honors it is [OPEN].
- **Results re-validate.** Receipts must satisfy the coordinator's
  per-taskType zod schema before the bridge returns them for credit.
- **Receipts are countersigned** (`borrowerSig`) so a lender can't replay
  a receipt to a different permit.

## Status

- `MockHive` implements the documented flow in-process; the 11-test suite
  covers registration scoping, boundary enforcement, retention flags,
  schema validation, and permit renewal.
- `HttpNaomsClient` is an honest stub for a live hive — the concrete
  `/naoms/compute/1` serialization is [OPEN] until NAOMS protocol access
  exists; it implements the simplest JSON-over-HTTP mapping and throws
  clearly on anything else.

## Open questions for the NAOMS authors

1. Canary pass-through policy — confirmed unmarked on their side?
2. Settlement retention vs. the 7-day default forgetting window for
   paid work — is a carve-out mechanism real?
3. Bridged earnings: where do they land — lender, hive treasury, bridge
   operator? (Mirrors PoI's site-owner split.)
4. `/naoms/compute/1` concrete wire format (message framing, VRC
   presentation, status-list encoding).
5. License of `compute-commons` / the packages this interoperates with —
   NAOMS had no license at proposal time.
