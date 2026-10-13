/**
 * visitor-node — tier-1 ephemeral compute. A site adds one tag:
 *
 *   <script src="/visitor-node.js"
 *           data-coordinator="wss://coordinator.example.org"
 *           data-site="my-site"
 *           data-project="my-project"
 *           data-task-types="0,100,200"></script>
 *
 * Consent model: nothing runs until the visitor clicks opt-in on the
 * status pill. Consent persists per-site in localStorage; clicking the
 * pill again revokes immediately (disconnect + clear). Idle gating —
 * the node pauses when the tab is hidden or the device is on battery
 * with low charge; the coordinator's own gating is the backstop.
 *
 * Heavy inference engines (transformers.js/WebLLM) are loaded lazily by
 * the SDK only when a dispatched job needs them.
 */
import { BrowserNode } from '@poi/browser-sdk'

const KEY_PREFIX = 'poi-visitor:'
const scriptEl = document.currentScript as HTMLScriptElement | null

function config(): Record<string, string> {
  const d = scriptEl?.dataset ?? {}
  return {
    coordinator: d.coordinator ?? 'wss://coordinator.widespread.fyi',
    site: d.site ?? '',
    project: d.project ?? '',
    taskTypes: d.taskTypes ?? '0,100,200',
    label: d.label ?? 'Contribute idle compute',
  }
}

function consentKey(site: string): string {
  return `${KEY_PREFIX}consent:${site || location.host}`
}

function pill(text: string, onClick: () => void): HTMLElement {
  let el = document.getElementById('poi-pill')
  if (!el) {
    el = document.createElement('button')
    el.id = 'poi-pill'
    el.style.cssText =
      'position:fixed;bottom:12px;right:12px;z-index:2147483647;' +
      'padding:6px 12px;border-radius:16px;border:1px solid #444;' +
      'background:#111;color:#eee;font:12px system-ui;cursor:pointer;opacity:.85'
    document.body.appendChild(el)
  }
  el.textContent = text
  ;(el as HTMLButtonElement).onclick = onClick
  return el
}

let node: BrowserNode | null = null

async function start(cfg: Record<string, string>): Promise<void> {
  const { quickStart } = await import('@poi/browser-sdk')
  node = await quickStart(undefined, undefined, undefined, {
    onStatus: (s) => {
      const msg = s.resourcePaused
        ? 'paused (low resources)'
        : s.currentJob ?? (s.running ? `online — ${s.jobsProcessed} jobs done` : 'connecting…')
      pill(`◉ ${cfg.label} — ${msg}`, stop)
    },
  })
  // eslint-disable-next-line no-console
  console.info('[poi-visitor] node started for site', cfg.site || location.host)
}

function stop(): void {
  const cfg = config()
  localStorage.removeItem(consentKey(cfg.site))
  void node?.stop?.()
  node = null
  pill(`${cfg.label} — off`, () => begin(cfg))
}

function begin(cfg: Record<string, string>): void {
  localStorage.setItem(consentKey(cfg.site), 'yes')
  pill(`${cfg.label} — starting…`, stop)
  void start(cfg)
}

const cfg = config()
const consented = localStorage.getItem(consentKey(cfg.site)) === 'yes'

if (consented) {
  begin(cfg)
} else {
  pill(cfg.label, () => begin(cfg))
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && node) pill('⏸ idle (tab hidden)', stop)
})
