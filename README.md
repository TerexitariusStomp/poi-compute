# poi-compute

Proof-of-Interest Compute — a tokenless, community-powered compute commons.

A project's supporters donate idle compute through a three-tier ladder —
a zero-install page script, a store-compliant browser extension, and
durable desktop/swarm daemons — powering that project's agents: inference,
marketing, support, research, web fetch, CI verification, and a self-serve
content-addressed data plane. Contributors earn USDC (no token anywhere)
plus lane-scoped, two-channel reputation. Detailed design:
`docs/megaplan/architecture.md`, roadmap in `docs/megaplan/roadmap.md`.

## Packages

| Package | Contents |
|---|---|
| `@poi/coordinator` | Cloudflare Worker + Durable Object: volunteer registry, job dispatch, project pools, ledger, rep matrix, committees, x402, awards, Privacy Pass, ENS, MCP |
| `@poi/node-core` | Shared wire-protocol types + crypto helpers (the contract every node speaks) |
| `@poi/durable-node` | Always-on daemon node (durable tier, sandboxed BUILD_VERIFY) |
| `@poi/prover` | Deterministic-replay prover service |
| `@poi/visitor-node` | Zero-install consent card + in-page inference script |
| `@poi/browser-sdk` | Pure-web node SDK for embedding |
| `@poi/extension` | MV3 browser extension node (bundled runtime, OPFS weights) |
| `@poi/hive-bridge` | NAOMS hive ↔ pool adapter (Thread-F seam) |
| `@poi/cli` | Ops tooling: submit, settle, eval, ens-publish, benchmarks |

## Quickstart

```bash
pnpm i
pnpm -r typecheck
pnpm -r test
cd packages/coordinator && npx wrangler dev   # local coordinator on :8787
```

Deploy notes live in `docs/DEPLOY.md`. This repo is a parallel
implementation — it deploys as `poi-coordinator` and deliberately ships
without the production custom domain.

## License

AGPL-3.0-only. Third-party attributions in `NOTICE`; dependency license
report in `docs/LICENSES.md` (enforced by `pnpm license-check`).
