/**
 * Wire-protocol envelopes — the single definition shared by the coordinator
 * (which produces JOB_DISPATCH and consumes REGISTER/JOB_RESULT) and every
 * node implementation (durable daemon, visitor script, extension, SDK,
 * hive-bridge) which does the inverse.
 *
 * Transport: a JSON object over a WebSocket. `type` is the discriminator;
 * the field set varies per message type (REGISTER carries taskTypes/sig,
 * JOB_DISPATCH carries payload/taskType, JOB_RESULT carries result/
 * resultSig, etc.) — the loose shape mirrors the shipped protocol.
 */
export interface JobEnvelope {
  type: string
  volunteerId?: string
  jobId?: string
  address?: string
  taskTypes?: unknown
  capabilities?: Record<string, unknown>
  networks?: string[]
  site?: string
  project?: string
  referrer?: string
  did?: string
  sig?: string
  durable?: boolean
  shardCapacity?: number
  /** Group data-share opt-in — visitor consented to publish contribution
   *  stats on the project's group feed. */
  shareData?: boolean
  status?: string
  payload?: string
  amountWei?: string
  classification?: string
  difficulty?: number
  domain?: string
  modelClass?: string
  priority?: string
  deadline?: number
  result?: string
  resultSig?: string
  /** Inference engine the node claims it ran ('ollama'|'onnx'|…) — stored
   *  on the result record; the prover replays on the same engine. */
  engine?: string
  reason?: string
  verifyOf?: string
  modPost?: string
  group?: string
  dispatchSig?: string
}

/** HTTP /jobs (and /jobs/batch) request body — the consumer-facing
 *  counterpart of JobEnvelope. */
export interface DirectJobBody {
  payload?: string
  taskType?: number
  amountWei?: string
  site?: string
  project?: string
  classification?: string
  difficulty?: number
  domain?: string
  modelClass?: string
  priority?: string
  group?: string           // set internally for jury-redundant siblings
  redundant?: number       // N sibling dispatches in one group (consumer aggregates)
  verifyOf?: string        // set internally on spot-check replica jobs
  modPost?: string         // set internally on pool-moderation jobs
}

/** Coordinator-side pending-job record — the shape stored between
 *  submission and dispatch/timeout. */
export interface PendingJob {
  taskType: number
  payload: string
  amountWei: string
  source: 'chain' | 'direct'
  consumer?: string
  site?: string            // wp-cloud site tag — prefer that site's own visitors
  project?: string         // project:<slug> pool — prefer that pool's supporters
  classification?: string  // 'PUBLIC' (default) or 'INTERNAL' (durable+DID-only dispatch)
  difficulty?: number      // >=2 prefers high-capability nodes
  domain?: string          // specialization lane hint
  modelClass?: string      // 'instruct' | 'embedding' | ...
  priority?: 'interactive' | 'batch'  // interactive dispatches ahead of batch under contention
  group?: string           // redundant-dispatch group id — sibling jobs share it
  resultToken?: string     // bearer token for /results/<id>?token= — lets batch consumers read their own result without ADMIN_TOKEN
  verifyOf?: string        // set on spot-check replica jobs — result compared against the original
  modPost?: string         // internal: social-moderation job — result verdicts the post
  deadline?: number // unix seconds; 0/undefined = none
  since: number
}
