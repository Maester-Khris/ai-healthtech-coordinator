import type { CaseStudy } from '../data/caseStudies'

export function filterCaseStudies(list: CaseStudy[], query: string, activeTag: string | null): CaseStudy[] {
  const q = query.trim().toLowerCase()
  return list.filter((cs) => {
    const matchesTag = !activeTag || cs.tags.includes(activeTag)
    if (!matchesTag) return false
    if (!q) return true
    return (
      cs.title.toLowerCase().includes(q) ||
      cs.summary.toLowerCase().includes(q) ||
      cs.category.toLowerCase().includes(q) ||
      cs.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })
}

export interface EmphasisSegment {
  text: string
  weight: 'plain' | 'bold' | 'accent'
}

export function splitWithEmphasis(text: string, emphasis: [string, string]): EmphasisSegment[] {
  const [boldPhrase, accentPhrase] = emphasis
  let segments: EmphasisSegment[] = [{ text, weight: 'plain' }]

  const applySplit = (phrase: string, weight: 'bold' | 'accent') => {
    segments = segments.flatMap((segment) => {
      if (segment.weight !== 'plain' || !phrase) return [segment]
      const idx = segment.text.indexOf(phrase)
      if (idx === -1) return [segment]
      const before = segment.text.slice(0, idx)
      const after = segment.text.slice(idx + phrase.length)
      const result: EmphasisSegment[] = []
      if (before) result.push({ text: before, weight: 'plain' })
      result.push({ text: phrase, weight })
      if (after) result.push({ text: after, weight: 'plain' })
      return result
    })
  }

  applySplit(boldPhrase, 'bold')
  applySplit(accentPhrase, 'accent')

  return segments
}

export interface MetricBullet {
  text: string
  bold?: string[]
}

export function splitWithBoldPhrases(bullet: MetricBullet): EmphasisSegment[] {
  let segments: EmphasisSegment[] = [{ text: bullet.text, weight: 'plain' }]

  for (const phrase of bullet.bold ?? []) {
    if (!phrase) continue
    segments = segments.flatMap((segment) => {
      if (segment.weight !== 'plain') return [segment]
      const idx = segment.text.indexOf(phrase)
      if (idx === -1) return [segment]
      const before = segment.text.slice(0, idx)
      const after = segment.text.slice(idx + phrase.length)
      const result: EmphasisSegment[] = []
      if (before) result.push({ text: before, weight: 'plain' })
      result.push({ text: phrase, weight: 'bold' })
      if (after) result.push({ text: after, weight: 'plain' })
      return result
    })
  }

  return segments
}

export function formatPublishedDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}
