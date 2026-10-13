# Deploy

## Coordinator (Cloudflare Workers + Durable Object)

```bash
cd packages/coordinator
pnpm i
npx wrangler deploy
```

`wrangler.toml` ships with the production custom domain **commented
out** — a fresh deploy binds `poi-coordinator.<subdomain>.workers.dev`
only. Enable the custom-domain route deliberately, after smoke tests.

### Vars (wrangler.toml `[vars]`)

| Var | Purpose |
|---|---|
| `BASE_RPC_URL` | Base mainnet RPC (chain watcher, settlement) |
| `ESCROW_CONTRACT` | escrow contract address (job funding) |
| `POLL_INTERVAL_MS`, `JOB_RESULT_TIMEOUT_MS`, `MAX_PAYLOAD_BYTES`, `MAX_VOLUNTEERS` | tuning |

### Secrets (`wrangler secret put`)

`VOLUNTEER_TOKEN` (WS upgrade gate), `ADMIN_TOKEN`,
`DISPATCH_AUTH_TOKEN`, `COORDINATOR_PRIVATE_KEY` (dispatch sigs, x402
direct settle — funded Base wallet), `PROJECT_TOKENS` (JSON map),
`FEDERATION_TOKEN` (committee replication between deployments),
`TURNSTILE_SECRET`, `PRIVACYPASS_ISSUER_KEY`/`_ORIGIN`,
`SEALED_VALUES` (JSON tripwires), `PRICE_TABLE`, `PROJECT_BUDGETS`,
`X402_PAYEE`/`X402_USDC`/`X402_FACILITATOR`, `PROVER_URL`,
`COMMITTEE_PEERS`, `REP_WEBHOOK_URL`, `WEIGHTS_MIRROR_URL`,
`IPFS_GATEWAY_URL`, `ENS_RPC`, `BASE_RPC_URLS`, `REFERRAL_TARGET`.

All env vars have honest defaults — with none set, the worker is a
reputation-only coordinator that fails auth-gated routes closed.

## Durable node (any always-on host)

```bash
cd packages/durable-node
COORDINATOR_URL=wss://<coordinator>/volunteer \
VOLUNTEER_TOKEN=… \
node bin/durable-node.mjs
```

Options in the file header: `KEY_FILE` (ed25519 identity),
`SHARD_CAPACITY`, `INFER_ENGINE` (`auto` prefers a local Ollama at
`OLLAMA_URL`, else transformers.js), `BUILD_ALLOWLIST` (301 argv[0]s —
sandboxed via bwrap/unshare when present), `VERIFY_DISPATCH` (on),
`TRANSFORMERS_IPFS_CID`/`_SHA256` (Helia weight fetch).

## Prover (independent process — do not co-locate with a node)

```bash
cd packages/prover
COORDINATOR_URL=http://localhost:8787 node bin/prover.mjs
# then set PROVER_URL on the coordinator
```

Verifier independence is the point: it shares no code path with the
executor, replays deterministic jobs (301 sandboxed, 300 greedy-decode),
and signs its attestation.

## Extension

```bash
cd packages/extension
pnpm i && node build.mjs   # bundles vendor/wllama-page.js + wllama.wasm
# load unpacked from this directory
```

All runtime deps are vendored (store policy: no remote code). The
offscreen wllama lane only engages where the threaded JSPI build runs
(crossOriginIsolated); otherwise taskType 200 is unclaimed.

## CLI

`packages/cli/bin/*` — submit, settle, register-agent, ens-publish,
eval, ollama-bench, mcp-bridge, market-research, and the e2e suites
(award/challenge/committee/x402). Each `--help`-able via its header
comment.

## Hive bridge

Library package — see `docs/HIVE-BRIDGE.md`. Wire it into a process with
a `NaomsClient` (mock or `HttpNaomsClient`) and a bridge identity.
