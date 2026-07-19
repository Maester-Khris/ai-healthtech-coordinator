import { useEffect } from 'react'

const SITE_NAME = 'MediCoord AI'

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

/**
 * Sets a distinct title/description per route. Client-side only — helps
 * JS-rendering crawlers (Googlebot, GPTBot) but not non-rendering bots.
 * See .agents/tasks/013_SEO_PRERENDER.md for the rendering-pipeline fix.
 */
export function useDocumentHead(title: string, description: string) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`
    document.title = fullTitle
    setMeta('description', description)
    setMeta('og:title', fullTitle, 'property')
    setMeta('og:description', description, 'property')
  }, [title, description])
}
