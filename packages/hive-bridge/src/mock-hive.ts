/**
 * MockHive — an in-process stand-in for a NAOMS hive, built from the
 * documented `/naoms/compute/1` behavior (permit → capabilities →
 * submit → dual-signed receipt). Exists so the adapter is testable and
 * the seam is concrete before real protocol access lands.
 */
import { createHash, randomBytes } from 'node:crypto'
import type { NaomsClient } from './naoms-client'
import type { BorrowerPermit, HiveCapabilities, NaomsJobEnvelope, DualSignedReceipt } from './types'

export interface MockHiveOptions {
  hiveDid?: string
  lanes?: string[]
  concurrency?: number
  /** Compute a result string from the submitted envelope. Default: echo. */
  handler?: (job: NaomsJobEnvelope) => string | Promise<string>
  /** After this many receipts, start returning hash-only (forgotten)
   *  receipts — exercises the retention edge. Default: never. */
  forgetAfter?: number
  /** Sign function for lender signatures (test key). */
  sign?: (msg: string) => Promise<string>
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export class MockHive implements NaomsClient {
  private permits = new Map<string, BorrowerPermit>()
  private revoked = new Set<string>()
  private receipts = 0
  readonly submitted: NaomsJobEnvelope[] = []
  /** Recorded envelopes — tests inspect what crossed the boundary. */

  private opts: Required<Omit<MockHiveOptions, 'sign'>> & { sign?: MockHiveOptions['sign'] }

  constructor(opts: MockHiveOptions = {}) {
    this.opts = {
      hiveDid: opts.hiveDid ?? 'did:mock:hive:test',
      lanes: opts.lanes ?? ['inference', 'fetch', 'jury'],
      concurrency: opts.concurrency ?? 4,
      handler: opts.handler ?? ((j) => `mock-result:${j.bridgeJobId}`),
      forgetAfter: opts.forgetAfter ?? Number.POSITIVE_INFINITY,
      sign: opts.sign,
    }
  }

  async acquirePermit(): Promise<BorrowerPermit> {
    const permit: BorrowerPermit = {
      id: `permit-${randomBytes(8).toString('hex')}`,
      lenderVrcId: 'vrc:lender:test',
      hiveDid: this.opts.hiveDid,
      statusListUrl: `mock://status/${randomBytes(4).toString('hex')}`,
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      lenderSig: 'mock-lender-sig',
    }
    this.permits.set(permit.id, permit)
    return permit
  }

  revoke(permitId: string): void {
    this.revoked.add(permitId)
  }

  async permitValid(permit: BorrowerPermit): Promise<boolean> {
    return this.permits.has(permit.id) && !this.revoked.has(permit.id) &&
      permit.expiresAt * 1000 > Date.now()
  }

  async capabilities(permit: BorrowerPermit): Promise<HiveCapabilities> {
    if (!(await this.permitValid(permit))) throw new Error('permit invalid')
    return { lanes: this.opts.lanes, concurrency: this.opts.concurrency, modelClasses: ['instruct'] }
  }

  async submit(permit: BorrowerPermit, job: NaomsJobEnvelope): Promise<DualSignedReceipt> {
    if (!(await this.permitValid(permit))) throw new Error('permit invalid')
    this.submitted.push(job)
    this.receipts++
    const result = await this.opts.handler(job)
    const forgotten = this.receipts > this.opts.forgetAfter
    const receipt: DualSignedReceipt = {
      bridgeJobId: job.bridgeJobId,
      lenderDid: `did:mock:lender:${randomBytes(4).toString('hex')}`,
      inputHash: sha256(job.payload),
      outputHash: sha256(result),
      ...(forgotten ? {} : { result }),
      engine: 'mock',
      lenderSig: this.opts.sign
        ? await this.opts.sign(`${job.bridgeJobId}:${sha256(result)}`)
        : 'mock-lender-sig',
      executedAt: Date.now(),
    }
    return receipt
  }
}
