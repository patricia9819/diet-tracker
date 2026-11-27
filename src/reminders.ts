export interface Reminder {
  id: string
  label: string
  time: string // HH:MM
  on: boolean
}

export const DEFAULT_REMINDERS: Reminder[] = [
  { id: 'weight', label: '⚖️ 量體重（起床、如廁後、早餐前）', time: '07:30', on: true },
  { id: 'breakfast', label: '🍳 記錄早餐', time: '09:00', on: true },
  { id: 'lunch', label: '🍱 記錄午餐', time: '13:00', on: true },
  { id: 'dinner', label: '🍲 記錄晚餐', time: '19:30', on: true },
  { id: 'water1', label: '💧 喝水', time: '10:30', on: true },
  { id: 'water2', label: '💧 喝水', time: '15:00', on: true },
  { id: 'water3', label: '💧 喝水', time: '17:30', on: false }
]

const pad = (n: number) => String(n).padStart(2, '0')

/** 產生 iCalendar 檔：每天重複的事件，到時間會跳出通知 */
export function buildIcs(list: Reminder[], appUrl: string) {
  const now = new Date()
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`
  const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const events = list.filter((r) => r.on).map((r) => {
    const [h, m] = r.time.split(':')
    const start = `${day}T${h}${m}00`
    const endM = (Number(m) + 5) % 60
    const endH = Number(h) + (Number(m) + 5 >= 60 ? 1 : 0)
    return [
      'BEGIN:VEVENT',
      `UID:diet-tracker-${r.id}-${day}@local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}`,
      `DTEND:${day}T${pad(endH % 24)}${pad(endM)}00`,
      'RRULE:FREQ=DAILY',
      `SUMMARY:${r.label.replace(/^\S+\s/, '')}`,
      `URL:${appUrl}`,
      `DESCRIPTION:打開減重紀錄 App：${appUrl}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${r.label}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT'
    ].join('\r\n')
  })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//diet-tracker//zh-TW', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n')
}
