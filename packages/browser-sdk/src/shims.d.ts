/**
 * Ambient module shims for peer deps that are excluded from this repo by
 * policy (store compliance: no remotely-fetched WASI modules). The code
 * paths that consume them stay verbatim so upstream diffs stay small; at
 * runtime they are dynamic imports, so absence only disables that lane.
 */
declare module '@wasmer/sdk'
