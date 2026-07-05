import { describe, it, expect } from 'vitest'
import { meetsWaitTimeFilter } from './waitTimeUtils'

describe('meetsWaitTimeFilter', () => {
  it('passes everything when waitTime is all', () => {
    expect(meetsWaitTimeFilter('all', null)).toBe(true)
    expect(meetsWaitTimeFilter('all', undefined)).toBe(true)
    expect(meetsWaitTimeFilter('all', 5)).toBe(true)
  })

  it('excludes facilities with no wait data once a threshold is active', () => {
    expect(meetsWaitTimeFilter('> 10 min', null)).toBe(false)
    expect(meetsWaitTimeFilter('> 10 min', undefined)).toBe(false)
  })

  it('excludes facilities below the threshold', () => {
    expect(meetsWaitTimeFilter('> 10 min', 5)).toBe(false)
    expect(meetsWaitTimeFilter('> 25 min', 24)).toBe(false)
    expect(meetsWaitTimeFilter('30 min+', 29)).toBe(false)
  })

  it('includes facilities at or above the threshold', () => {
    expect(meetsWaitTimeFilter('> 10 min', 10)).toBe(true)
    expect(meetsWaitTimeFilter('> 25 min', 30)).toBe(true)
    expect(meetsWaitTimeFilter('30 min+', 30)).toBe(true)
  })
})
