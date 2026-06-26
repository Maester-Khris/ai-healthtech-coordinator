import { describe, it, expect } from 'vitest'
import { resolveAnchor } from './useAnchor'

const gps = { lat: 43.7, lng: -79.4 }
const pin = { lat: 43.8, lng: -79.5 }

describe('resolveAnchor', () => {
  it('returns default when no gps and no pin', () => {
    const r = resolveAnchor(null, null)
    expect(r.source).toBe('default')
    expect(r.lat).toBe(43.6426)
    expect(r.lng).toBe(-79.3871)
  })

  it('returns gps when gps available and no pin', () => {
    const r = resolveAnchor(gps, null)
    expect(r.source).toBe('gps')
    expect(r.lat).toBe(43.7)
  })

  it('manual_pin wins over gps', () => {
    const r = resolveAnchor(gps, pin)
    expect(r.source).toBe('manual_pin')
    expect(r.lat).toBe(43.8)
  })

  it('manual_pin works without gps', () => {
    const r = resolveAnchor(null, pin)
    expect(r.source).toBe('manual_pin')
    expect(r.lng).toBe(-79.5)
  })
})
