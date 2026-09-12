// Session date groups — group sessions by date for sidebar display.

export interface DateGroup {
  label: string
  key: 'today' | 'yesterday' | 'this-week' | 'last-week' | 'older'
  sessions: Array<{ id: string; title: string; createdAt: number }>
}

export function groupSessionsByDate(
  sessions: Array<{ id: string; title: string; createdAt: number }>,
): DateGroup[] {
  const now = Date.now()
  const DAY = 86_400_000
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayMs = todayStart.getTime()

  const groups: Record<DateGroup['key'], DateGroup> = {
    today: { label: 'Today', key: 'today', sessions: [] },
    yesterday: { label: 'Yesterday', key: 'yesterday', sessions: [] },
    'this-week': { label: 'This Week', key: 'this-week', sessions: [] },
    'last-week': { label: 'Last Week', key: 'last-week', sessions: [] },
    older: { label: 'Older', key: 'older', sessions: [] },
  }

  for (const s of sessions) {
    const diff = now - s.createdAt
    if (s.createdAt >= todayMs) {
      groups.today.sessions.push(s)
    } else if (s.createdAt >= todayMs - DAY) {
      groups.yesterday.sessions.push(s)
    } else if (diff < 7 * DAY) {
      groups['this-week'].sessions.push(s)
    } else if (diff < 14 * DAY) {
      groups['last-week'].sessions.push(s)
    } else {
      groups.older.sessions.push(s)
    }
  }

  return Object.values(groups).filter(g => g.sessions.length > 0)
}
