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

/** Replay parameters — requested on the envelope, committed on the
 *  receipt. Scopes what the bridge's replay prover may assert (spec §10):
 *    exact         — hash equality of output (fetch, canaries, storage)
 *    deterministic — replay under committed seed + greedy decoding;
 *                    equivalence is the prover's per-task-type predicate
 *    none          — no semantic replay; challenges reduce to
 *                    structural validity only
 */
export interface ReproSpec {
  mode: 'exact' | 'deterministic' | 'none'
  seed?: number
  decoding?: string
  engineVersion?: string
}

/** Usage metering committed on the receipt so pay can be priced against
 *  what was really done (spec §6). */
export interface UsageMeter {
  unit: 'tokens' | 'seconds'
  amount: number
}

/** Job envelope sent inward to the hive. Deliberately narrower than the
 *  PoI JobEnvelope: no consumer identity, no payment details — the
 *  lender sees work + constraints, not the market. Amounts NEVER cross
 *  here; they arrive only in the SettlementStatement. */
export interface NaomsJobEnvelope {
  /** Bridge-assigned id — correlates the receipt back to the PoI job. */
  bridgeJobId: string
  taskType: number
  payload: string
  /** PoI classification — INTERNAL jobs never cross the bridge. */
  classification: 'PUBLIC'
  modelClass?: string
  deadline?: number
  /** Dispatch-time replay request — the receipt commits the parameters
   *  the lender actually used. */
  repro?: ReproSpec
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
  /** Metered work — committed so settlement can price pay (spec §6). */
  usage?: UsageMeter
  /** Replay parameters actually used — what a challenge replays under. */
  repro?: ReproSpec
  /** Signatures over `digest` — lender first, bridge countersigns. */
  lenderSig: string
  borrowerSig?: string
  executedAt: number
}

/** EOA ↔ did:key link record (spec §1a). The EOA signs the statement in
 *  a standard Ethereum format (EIP-712, or EIP-191 as PoI uses); the
 *  did:key countersigns the same digest. The link is an alias for
 *  payment/accountability — the account never signs NAOMS records.
 *  Either side can sign an unlink record at any time. */
export interface AccountLink {
  /** Hive-issued did:key the account binds to. */
  didKey: string
  hiveDid: string
  /** CAIP-10 account, e.g. `eip155:8453:0x…`. */
  account: string
  /** `node` — a device behind the bridge; `payout` — a member or the
   *  bridge treasury withdrawal address. */
  purpose: 'node' | 'payout'
  nonce: number
  expiry: number
  /** EOA signature over the statement (EIP-712 or EIP-191). */
  accountSig: string
  /** did:key countersignature over the same digest. */
  didKeySig: string
}

/** Signed challenge posted by the bridge when its replay prover fails
 *  to reproduce a receipt's output (spec §10). The hive records it and
 *  holds the lender's share; the hive runs no prover of its own. */
export interface ChallengeResult {
  /** Digest of the challenged receipt. */
  receiptDigest: string
  /** Always false on a challenge — the prover could not reproduce. */
  reproduced: false
  /** Hash of the prover's attestation (replay parameters + verdict). */
  attestationHash: string
  /** Challenger's hash of the counter-result, if one exists. */
  counterHash?: string
  bridgeSig: string
}

/** One paid job inside a settlement statement. */
export interface SettlementEntry {
  bridgeJobId: string
  receiptDigest: string
  /** Amount in the asset's smallest unit (e.g. micro-USDC). */
  amount: string
  asset: string
}

/** Signed periodic statement from the bridge (spec §8/§9) — the ONLY
 *  message in which money crosses. The hive reconciles it against its
 *  own receipts and the on-chain transfer to the treasury Safe, then
 *  records `reconciled` or `mismatch` as a fact. */
export interface SettlementStatement {
  /** Settlement period identifier (e.g. ISO week or epoch window). */
  period: string
  entries: SettlementEntry[]
  /** Sum of entries, in the same asset. */
  total: string
  /** On-chain transfer to the hive treasury Safe covering this period. */
  txHash: string
  bridgeSig: string
}

export type LaneMap = Record<string, number[]>

/** What a hive will run under a grant — scoped to that capability. */
export interface HiveCapabilitySet {
  lanes: string[]
  concurrency: number
  modelClasses: string[]
}
