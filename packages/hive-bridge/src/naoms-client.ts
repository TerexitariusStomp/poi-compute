/**
 * NaomsClient — the bridge's view of a NAOMS hive.
 *
 * NAOMS code/protocol access isn't public, so this is an interface plus an
 * HTTP-shaped client for the documented `/naoms/compute/1` flow:
 *   permit → capabilities → submit(envelope) → receipt
 * plus a mock implementation used by tests until a live hive exists.
 */
import type { BorrowerPermit, HiveCapabilities, NaomsJobEnvelope, DualSignedReceipt } from './types'

export interface NaomsClient {
  /** Present VRCs and obtain a short-lived borrower permit. */
  acquirePermit(): Promise<BorrowerPermit>
  /** Live status-list check — false means the lender revoked. */
  permitValid(permit: BorrowerPermit): Promise<boolean>
  /** What the hive will run. */
  capabilities(permit: BorrowerPermit): Promise<HiveCapabilities>
  /** Submit one job; resolves with the dual-signed receipt. */
  submit(permit: BorrowerPermit, job: NaomsJobEnvelope): Promise<DualSignedReceipt>
}

/**
 * HTTP client for a live hive endpoint. The documented protocol is
 * message-based; concrete endpoints/serialization are [OPEN] — this
 * client implements the simplest honest mapping (JSON over HTTP POST)
 * and throws clearly when the hive speaks something else.
 */
export class HttpNaomsClient implements NaomsClient {
  constructor(
    private baseUrl: string,
    /** The bridge's own VRC chain it presents to the hive. */
    private credentials: { vrcIds: string[]; borrowerDid: string },
  ) {}

  async acquirePermit(): Promise<BorrowerPermit> {
    const res = await fetch(`${this.baseUrl}/naoms/compute/1/permit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(this.credentials),
    })
    if (!res.ok) throw new Error(`naoms permit failed: ${res.status}`)
    return (await res.json()) as BorrowerPermit
  }

  async permitValid(permit: BorrowerPermit): Promise<boolean> {
    const res = await fetch(permit.statusListUrl)
    if (!res.ok) return false
    // Status-list bit check — [OPEN] exact encoding; treat 200 + 'live' as valid.
    const body = (await res.json()) as { status?: string }
    return body.status === 'live'
  }

  async capabilities(permit: BorrowerPermit): Promise<HiveCapabilities> {
    const res = await fetch(`${this.baseUrl}/naoms/compute/1/capabilities`, {
      headers: { authorization: `Bearer ${permit.id}` },
    })
    if (!res.ok) throw new Error(`naoms capabilities failed: ${res.status}`)
    return (await res.json()) as HiveCapabilities
  }

  async submit(permit: BorrowerPermit, job: NaomsJobEnvelope): Promise<DualSignedReceipt> {
    const res = await fetch(`${this.baseUrl}/naoms/compute/1/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${permit.id}` },
      body: JSON.stringify(job),
    })
    if (!res.ok) throw new Error(`naoms submit failed: ${res.status}`)
    return (await res.json()) as DualSignedReceipt
  }
}
