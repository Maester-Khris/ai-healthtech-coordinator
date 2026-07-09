export function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null
}
