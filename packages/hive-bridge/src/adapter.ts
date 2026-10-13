/**
 * HiveBridge — the adapter itself. Outward it is an ordinary PoI
 * volunteer (registers over the coordinator WS, claims the task types the
 * hive's lanes cover). Inward it is a NAOMS borrower (holds a permit,
 * submits envelopes, countersigns receipts).
 *
 * Scoping: the bridge registers with `site = hive:<hiveDid>` so
 * hive-tagged jobs dispatch hive-first, matching the coordinator's
 * existing site-preference + global-spillover cascade. A hive that
 * detaches simply stops receiving its tag — Wholeness preserved.
 */
import type { JobEnvelope } from '@poi/node-core/envelope'
import { bindMessage } from '@poi/node-core/formats'
import { PROJECT } from '@poi/node-core/registry'
import type { NaomsClient } from './naoms-client'
import type { BorrowerPermit, DualSignedReceipt } from './types'
import {
  DEFAULT_LANE_MAP,
  laneForTaskType,
  toNaomsEnvelope,
  toChimeraResult,
  countersign,
  resultConforms,
  type BridgedResult,
} from './receipt-translate'
import type { LaneMap } from './types'

export interface BridgeIdentity {
  /** Bridge's own did:key — also the volunteer DID on the PoI side. */
  did: string
  /** Sign a message string with the bridge's ed25519 key. */
  sign: (msg: string) => Promise<string>
}

export class HiveBridge {
  private permit: BorrowerPermit | null = null
  private taskTypes: number[] = []

  constructor(
    private client: NaomsClient,
    private hiveDid: string,
    private identity: BridgeIdentity,
    private laneMap: LaneMap = DEFAULT_LANE_MAP,
  ) {}

  /** Acquire a permit and learn the hive's capability set. */
  async connect(): Promise<void> {
    this.permit = await this.client.acquirePermit()
    const caps = await this.client.capabilities(this.permit)
    this.taskTypes = caps.lanes.flatMap((lane) => this.laneMap[lane] ?? [])
  }

  /** Permit hygiene — refresh when expired or revoked. */
  private async livePermit(): Promise<BorrowerPermit> {
    if (!this.permit) throw new Error('bridge not connected')
    const expired = this.permit.expiresAt * 1000 <= Date.now()
    if (expired || !(await this.client.permitValid(this.permit))) {
      this.permit = await this.client.acquirePermit()
    }
    return this.permit
  }

  /** The REGISTER envelope this bridge presents to the coordinator. */
  async registerEnvelope(volunteerId: string): Promise<JobEnvelope> {
    if (!this.taskTypes.length) throw new Error('connect() first — no hive lanes')
    return {
      type: 'REGISTER',
      volunteerId,
      did: this.identity.did,
      sig: await this.identity.sign(bindMessage(volunteerId)),
      taskTypes: this.taskTypes,
      capabilities: { hiveBacked: true, concurrency: 1 },
      networks: [],
      site: `hive:${this.hiveDid}`,
      durable: false,
      shareData: false,
    }
  }

  /** One dispatched job → one dual-signed receipt → one BridgedResult.
   *  Returns null for lanes the hive didn't open (caller should requeue
   *  or let the coordinator spill to the global pool). Throws on
   *  classification violations and on schema-nonconforming receipts. */
  async handleDispatch(env: JobEnvelope): Promise<BridgedResult | null> {
    // Canary (206) is a coordinator control job, not hive work — it must
    // cross regardless of lanes, or bridged nodes would be immune to the
    // honesty measurement that keeps the pool trustworthy.
    if (typeof env.taskType !== 'number' ||
        (env.taskType !== PROJECT.CANARY && !this.taskTypes.includes(env.taskType))) return null
    const permit = await this.livePermit()
    const receipt = await this.client.submit(permit, toNaomsEnvelope(env))
    if (receipt.result === undefined) {
      throw new Error(`hive receipt for ${receipt.bridgeJobId} is hash-only — already forgotten`)
    }
    if (!resultConforms(receipt, env.taskType)) {
      throw new Error(`hive receipt for ${receipt.bridgeJobId} fails PoI result schema`)
    }
    await countersign(receipt, this.identity.sign)
    return toChimeraResult(receipt)
  }

  /** Passthrough for tests/inspection: the lanes this hive opened. */
  openLanes(): string[] {
    return Object.entries(this.laneMap)
      .filter(([, types]) => types.some((t) => this.taskTypes.includes(t)))
      .map(([lane]) => lane)
  }
}

export type { DualSignedReceipt }
