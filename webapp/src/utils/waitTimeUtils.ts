const WAIT_TIME_THRESHOLDS: Record<string, number> = {
  '> 10 min': 10,
  '> 25 min': 25,
  '30 min+':  30,
}

export function meetsWaitTimeFilter(waitTime: string, waitMinutes: number | null | undefined): boolean {
  if (waitTime === 'all') return true
  const threshold = WAIT_TIME_THRESHOLDS[waitTime]
  if (threshold === undefined) return true
  return waitMinutes != null && waitMinutes >= threshold
}
