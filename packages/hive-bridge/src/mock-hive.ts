/**
 * MockNaomsNode — an in-process stand-in for a NAOMS node, updated to the
 * corrected model: hive-issued capability grants, peer-delivered signed
 * revocation events, and receipts signed over a canonical
 * domain-separated digest. Exists so the adapter is testable and the
 * seam is concrete before real iroh/DIDComm access lands.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { NaomsNode } from './naoms-node'
import type { CapabilityGrant, RevocationEvent, HiveCapabilitySet, NaomsJobEnvelope, SignedReceipt } from './types'
import { receiptDigest } from './receipt-translate'

export interface MockNaomsOptions {
  hiveDid?: string
  /** DID the hive issues to the bridge — hive-issued, never self-declared. */
  issuedDid?: string
  lanes?: string[]
  concurrency?: number
  /** Compute a result string from the submitted envelope. Default: echo. */
  handler?: (job: NaomsJobEnvelope) => string | Promise<string>
  /** After this many receipts, return commitment-only (forgotten)
   *  receipts — exercises the retention edge. Default: never. */
  forgetAfter?: number
  /** Sign function for the mock hive key (test only). */
  sign?: (digestHex: string) => Promise<string>
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export class MockNaomsNode implements NaomsNode {
  private grants = new Map<string, CapabilityGrant>()
  private revocations: RevocationEvent[] = []
  private receipts = 0
  readonly submitted: NaomsJobEnvelope[] = []
  /** Recorded envelopes — tests inspect what crossed the boundary. */

  private opts: Required<Omit<MockNaomsOptions, 'sign'>> & { sign?: MockNaomsOptions['sign'] }

  constructor(opts: MockNaomsOptions = {}) {
    this.opts = {
      hiveDid: opts.hiveDid ?? 'did:mock:hive:test',
      issuedDid: opts.issuedDid ?? 'did:mock:bridge-issued:test',
      lanes: opts.lanes ?? ['inference', 'fetch', 'jury'],
      concurrency: opts.concurrency ?? 4,
      handler: opts.handler ?? ((j) => `mock-result:${j.bridgeJobId}`),
      forgetAfter: opts.forgetAfter ?? Number.POSITIVE_INFINITY,
      sign: opts.sign,
    }
  }

  async acquireCapability(): Promise<CapabilityGrant> {
    const grant: CapabilityGrant = {
      id: `cap-${randomBytes(8).toString('hex')}`,
      issuerHiveDid: this.opts.hiveDid,
      subjectDid: this.opts.issuedDid,
      lanes: this.opts.lanes,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      issuerSig: 'mock-issuer-sig',
    }
    this.grants.set(grant.id, grant)
    return grant
  }

  /** Emit a signed revocation event for a grant — peer-delivered. */
  revoke(grantId: string): void {
    this.revocations.push({
      grantId,
      issuerHiveDid: this.opts.hiveDid,
      revokedAt: Date.now(),
      issuerSig: 'mock-revocation-sig',
    })
  }

  async revocationEvents(since = 0): Promise<RevocationEvent[]> {
    return this.revocations.filter((e) => e.revokedAt >= since)
  }

  private grantOk(grant: CapabilityGrant): boolean {
    return this.grants.has(grant.id) &&
      !this.revocations.some((e) => e.grantId === grant.id) &&
      grant.expiresAt * 1000 > Date.now()
  }

  async capabilities(grant: CapabilityGrant): Promise<HiveCapabilitySet> {
    if (!this.grantOk(grant)) throw new Error('capability invalid')
    return { lanes: this.opts.lanes, concurrency: this.opts.concurrency, modelClasses: ['instruct'] }
  }

  async submit(grant: CapabilityGrant, job: NaomsJobEnvelope): Promise<SignedReceipt> {
    if (!this.grantOk(grant)) throw new Error('capability invalid')
    this.submitted.push(job)
    this.receipts++
    const result = await this.opts.handler(job)
    const forgotten = this.receipts > this.opts.forgetAfter
    const unsigned = {
      bridgeJobId: job.bridgeJobId,
      lenderDid: `did:mock:lender:${randomBytes(4).toString('hex')}`,
      inputHash: sha256(job.payload),
      outputHash: sha256(result),
      ...(forgotten ? {} : { result }),
      engine: 'mock',
      // Committed metering + replay params (spec §6): the mock honors
      // the requested mode and reports fixed usage.
      usage: { unit: 'seconds' as const, amount: 1 },
      repro: job.repro ?? { mode: 'none' as const },
      executedAt: Date.now(),
    }
    const digest = await receiptDigest(unsigned)
    const receipt: SignedReceipt = {
      ...unsigned,
      digest,
      lenderSig: this.opts.sign ? await this.opts.sign(digest) : 'mock-lender-sig',
    }
    return receipt
  }
}

/** Back-compat alias — tests and docs may still say MockHive. */
export { MockNaomsNode as MockHive }
