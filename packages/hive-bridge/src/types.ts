/**
 * NAOMS-side types — corrected per the NAOMS authors (2026-10-14):
 * there is no `/naoms/compute/1` HTTP surface. All work runs as jobs
 * through the NAOMS execution package: signed DIDComm messages over
 * iroh (QUIC). These types model OUR side of that seam — the concrete
 * envelope/receipt/canary format is being written as a shared spec.
 */

/** Hive-issued capability — the bridge's identity AND authorization in
 *  one object. Never self-declared: issued by the hive, bound to the
 *  bridge's node key, signed, expiring. Revocation travels as signed
 *  events between peers (no status-list URL). */
export interface CapabilityGrant {
  /** Grant id — referenced by revocation events. */
  id: string
  /** Hive DID that issued this grant. */
  issuerHiveDid: string
  /** The node identity the hive issued to us — what the bridge presents
   *  as its DID on both sides of the seam. */
  subjectDid: string
  /** PoI task types / lanes the grant covers. */
  lanes: string[]
  /** Expiry (unix seconds). */
  expiresAt: number
  /** Issuer signature over the canonical grant hash. */
  issuerSig: string
}

/** Signed revocation event — delivered peer-to-peer; a grant the hive
 *  revoked shows up here, not in a status list. */
export interface RevocationEvent {
  grantId: string
  issuerHiveDid: string
  revokedAt: number
  issuerSig: string
}

/** Job envelope sent inward to the hive. Deliberately narrower than the
 *  PoI JobEnvelope: no consumer identity, no payment details — the
 *  lender sees work + constraints, not the market. */
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
   * Canaries cross UNMARKED (agreed with NAOMS: covert test jobs are
   * fine as long as hive rules openly state that testing happens).
   * This field exists only so tests can prove nothing leaks — it is
   * never set true on a real dispatch. */
  canaryMarker?: false
  /**
   * Retention per NAOMS: after the 7-day window only a hash commitment
   * of a paid job's receipt is kept — there is NO full-receipt carve-out.
   * `paid` marks the job so the commitment is retained; the BRIDGE keeps
   * its own receipt copy for the PoI dispute window. */
  paid: boolean
}

/** Execution receipt — signatures over a canonical, domain-separated
 *  digest (not colon-joined strings). See receipt-translate.ts. */
export interface SignedReceipt {
  bridgeJobId: string
  /** Hive-issued identity of the lender that ran the job. */
  lenderDid: string
  /** sha256 of the receipt's canonical body — what both signatures cover. */
  digest: string
  /** Salted commitment hashes — hive keeps the preimage. */
  inputHash: string
  outputHash: string
  /** Plaintext result — present only inside the retention window; after
   *  forgetting, receipts carry the commitment hashes only. */
  result?: string
  /** Engine claim (mirrors PoI's engine field for replay verification). */
  engine?: string
  /** Signatures over `digest` — lender first, bridge countersigns. */
  lenderSig: string
  borrowerSig?: string
  executedAt: number
}

export type LaneMap = Record<string, number[]>

/** What a hive will run under a grant — scoped to that capability. */
export interface HiveCapabilitySet {
  lanes: string[]
  concurrency: number
  modelClasses: string[]
}
