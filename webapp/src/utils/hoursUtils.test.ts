import assert from 'node:assert/strict'
import { isOpen24h, isOpenWeekends } from './hoursUtils'

// ── isOpen24h ────────────────────────────────────────────────────────────────

assert.equal(isOpen24h(null), null, 'null input → null')
assert.equal(isOpen24h(undefined), null, 'undefined input → null')
assert.equal(isOpen24h([]), null, 'empty array → null')

const allDay = [
  'Monday: Open 24 hours', 'Tuesday: Open 24 hours', 'Wednesday: Open 24 hours',
  'Thursday: Open 24 hours', 'Friday: Open 24 hours', 'Saturday: Open 24 hours',
  'Sunday: Open 24 hours',
]
assert.equal(isOpen24h(allDay), true, 'all 7 days 24h → true')
assert.equal(isOpen24h(['Monday: Open 24 hours']), true, 'single 24h entry → true')

const mixed = ['Monday: 8:00 AM - 5:00 PM', 'Tuesday: Open 24 hours']
assert.equal(isOpen24h(mixed), false, 'mixed hours → false')

const weekdays = ['Monday: 8:00 AM - 5:00 PM', 'Friday: 8:00 AM - 5:00 PM', 'Saturday: Closed', 'Sunday: Closed']
assert.equal(isOpen24h(weekdays), false, 'regular hours → false')

// ── isOpenWeekends ───────────────────────────────────────────────────────────

assert.equal(isOpenWeekends(null), null, 'null input → null')
assert.equal(isOpenWeekends([]), null, 'empty array → null')

const noWeekend = ['Monday: 8:00 AM - 5:00 PM', 'Friday: 8:00 AM - 5:00 PM']
assert.equal(isOpenWeekends(noWeekend), null, 'no weekend entries → null')

const bothOpen = [
  'Monday: 8:00 AM - 5:00 PM',
  'Saturday: 9:00 AM - 5:00 PM',
  'Sunday: 10:00 AM - 4:00 PM',
]
assert.equal(isOpenWeekends(bothOpen), true, 'both weekend days open → true')

const satOnly = ['Saturday: 9:00 AM - 5:00 PM']
assert.equal(isOpenWeekends(satOnly), true, 'only Saturday open → true')

const bothClosed = [
  'Monday: 8:00 AM - 5:00 PM',
  'Saturday: Closed',
  'Sunday: Closed',
]
assert.equal(isOpenWeekends(bothClosed), false, 'both weekend days closed → false')

const satOpenSunClosed = ['Saturday: 9:00 AM - 5:00 PM', 'Sunday: Closed']
assert.equal(isOpenWeekends(satOpenSunClosed), true, 'Sat open Sun closed → true')

const open24hWeekend = ['Saturday: Open 24 hours', 'Sunday: Open 24 hours']
assert.equal(isOpenWeekends(open24hWeekend), true, '24h weekend entries → true')

console.log('All hoursUtils tests passed ✓')
