export function isOpen24h(weekday_hours: string[] | null | undefined): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null
  return weekday_hours.every(h => h.includes('Open 24 hours'))
}

export function isOpenWeekends(weekday_hours: string[] | null | undefined): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null
  const sat = weekday_hours.find(h => h.startsWith('Saturday:'))
  const sun = weekday_hours.find(h => h.startsWith('Sunday:'))
  if (!sat && !sun) return null
  return (sat ? !sat.includes('Closed') : false) || (sun ? !sun.includes('Closed') : false)
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseClockTimeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

export function isOpenNow(weekday_hours: string[] | null | undefined, now: Date = new Date()): boolean | null {
  if (!weekday_hours || weekday_hours.length === 0) return null

  const todayName = DAY_NAMES[now.getDay()]
  const todayEntry = weekday_hours.find(h => h.startsWith(`${todayName}:`))
  if (!todayEntry) return null

  const rest = todayEntry.slice(todayName.length + 1).trim()
  if (rest.includes('Closed')) return false
  if (rest.includes('Open 24 hours')) return true

  const [openStr, closeStr] = rest.split(' - ').map(s => s.trim())
  if (!openStr || !closeStr) return null

  const openMin = parseClockTimeToMinutes(openStr)
  const closeMin = parseClockTimeToMinutes(closeStr)
  if (openMin === null || closeMin === null) return null

  const nowMin = now.getHours() * 60 + now.getMinutes()

  if (closeMin > openMin) {
    return nowMin >= openMin && nowMin < closeMin
  }
  // Overnight range (e.g. "10:00 PM - 2:00 AM") — closes after midnight
  return nowMin >= openMin || nowMin < closeMin
}
