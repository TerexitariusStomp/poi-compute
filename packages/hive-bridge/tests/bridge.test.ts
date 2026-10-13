/**
 * Bridge contract tests — prove the boundary rules the NAOMS proposal
 * left open are enforced on OUR side:
 *   - canaries cross unmarked (nothing leaks the flag)
 *   - INTERNAL jobs never cross
 *   - market data (consumer, amountWei) never crosses
 *   - paid jobs request the settlement retention carve-out
 *   - hash-only (forgotten) receipts are rejected, not credited
 *   - results must satisfy the PoI schema before credit
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { generateKeyPairSync, sign as edSign } from 'node:crypto'
import { HiveBridge } from '../src/adapter'
import { MockHive } from '../src/mock-hive'
import { toNaomsEnvelope, toChimeraResult } from '../src/receipt-translate'
import { PROJECT, CANONICAL } from '@poi/node-core/registry'
import type { JobEnvelope } from '@poi/node-core/envelope'

const kp = generateKeyPairSync('ed25519')
const sign = async (msg: string) =>
  edSign(null, Buffer.from(msg), kp.privateKey).toString('base64')

const bridge = (hive = new MockHive()) =>
  new HiveBridge(hive, 'did:mock:hive:test', { did: 'did:key:z6Mkbridge', sign })

const dispatch = (over: Partial<JobEnvelope> = {}): JobEnvelope => ({
  type: 'JOB_DISPATCH',
  jobId: 'job-1',
  taskType: PROJECT.AGENT_INFER,
  payload: 'summarize this',
  ...over,
})

let hive: MockHive
let b: HiveBridge
beforeEach(async () => {
  hive = new MockHive()
  b = bridge(hive)
  await b.connect()
})

describe('registration', () => {
  it('claims only task types the hive lanes cover, hive-scoped site tag', async () => {
    const env = await b.registerEnvelope('vol-1')
    expect(env.type).toBe('REGISTER')
    expect(env.site).toBe('hive:did:mock:hive:test')
    expect(env.did).toBe('did:key:z6Mkbridge')
    const types = env.taskTypes as number[]
    // inference lane: 0, 100, 101, 200; fetch: 205; jury: 204 — no swarm/compute
    expect(types).toContain(PROJECT.AGENT_INFER)
    expect(types).toContain(PROJECT.WEB_FETCH)
    expect(types).toContain(PROJECT.HUMAN_JURY)
    expect(types).not.toContain(301)
  })
})

describe('dispatch → envelope', () => {
  it('drops market fields; unpaid jobs get default retention', async () => {
    await b.handleDispatch(dispatch({ amountWei: '0' }))
    const sent = hive.submitted[0]
    expect(sent).not.toHaveProperty('amountWei')
    expect(sent).not.toHaveProperty('consumer')
    expect(sent.retention).toBe('default')
  })

  it('paid jobs request settlement retention', async () => {
    await b.handleDispatch(dispatch({ amountWei: '1000000' }))
    expect(hive.submitted[0].retention).toBe('settlement')
  })

  it('canary jobs cross unmarked — nothing identifies them', async () => {
    await b.handleDispatch(dispatch({ taskType: PROJECT.CANARY, payload: 'nonce-abc' }))
    const sent = hive.submitted[0]
    expect(sent.canaryMarker).toBeUndefined()
    expect(sent.payload).toBe('nonce-abc') // payload passes through verbatim
  })

  it('refuses INTERNAL classification before an envelope exists', () => {
    expect(() =>
      toNaomsEnvelope(dispatch({ classification: 'INTERNAL' })),
    ).toThrow(/INTERNAL/)
    expect(hive.submitted).toHaveLength(0)
  })

  it('returns null for task types outside the hive lanes', async () => {
    expect(await b.handleDispatch(dispatch({ taskType: CANONICAL.COMPUTE }))).toBeNull()
    expect(hive.submitted).toHaveLength(0)
  })
})

describe('receipt → result', () => {
  it('produces a conforming BridgedResult with evidence', async () => {
    const out = await b.handleDispatch(dispatch())
    expect(out).not.toBeNull()
    expect(out!.result).toBe('mock-result:job-1')
    expect(out!.sigMessage).toMatch(/^chimera-result:job-1:[0-9a-f]{64}$/)
    expect(out!.evidence.lenderDid).toMatch(/^did:mock:lender:/)
  })

  it('rejects hash-only (forgotten) receipts rather than crediting', async () => {
    const forgetful = new MockHive({ forgetAfter: 0 })
    const fb = bridge(forgetful)
    await fb.connect()
    await expect(fb.handleDispatch(dispatch())).rejects.toThrow(/forgotten/)
  })

  it('rejects schema-nonconforming results', async () => {
    const bad = new MockHive({ handler: () => 'not-json' })
    const bb = bridge(bad)
    await bb.connect()
    // WEB_FETCH result schema requires {bodyHash, bytes}
    await expect(
      bb.handleDispatch(dispatch({ taskType: PROJECT.WEB_FETCH })),
    ).rejects.toThrow(/schema/)
  })

  it('toChimeraResult signs the canonical message format', async () => {
    const receipt = await hive.submit(await hive.acquirePermit(), {
      bridgeJobId: 'j2', taskType: 200, payload: 'x',
      classification: 'PUBLIC', retention: 'default',
    })
    const out = await toChimeraResult(receipt)
    expect(out.sigMessage.startsWith('chimera-result:j2:')).toBe(true)
  })
})

describe('permit lifecycle', () => {
  it('re-acquires the permit after revocation', async () => {
    const first = (b as unknown as { permit: { id: string } }).permit.id
    hive.revoke(first)
    await b.handleDispatch(dispatch({ jobId: 'job-2' }))
    const second = (b as unknown as { permit: { id: string } }).permit.id
    expect(second).not.toBe(first)
    expect(hive.submitted).toHaveLength(1)
  })
})
