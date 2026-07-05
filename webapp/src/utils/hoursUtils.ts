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
