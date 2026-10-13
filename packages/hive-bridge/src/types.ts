/**
 * NAOMS-side wire types — the `/naoms/compute/1` protocol as documented in
 * the NAOMS ↔ LocalChimera overview (2026-10-13). These are OUR read of
 * that document, not vendored NAOMS code; fields marked [OPEN] in the doc
 * are represented honestly and gated in the adapter.
 */

/** Short-lived borrower permit — names the lender VRC and the live
 *  challenge. The bridge holds one per connected hive. */
export interface BorrowerPermit {
  /** Permit's own id (status-list indexable). */
  id: string
  /** VRC id of the lender role this bridge was delegated. */
  lenderVrcId: string
  /** Hive DID the permit is scoped to. */
  hiveDid: string
  /** Live status-list URL — the lender can revoke by flipping a bit. */
  statusListUrl: string
  /** Permit expiry (unix seconds). Bridge must re-present before it lapses. */
  expiresAt: number
  /** Lender signature over the permit body. */
  lenderSig: string
}

/** A hive-advertised capability set — what the pool will accept. */
export interface HiveCapabilities {
  /** Lanes the hive opens (maps onto PoI task types via LaneMap). */
  lanes: string[]
  /** Aggregate concurrency the hive advertises. */
  concurrency: number
  /** Model classes available ('instruct' | 'embedding' | 'fetch' | 'pin' | 'jury'). */
  modelClasses: string[]
}

/** Job envelope as sent inward to a hive lender. Deliberately narrower
 *  than the PoI JobEnvelope: no consumer identity, no payment details —
 *  the lender sees work + constraints, not the market. */
export interface NaomsJobEnvelope {
  /** Bridge-assigned id — correlates the receipt back to the PoI job. */
  bridgeJobId: string
  taskType: number
  payload: string
  /** PoI classification — INTERNAL jobs never cross the bridge. */
  classification: 'PUBLIC'
  modelClass?: string
  deadline?: number
  /**
   * [OPEN in the doc] canary pass-through: PoI canaries are covert by
   *  design, so the bridge deliberately does NOT mark them. This field
   *  exists only for tests proving nothing leaks — it is never set to
   *  true on a real dispatch. */
  canaryMarker?: false
  /**
   * [OPEN in the doc] retention: paid jobs need receipts that outlive
   *  NAOMS's default 7-day forgetting window. 'settlement' requests the
   *  carve-out; 'default' accepts hive retention. */
  retention: 'default' | 'settlement'
}

/** Dual-signed execution receipt returned by a hive lender. */
export interface DualSignedReceipt {
  bridgeJobId: string
  /** Lender DID that ran the job. */
  lenderDid: string
  /** Salted hashes — hive keeps the preimage, bridge keeps the hash. */
  inputHash: string
  outputHash: string
  /** The plaintext result — only present while retained; after hive
   *  forgetting, receipts carry hashes only. */
  result?: string
  /** Engine claim (mirrors PoI's engine field for the prover). */
  engine?: string
  /** Borrower (bridge) countersignature slot — filled by the bridge. */
  borrowerSig?: string
  lenderSig: string
  /** Timestamped execution window. */
  executedAt: number
}

export type LaneMap = Record<string, number[]>
