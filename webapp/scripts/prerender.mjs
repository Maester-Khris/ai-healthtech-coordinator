// ponytail: post-build snapshot step for public marketing routes only.
// Runs after `vite build`. Uses vite's own SSR module loader (no extra
// TS/JSX transform tool) to render each route via src/entry-server.tsx,
// then splices the result into the already-built dist/index.html template.
import { createServer } from 'vite'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distDir = path.join(root, 'dist')

const STATIC_ROUTES = ['/', '/privacy', '/cookies', '/data-disclosure', '/for-investors', '/for-engineers']

function outputPathFor(route) {
  return route === '/' ? path.join(distDir, 'index.html') : path.join(distDir, route.slice(1), 'index.html')
}

function injectTemplate(template, { route, title, description, rootHtml }) {
  const canonical = `https://medicoordai.com${route === '/' ? '' : route}`
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`)
    .replace('<div id="root"></div>', `<div id="root">${rootHtml}</div>`)
}

function assertBuildTimeCheck(route, { title, description, rootHtml }) {
  const failures = []
  if (!title || !title.trim()) failures.push('empty <title>')
  if (!description || !description.trim()) failures.push('empty meta description')
  if (!rootHtml || rootHtml.length < 200) failures.push(`rootHtml too short (${rootHtml?.length ?? 0} chars)`)
  if (!/<h1[\s>]/i.test(rootHtml ?? '')) failures.push('no <h1> content anchor found')
  if (failures.length > 0) {
    throw new Error(`Prerender check failed for ${route}: ${failures.join(', ')}`)
  }
}

async function main() {
  const template = await readFile(path.join(distDir, 'index.html'), 'utf-8')

  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
  })

  try {
    const { CASE_STUDIES } = await vite.ssrLoadModule('/src/data/caseStudies.ts')
    const caseStudyRoutes = CASE_STUDIES.map((cs) => `/for-engineers/${cs.slug}`)
    const routes = [...STATIC_ROUTES, ...caseStudyRoutes]

    const { render } = await vite.ssrLoadModule('/src/entry-server.tsx')

    for (const route of routes) {
      const result = await render(route)
      assertBuildTimeCheck(route, result)

      const html = injectTemplate(template, { route, ...result })
      const outPath = outputPathFor(route)
      await mkdir(path.dirname(outPath), { recursive: true })
      await writeFile(outPath, html, 'utf-8')
      console.log(`prerendered ${route} -> ${path.relative(root, outPath)} (title: "${result.title}")`)
    }

    console.log(`\nPrerendered ${routes.length} routes successfully.`)
  } finally {
    await vite.close()
  }
}

main()
  .then(() => process.exit(0)) // ponytail: some dep (motion/jsdom) leaves a handle open; short-lived build script, safe to force-exit once files are written
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
