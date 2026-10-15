/**
 * receipt-translate — bidirectional mapping between the PoI wire protocol
 * (@poi/node-core) and the NAOMS execution-package envelope/receipt
 * shapes. The boundary rules that matter:
 *
 *  - INTERNAL-classified jobs NEVER cross. The hive is a public pool;
 *    classification is enforced here, before the envelope exists.
 *  - Canary jobs cross UNMARKED — agreed with NAOMS: covert testing is
 *    fine as long as hive rules openly state that testing happens.
 *  - Market data does not cross: no consumer identity, no amountWei.
 *    `paid` is the only economic flag — NAOMS keeps hash commitments of
 *    paid receipts past the 7-day forgetting window; the bridge keeps
 *    its own full copy for PoI dispute purposes.
 *  - Receipts are signatures over a canonical, domain-separated digest —
 *    the bridge countersigns the same digest so the record is
 *    attributable both ways without leaking order-dependence.
 */
import { CANONICAL, PROJECT, WPCLOUD, validateJobResult } from '@poi/node-core/registry'
import type { JobEnvelope } from '@poi/node-core/envelope'
import { resultMessage } from '@poi/node-core/formats'
import type { NaomsJobEnvelope, SignedReceipt, LaneMap, ReproSpec } from './types'

/** Default taskType → lane grouping. Hives advertise lanes; the bridge
 *  only dispatches types the hive granted. */
export const DEFAULT_LANE_MAP: LaneMap = {
  inference: [CANONICAL.INFERENCE, WPCLOUD.INFER_TEXT, WPCLOUD.INFER_SEO, PROJECT.AGENT_INFER],
  storage: [CANONICAL.STORAGE],
  bandwidth: [CANONICAL.BANDWIDTH],
  compute: [CANONICAL.COMPUTE],
  research: [PROJECT.MARKET_RESEARCH, PROJECT.SOCIAL_COPY],
  fetch: [PROJECT.WEB_FETCH],
  jury: [PROJECT.HUMAN_JURY],
  // swarm lanes (300/301) intentionally absent — durable-tier jobs stay
  // on first-party durable nodes until hive durability criteria exist.
}

/** Task types whose output is byte/hash-deterministic — canary nonce
 *  echoes, fetches, pin/serve proofs. Their replay request is `exact`;
 *  anything else asks for `deterministic` execution (the lender commits
 *  the seed/decoding it actually used, or downgrades to `none`, which
 *  scopes challenges to structural validity only). */
const EXACT_TASKS = new Set<number>([
  PROJECT.CANARY,
  PROJECT.WEB_FETCH,
  CANONICAL.STORAGE,
  CANONICAL.BANDWIDTH,
])

export function reproRequestFor(taskType: number, override?: ReproSpec): ReproSpec {
  if (override) return override
  if (EXACT_TASKS.has(taskType)) return { mode: 'exact' }
  // Human judgement can't be re-executed — don't ask for determinism
  // we can't get; challenges here are structural/member-review only.
  if (taskType === PROJECT.HUMAN_JURY) return { mode: 'none' }
  return { mode: 'deterministic' }
}

export function laneForTaskType(taskType: number, map: LaneMap = DEFAULT_LANE_MAP): string | null {
  for (const [lane, types] of Object.entries(map)) {
    if (types.includes(taskType)) return lane
  }
  return null
}

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Domain separator + canonical field order for receipt digests.
 *  Signatures cover `sha256(SEP || canonical)` — no colon-joined
 *  ambiguity, no key-order dependence. */
const RECEIPT_DOMAIN = 'naoms-compute-receipt/v1\x00'

export function receiptCanonical(r: Omit<SignedReceipt, 'lenderSig' | 'borrowerSig' | 'digest'>): string {
  return JSON.stringify({
    bridgeJobId: r.bridgeJobId,
    lenderDid: r.lenderDid,
    inputHash: r.inputHash,
    outputHash: r.outputHash,
    engine: r.engine ?? null,
    usage: r.usage ?? null,
    repro: r.repro ?? null,
    executedAt: r.executedAt,
    // `result` is intentionally absent — the commitment is to the
    // outputHash, so the digest is identical after forgetting.
  })
}

export async function receiptDigest(r: Omit<SignedReceipt, 'lenderSig' | 'borrowerSig' | 'digest'>): Promise<string> {
  return sha256Hex(RECEIPT_DOMAIN + receiptCanonical(r))
}

/** Translate a dispatched PoI envelope into a NAOMS job. Throws on
 *  non-PUBLIC classification — dispatch code must check first; this is
 *  the belt-and-suspenders boundary assertion. */
export function toNaomsEnvelope(env: JobEnvelope): NaomsJobEnvelope {
  if (env.classification && env.classification !== 'PUBLIC') {
    throw new Error(`refusing to bridge ${env.classification} job ${env.jobId}`)
  }
  if (typeof env.taskType !== 'number' || typeof env.payload !== 'string' || !env.jobId) {
    throw new Error('incomplete dispatch envelope')
  }
  return {
    bridgeJobId: env.jobId,
    taskType: env.taskType,
    payload: env.payload,
    classification: 'PUBLIC',
    modelClass: env.modelClass,
    deadline: env.deadline,
    repro: reproRequestFor(env.taskType, (env as { repro?: ReproSpec }).repro),
    paid: !!(env.amountWei && BigInt(env.amountWei) > 0n),
  }
}

/** What the adapter hands back to the coordinator: the PoI JOB_RESULT
 *  fields plus the retained digest/commitments as evidence metadata. */
export interface BridgedResult {
  result: string
  /** The message the bridge signs — `chimera-result:<jobId>:<hash>`. */
  sigMessage: string
  resultHash: string
  engine?: string
  evidence: { digest: string; inputHash: string; outputHash: string; lenderDid: string; executedAt: number }
}

export async function toChimeraResult(receipt: SignedReceipt): Promise<BridgedResult> {
  if (receipt.result === undefined) {
    throw new Error(`receipt ${receipt.bridgeJobId} is commitment-only — past the retention window`)
  }
  const resultHash = await sha256Hex(receipt.result)
  return {
    result: receipt.result,
    sigMessage: resultMessage(receipt.bridgeJobId, resultHash),
    resultHash,
    engine: receipt.engine,
    evidence: {
      digest: receipt.digest,
      inputHash: receipt.inputHash,
      outputHash: receipt.outputHash,
      lenderDid: receipt.lenderDid,
      executedAt: receipt.executedAt,
    },
  }
}

/** Bridge countersignature over the canonical digest — binds the receipt
 *  to this borrower so a lender can't replay it under a different grant. */
export async function countersign(receipt: SignedReceipt, sign: (digestHex: string) => Promise<string>): Promise<SignedReceipt> {
  return { ...receipt, borrowerSig: await sign(receipt.digest) }
}

/** Re-validate a receipt's result against the PoI result schema before
 *  returning it — the bridge is the last trust boundary before credit. */
export function resultConforms(receipt: SignedReceipt, taskType: number): boolean {
  if (receipt.result === undefined) return false
  return validateJobResult(taskType, receipt.result)
}
