/**
 * HiveBridge — the adapter itself. Outward it is an ordinary PoI
 * volunteer (registers over the coordinator WS, claims the task types the
 * hive's granted lanes cover). Inward it is a NAOMS borrower — a node
 * holding a hive-issued CapabilityGrant.
 *
 * Identity rule (per the NAOMS authors): the bridge's DID is issued by
 * the hive in the grant, never self-declared — it is what we bind on the
 * PoI side too, so both directions carry the same accountable identity.
 *
 * Revocation: signed events between peers — `liveGrant()` re-checks the
 * event stream on every dispatch, so a revoked grant dies mid-flight,
 * not at the next reconnect.
 *
 * Scoping: the bridge registers with `site = hive:<hiveDid>` so
 * hive-tagged jobs dispatch hive-first, matching the coordinator's
 * existing site-preference + global-spillover cascade. A hive that
 * detaches simply stops receiving its tag — Wholeness preserved.
 */
import type { JobEnvelope } from '@poi/node-core/envelope'
import { bindMessage } from '@poi/node-core/formats'
import { PROJECT } from '@poi/node-core/registry'
import type { NaomsNode } from './naoms-node'
import type { CapabilityGrant, SignedReceipt } from './types'
import {
  DEFAULT_LANE_MAP,
  toNaomsEnvelope,
  toChimeraResult,
  countersign,
  resultConforms,
  type BridgedResult,
} from './receipt-translate'
import type { LaneMap } from './types'

export interface BridgeIdentity {
  /** Sign a message/digest with the bridge's node key — the key the
   *  hive binds the capability grant to. */
  sign: (msg: string) => Promise<string>
}

export class HiveBridge {
  private grant: CapabilityGrant | null = null
  private revokedIds = new Set<string>()
  private taskTypes: number[] = []

  constructor(
    private node: NaomsNode,
    private identity: BridgeIdentity,
    private laneMap: LaneMap = DEFAULT_LANE_MAP,
  ) {}

  /** Acquire the capability grant and learn the hive's capability set.
   *  The granted subjectDid becomes this bridge's identity. */
  async connect(): Promise<string> {
    this.grant = await this.node.acquireCapability()
    const caps = await this.node.capabilities(this.grant)
    this.taskTypes = caps.lanes.flatMap((lane) => this.laneMap[lane] ?? [])
    return this.grant.subjectDid
  }

  /** Grant hygiene — refresh when expired or when a signed revocation
   *  event names it. Re-checks the peer event stream each dispatch. */
  private async liveGrant(): Promise<CapabilityGrant> {
    if (!this.grant) throw new Error('bridge not connected')
    const events = await this.node.revocationEvents()
    for (const e of events) this.revokedIds.add(e.grantId)
    const dead = this.revokedIds.has(this.grant.id) ||
      this.grant.expiresAt * 1000 <= Date.now()
    if (dead) {
      this.revokedIds.clear()
      this.grant = await this.node.acquireCapability()
    }
    return this.grant
  }

  /** The REGISTER envelope this bridge presents to the coordinator. */
  async registerEnvelope(volunteerId: string): Promise<JobEnvelope> {
    if (!this.grant || !this.taskTypes.length) {
      throw new Error('connect() first — no capability grant / lanes')
    }
    return {
      type: 'REGISTER',
      volunteerId,
      did: this.grant.subjectDid,
      sig: await this.identity.sign(bindMessage(volunteerId)),
      taskTypes: this.taskTypes,
      capabilities: { hiveBacked: true, hive: this.grant.issuerHiveDid, concurrency: 1 },
      networks: [],
      site: `hive:${this.grant.issuerHiveDid}`,
      durable: false,
      shareData: false,
    }
  }

  /** One dispatched job → one signed receipt → one BridgedResult.
   *  Returns null for lanes outside the grant (caller requeues or lets
   *  the coordinator spill to the global pool). Throws on
   *  classification violations and on schema-nonconforming receipts. */
  async handleDispatch(env: JobEnvelope): Promise<BridgedResult | null> {
    // Canary (206) is a coordinator control job, not hive work — it must
    // cross regardless of lanes, or bridged nodes would be immune to the
    // honesty measurement that keeps the pool trustworthy.
    if (typeof env.taskType !== 'number' ||
        (env.taskType !== PROJECT.CANARY && !this.taskTypes.includes(env.taskType))) return null
    const grant = await this.liveGrant()
    const receipt = await this.node.submit(grant, toNaomsEnvelope(env))
    if (receipt.result === undefined) {
      throw new Error(`hive receipt for ${receipt.bridgeJobId} is commitment-only — past the retention window`)
    }
    if (!resultConforms(receipt, env.taskType)) {
      throw new Error(`hive receipt for ${receipt.bridgeJobId} fails PoI result schema`)
    }
    await countersign(receipt, this.identity.sign)
    return toChimeraResult(receipt)
  }

  /** Passthrough for tests/inspection: the lanes this grant opened. */
  openLanes(): string[] {
    return Object.entries(this.laneMap)
      .filter(([, types]) => types.some((t) => this.taskTypes.includes(t)))
      .map(([lane]) => lane)
  }
}

export type { SignedReceipt }
