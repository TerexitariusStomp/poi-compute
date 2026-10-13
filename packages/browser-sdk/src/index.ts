/**
 * @poi/browser-sdk — compute-focused entry point.
 *
 * Ported subset of @localchimera/browser-sdk: the volunteer node, network
 * adapters, coordinator client, ROMA router, and botchain contract
 * helpers. The upstream wallet adapters (Web3Auth social login, Casper,
 * botchain MPC) are intentionally NOT ported — consumers pass an
 * EIP-1193 provider/WalletClient to BrowserNode, or run DID-bound.
 *
 * Heavy runtimes (WebLLM, transformers.js, Helia) are optional peer deps
 * loaded lazily per task type. @wasmer/sdk is excluded by policy
 * (store-compliance: no remote WASI module loading); the COMPUTE lane
 * reports unavailable when it isn't provided by the host.
 */

export { BrowserNode, quickStart } from './browser-node'
export type { BrowserNodeStatus, BrowserCapabilities, LogEntry, BrowserNodeOptions } from './browser-node'

export {
  BOTCHAIN_TESTNET,
  BOTCHAIN_CONTRACTS,
  JOB_STATE,
  TASK_POLICY,
  CHIMERA_COORDINATOR_ABI,
} from './botchain-client'

export * from './task-types'

export { createAllAdapters } from './network-adapters'
export type { NetworkAdapter, NetworkAdapterStatus } from './network-adapters'

export { CoordinatorClient } from './coordinator-client'
export type { CoordinatorClientOptions } from './coordinator-client'

export { RomaRouter, createRomaApiHandler } from './roma-router'
export type { RomaSubTask, RomaTaskType, RomaExecutionResult } from './roma-router'
