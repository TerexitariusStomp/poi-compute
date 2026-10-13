/**
 * receipt-translate — bidirectional mapping between the PoI wire protocol
 * (@poi/node-core) and the NAOMS `/naoms/compute/1` envelope/receipt
 * shapes. The boundary rules that matter:
 *
 *  - INTERNAL-classified jobs NEVER cross. The hive is a public pool;
 *    classification is enforced here, before the envelope exists.
 *  - Canary jobs pass through UNMARKED (canaryMarker is never set) —
 *    covert honesty measurement only works if the boundary doesn't leak.
 *  - Market data does not cross: no consumer identity, no amountWei.
 *    Retention is the only economic signal a lender sees ('settlement'
 *    flags receipts that must outlive the default forgetting window).
 *  - The bridge countersigns receipts (borrowerSig) so both directions of
 *    the record are attributable.
 */
import { CANONICAL, PROJECT, WPCLOUD, validateJobResult } from '@poi/node-core/registry'
import type { JobEnvelope } from '@poi/node-core/envelope'
import { resultMessage } from '@poi/node-core/formats'
import type { NaomsJobEnvelope, DualSignedReceipt, LaneMap } from './types'

/** Default taskType → lane grouping. Hives advertise lanes; the bridge
 *  only dispatches types the hive opened. */
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

export function laneForTaskType(taskType: number, map: LaneMap = DEFAULT_LANE_MAP): string | null {
  for (const [lane, types] of Object.entries(map)) {
    if (types.includes(taskType)) return lane
  }
  return null
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
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
    retention: env.amountWei && BigInt(env.amountWei) > 0n ? 'settlement' : 'default',
  }
}

/** What the adapter hands back to the coordinator: the PoI JOB_RESULT
 *  fields plus the retained receipt hashes as evidence metadata. */
export interface BridgedResult {
  result: string
  /** The message the bridge signs — `chimera-result:<jobId>:<hash>`. */
  sigMessage: string
  resultHash: string
  engine?: string
  evidence: { inputHash: string; outputHash: string; lenderDid: string; executedAt: number }
}

export async function toChimeraResult(receipt: DualSignedReceipt): Promise<BridgedResult> {
  if (receipt.result === undefined) {
    throw new Error(`receipt ${receipt.bridgeJobId} carries hashes only — already forgotten`)
  }
  const resultHash = await sha256Hex(receipt.result)
  return {
    result: receipt.result,
    sigMessage: resultMessage(receipt.bridgeJobId, resultHash),
    resultHash,
    engine: receipt.engine,
    evidence: {
      inputHash: receipt.inputHash,
      outputHash: receipt.outputHash,
      lenderDid: receipt.lenderDid,
      executedAt: receipt.executedAt,
    },
  }
}

/** Bridge countersignature — binds the receipt to this borrower so the
 *  lender can't replay it to a different permit. The exact signing scheme
 *  is [OPEN] on the NAOMS side; we sign the canonical fields with the
 *  bridge's ed25519 key (did:key, same identity as the PoI volunteer). */
export async function countersign(receipt: DualSignedReceipt, sign: (msg: string) => Promise<string>): Promise<DualSignedReceipt> {
  const body = `${receipt.bridgeJobId}:${receipt.inputHash}:${receipt.outputHash}:${receipt.executedAt}`
  return { ...receipt, borrowerSig: await sign(body) }
}

/** Re-validate a receipt's result against the PoI result schema before
 *  returning it — the bridge is the last trust boundary before credit. */
export function resultConforms(receipt: DualSignedReceipt, taskType: number): boolean {
  if (receipt.result === undefined) return false
  return validateJobResult(taskType, receipt.result)
}
