import { describe, it, expect } from 'vitest'
import { isOpen24h, isOpenWeekends, isOpenNow } from './hoursUtils'

// ── isOpen24h ────────────────────────────────────────────────────────────────

describe('isOpen24h', () => {
  it('null input → null',      () => expect(isOpen24h(null)).toBeNull())
  it('undefined input → null', () => expect(isOpen24h(undefined)).toBeNull())
  it('empty array → null',     () => expect(isOpen24h([])).toBeNull())

  const allDay = [
    'Monday: Open 24 hours', 'Tuesday: Open 24 hours', 'Wednesday: Open 24 hours',
    'Thursday: Open 24 hours', 'Friday: Open 24 hours', 'Saturday: Open 24 hours',
    'Sunday: Open 24 hours',
  ]
  it('all 7 days 24h → true',   () => expect(isOpen24h(allDay)).toBe(true))
  it('single 24h entry → true', () => expect(isOpen24h(['Monday: Open 24 hours'])).toBe(true))

  it('mixed hours → false', () =>
    expect(isOpen24h(['Monday: 8:00 AM - 5:00 PM', 'Tuesday: Open 24 hours'])).toBe(false))

  it('regular hours → false', () =>
    expect(isOpen24h(['Monday: 8:00 AM - 5:00 PM', 'Saturday: Closed'])).toBe(false))
})

// ── isOpenWeekends ───────────────────────────────────────────────────────────

describe('isOpenWeekends', () => {
  it('null input → null',         () => expect(isOpenWeekends(null)).toBeNull())
  it('empty array → null',        () => expect(isOpenWeekends([])).toBeNull())
  it('no weekend entries → null', () =>
    expect(isOpenWeekends(['Monday: 8:00 AM - 5:00 PM', 'Friday: 8:00 AM - 5:00 PM'])).toBeNull())

  it('both weekend days open → true', () =>
    expect(isOpenWeekends([
      'Monday: 8:00 AM - 5:00 PM',
      'Saturday: 9:00 AM - 5:00 PM',
      'Sunday: 10:00 AM - 4:00 PM',
    ])).toBe(true))

  it('only Saturday open → true',  () => expect(isOpenWeekends(['Saturday: 9:00 AM - 5:00 PM'])).toBe(true))
  it('Sat open Sun closed → true', () =>
    expect(isOpenWeekends(['Saturday: 9:00 AM - 5:00 PM', 'Sunday: Closed'])).toBe(true))
  it('24h weekend entries → true', () =>
    expect(isOpenWeekends(['Saturday: Open 24 hours', 'Sunday: Open 24 hours'])).toBe(true))

  it('both weekend days closed → false', () =>
    expect(isOpenWeekends([
      'Monday: 8:00 AM - 5:00 PM',
      'Saturday: Closed',
      'Sunday: Closed',
    ])).toBe(false))
})

// ── isOpenNow ────────────────────────────────────────────────────────────────

describe('isOpenNow', () => {
  it('null input → null',      () => expect(isOpenNow(null)).toBeNull())
  it('undefined input → null', () => expect(isOpenNow(undefined)).toBeNull())
  it('empty array → null',     () => expect(isOpenNow([])).toBeNull())

  it('no entry for today → null', () => {
    const monday10am = new Date('2026-07-06T10:00:00') // a Monday
    expect(isOpenNow(['Tuesday: 8:00 AM - 5:00 PM'], monday10am)).toBeNull()
  })

  it('today closed → false', () => {
    const monday10am = new Date('2026-07-06T10:00:00')
    expect(isOpenNow(['Monday: Closed'], monday10am)).toBe(false)
  })

  it('today open 24 hours → true', () => {
    const monday3am = new Date('2026-07-06T03:00:00')
    expect(isOpenNow(['Monday: Open 24 hours'], monday3am)).toBe(true)
  })

  it('within same-day range → true', () => {
    const monday10am = new Date('2026-07-06T10:00:00')
    expect(isOpenNow(['Monday: 8:00 AM - 5:00 PM'], monday10am)).toBe(true)
  })

  it('before same-day range opens → false', () => {
    const monday6am = new Date('2026-07-06T06:00:00')
    expect(isOpenNow(['Monday: 8:00 AM - 5:00 PM'], monday6am)).toBe(false)
  })

  it('after same-day range closes → false', () => {
    const monday7pm = new Date('2026-07-06T19:00:00')
    expect(isOpenNow(['Monday: 8:00 AM - 5:00 PM'], monday7pm)).toBe(false)
  })

  it('overnight range, now after midnight before close → true', () => {
    const monday1am = new Date('2026-07-06T01:00:00')
    expect(isOpenNow(['Monday: 10:00 PM - 2:00 AM'], monday1am)).toBe(true)
  })

  it('overnight range, now in the afternoon → false', () => {
    const monday3pm = new Date('2026-07-06T15:00:00')
    expect(isOpenNow(['Monday: 10:00 PM - 2:00 AM'], monday3pm)).toBe(false)
  })
})

