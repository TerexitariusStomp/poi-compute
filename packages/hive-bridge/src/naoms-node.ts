/**
 * NaomsNode — the bridge's handle on a NAOMS hive.
 *
 * Corrected model (per the authors, 2026-10-14): a hive is reached as a
 * NAOMS node over iroh (QUIC), running jobs through the NAOMS execution
 * package as signed DIDComm messages. There is no HTTP surface and no
 * bearer tokens — so the bridge either embeds a node or talks to a local
 * one. This interface models that seam; `LocalNaomsNode` is the honest
 * stub pending real protocol access.
 */
import type { CapabilityGrant, RevocationEvent, HiveCapabilitySet, NaomsJobEnvelope, SignedReceipt } from './types'

export interface NaomsNode {
  /** Present our credentials (VRC chain + node key); the hive returns a
   *  signed CapabilityGrant — or rejects. The granted subjectDid becomes
   *  the bridge's identity on BOTH sides of the seam. */
  acquireCapability(): Promise<CapabilityGrant>
  /** Signed revocation events observed from peers. The adapter treats
   *  the grant as dead as soon as a valid event names it. */
  revocationEvents(since?: number): Promise<RevocationEvent[]>
  /** What the hive will run under this grant. */
  capabilities(grant: CapabilityGrant): Promise<HiveCapabilitySet>
  /** Submit one job; resolves with the signed receipt. */
  submit(grant: CapabilityGrant, job: NaomsJobEnvelope): Promise<SignedReceipt>
}

/**
 * LocalNaomsNode — talks to a NAOMS daemon on this machine (the bridge
 * is not itself a NAOMS node until the shared spec lands). Transport is
 * intentionally narrow: a local socket/IPC to `naomsd`, or an embedded
 * runtime when NAOMS ships a library. Throws clearly until wired.
 */
export class LocalNaomsNode implements NaomsNode {
  constructor(
    /** e.g. unix:///run/naomsd.sock — transport TBD with the spec. */
    private endpoint: string,
  ) {}

  private unimplemented(): never {
    throw new Error(
      `naoms node at ${this.endpoint} not reachable — the DIDComm/iroh ` +
      `execution package isn't public yet; see docs/spec/naoms-compute.md`)
  }
  acquireCapability(): Promise<CapabilityGrant> { return this.unimplemented() }
  revocationEvents(): Promise<RevocationEvent[]> { return this.unimplemented() }
  capabilities(): Promise<HiveCapabilitySet> { return this.unimplemented() }
  submit(): Promise<SignedReceipt> { return this.unimplemented() }
}
