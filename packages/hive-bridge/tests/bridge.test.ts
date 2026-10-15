/**
 * Bridge contract tests — prove the boundary rules on OUR side under the
 * corrected NAOMS model (hive-issued capability grants over iroh/DIDComm,
 * signed event revocation, domain-separated receipt digests):
 *   - the bridge DID comes from the grant, never self-declared
 *   - canaries cross unmarked (covert testing is agreed, if hive rules
 *     openly state that testing happens)
 *   - INTERNAL jobs never cross
 *   - market data (consumer, amountWei) never crosses — only `paid`
 *   - commitment-only receipts (post-window) are rejected, not credited
 *   - results must satisfy the PoI schema before credit
 *   - revocation events kill a grant mid-flight
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { generateKeyPairSync, sign as edSign } from 'node:crypto'
import { HiveBridge } from '../src/adapter'
import { MockNaomsNode } from '../src/mock-hive'
import { toNaomsEnvelope, toChimeraResult, receiptDigest, receiptCanonical } from '../src/receipt-translate'
import { PROJECT, CANONICAL } from '@poi/node-core/registry'
import type { JobEnvelope } from '@poi/node-core/envelope'

const kp = generateKeyPairSync('ed25519')
const sign = async (msg: string) =>
  edSign(null, Buffer.from(msg), kp.privateKey).toString('base64')

const bridge = (node = new MockNaomsNode()) =>
  new HiveBridge(node, { sign })

const dispatch = (over: Partial<JobEnvelope> = {}): JobEnvelope => ({
  type: 'JOB_DISPATCH',
  jobId: 'job-1',
  taskType: PROJECT.AGENT_INFER,
  payload: 'summarize this',
  ...over,
})

let node: MockNaomsNode
let b: HiveBridge
beforeEach(async () => {
  node = new MockNaomsNode()
  b = bridge(node)
  await b.connect()
})

describe('registration', () => {
  it('uses the hive-issued DID — never self-declared', async () => {
    const env = await b.registerEnvelope('vol-1')
    expect(env.did).toBe('did:mock:bridge-issued:test')
    expect(env.site).toBe('hive:did:mock:hive:test')
    const types = env.taskTypes as number[]
    expect(types).toContain(PROJECT.AGENT_INFER)
    expect(types).toContain(PROJECT.WEB_FETCH)
    expect(types).toContain(PROJECT.HUMAN_JURY)
    expect(types).not.toContain(301)
  })
})

describe('dispatch → envelope', () => {
  it('drops market fields; unpaid jobs are not flagged paid', async () => {
    await b.handleDispatch(dispatch({ amountWei: '0' }))
    const sent = node.submitted[0]
    expect(sent).not.toHaveProperty('amountWei')
    expect(sent).not.toHaveProperty('consumer')
    expect(sent.paid).toBe(false)
  })

  it('paid jobs carry the commitment flag', async () => {
    await b.handleDispatch(dispatch({ amountWei: '1000000' }))
    expect(node.submitted[0].paid).toBe(true)
  })

  it('canary jobs cross unmarked — nothing identifies them', async () => {
    await b.handleDispatch(dispatch({ taskType: PROJECT.CANARY, payload: 'nonce-abc' }))
    const sent = node.submitted[0]
    expect(sent.canaryMarker).toBeUndefined()
    expect(sent.payload).toBe('nonce-abc')
  })

  it('requests exact replay for deterministic task types, deterministic for inference', async () => {
    await b.handleDispatch(dispatch({ taskType: PROJECT.CANARY }))
    await b.handleDispatch(dispatch({ jobId: 'job-2', taskType: PROJECT.AGENT_INFER }))
    expect(node.submitted[0].repro).toEqual({ mode: 'exact' })
    expect(node.submitted[1].repro).toEqual({ mode: 'deterministic' })
  })

  it('refuses INTERNAL classification before an envelope exists', () => {
    expect(() =>
      toNaomsEnvelope(dispatch({ classification: 'INTERNAL' })),
    ).toThrow(/INTERNAL/)
    expect(node.submitted).toHaveLength(0)
  })

  it('returns null for task types outside the granted lanes', async () => {
    expect(await b.handleDispatch(dispatch({ taskType: CANONICAL.COMPUTE }))).toBeNull()
    expect(node.submitted).toHaveLength(0)
  })
})

describe('receipt → result', () => {
  it('produces a conforming BridgedResult with digest evidence', async () => {
    const out = await b.handleDispatch(dispatch())
    expect(out).not.toBeNull()
    expect(out!.result).toBe('mock-result:job-1')
    expect(out!.sigMessage).toMatch(/^chimera-result:job-1:[0-9a-f]{64}$/)
    expect(out!.evidence.digest).toMatch(/^[0-9a-f]{64}$/)
    expect(out!.evidence.lenderDid).toMatch(/^did:mock:lender:/)
  })

  it('rejects commitment-only receipts rather than crediting', async () => {
    const forgetful = new MockNaomsNode({ forgetAfter: 0 })
    const fb = bridge(forgetful)
    await fb.connect()
    await expect(fb.handleDispatch(dispatch())).rejects.toThrow(/commitment-only/)
  })

  it('rejects schema-nonconforming results', async () => {
    const bad = new MockNaomsNode({ handler: () => 'not-json' })
    const bb = bridge(bad)
    await bb.connect()
    await expect(
      bb.handleDispatch(dispatch({ taskType: PROJECT.WEB_FETCH })),
    ).rejects.toThrow(/schema/)
  })

  it('digest is domain-separated and signature-stable across forgetting', async () => {
    const grant = await node.acquireCapability()
    const r1 = await node.submit(grant, {
      bridgeJobId: 'j2', taskType: 200, payload: 'x',
      classification: 'PUBLIC', paid: false,
    })
    // Same receipt minus the plaintext result — the digest must match,
    // since signatures commit to hashes, not the retained plaintext.
    const { result: _dropped, ...rest } = r1
    expect(await receiptDigest(rest)).toBe(r1.digest)
    expect(receiptCanonical(r1)).not.toContain('mock-result')
  })

  it('commits usage and repro into the digest — they are signed fields', async () => {
    const grant = await node.acquireCapability()
    const r1 = await node.submit(grant, {
      bridgeJobId: 'j3', taskType: 200, payload: 'x',
      classification: 'PUBLIC', paid: false,
      repro: { mode: 'deterministic', seed: 7, decoding: 'greedy' },
    })
    expect(r1.usage).toEqual({ unit: 'seconds', amount: 1 })
    expect(r1.repro).toEqual({ mode: 'deterministic', seed: 7, decoding: 'greedy' })
    // Different usage or repro over otherwise-identical fields must
    // produce a different digest — metering can't be forged post-hoc.
    const { digest: _d1, lenderSig: _s1, borrowerSig: _s2, ...unsigned } = r1
    const alteredUsage = { ...unsigned, usage: { unit: 'seconds' as const, amount: 2 } }
    const alteredRepro = { ...unsigned, repro: { mode: 'none' as const } }
    expect(await receiptDigest(alteredUsage)).not.toBe(r1.digest)
    expect(await receiptDigest(alteredRepro)).not.toBe(r1.digest)
  })
})

describe('grant lifecycle', () => {
  it('kills a revoked grant mid-flight and re-acquires', async () => {
    const first = (b as unknown as { grant: { id: string } }).grant.id
    node.revoke(first)
    await b.handleDispatch(dispatch({ jobId: 'job-2' }))
    const second = (b as unknown as { grant: { id: string } }).grant.id
    expect(second).not.toBe(first)
    expect(node.submitted).toHaveLength(1)
  })
})
