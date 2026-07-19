/**
 * Prerender-only entry point. Mounts the real <App /> tree inside a jsdom
 * document pinned to the target URL, flushes effects (so useDocumentHead's
 * title/meta side effects actually run, same as in a real browser), then
 * reads the resulting DOM back out. Not part of the client bundle — only
 * ever loaded by scripts/prerender.mjs via vite.ssrLoadModule.
 */

export interface PrerenderResult {
  title: string
  description: string
  rootHtml: string
}

export async function render(url: string): Promise<PrerenderResult> {
  const { JSDOM } = await import('jsdom')

  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: `https://medicoordai.com${url}`,
    pretendToBeVisual: true,
  })

  // Mirror every window property onto globalThis (the standard jsdom-in-Node
  // pattern — libraries like leaflet/motion reach for `Element`, `Event`,
  // `getComputedStyle`, etc, not just `window`/`document`). Node 21+ ships
  // some read-only globals (e.g. `navigator`) — defineProperty overrides
  // them for the duration of this render instead of throwing.
  const setGlobal = (key: string, value: unknown) =>
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true })

  // jsdom's timer functions call back into Node's real timers internally —
  // overwriting globalThis's timers with jsdom's versions creates infinite
  // recursion, so Node's own timer implementation must stay in place.
  const skipKeys = new Set([
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'queueMicrotask', 'setImmediate', 'clearImmediate', 'undefined',
    'performance', 'crypto',
  ])

  for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (skipKeys.has(key)) continue
    try {
      setGlobal(key, (dom.window as unknown as Record<string, unknown>)[key])
    } catch {
      // a handful of window properties (e.g. circular self-references) can't
      // be copied onto globalThis — safe to skip, nothing here depends on them
    }
  }
  setGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16))
  setGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true)

  // Imported after globals are set — App's module graph (leaflet, motion,
  // supabase, etc.) must not evaluate window/document access before jsdom exists.
  const { createRoot } = await import('react-dom/client')
  const { act } = await import('react')
  const { default: App } = await import('./App')

  const container = dom.window.document.getElementById('root')!
  const root = createRoot(container)

  await act(async () => {
    root.render(<App />)
  })
  // let effect-chained microtasks (useDocumentHead, useEffect->setState) settle
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

  const title = dom.window.document.title
  const description =
    dom.window.document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''
  const rootHtml = container.innerHTML

  root.unmount()
  dom.window.close()

  return { title, description, rootHtml }
}
