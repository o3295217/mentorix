'use client'

// Дата плана дня, закреплённая в шапке (после «Прогнозы»).
// Смена даты синхронизируется со страницей /daily; с другой страницы
// выбор даты ведёт на план дня выбранного числа.

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import DatePickerWithIndicators from '@/components/DatePickerWithIndicators'
import { subscribeDailyDate, writeStoredDailyDate } from '@/lib/daily-date-sync'

export default function HeaderDailyDate() {
  const router = useRouter()
  const pathname = usePathname()
  const [date, setDate] = useState<string | null>(null)

  useEffect(() => {
    // План дня всегда открывается с сегодняшней даты — шапка стартует так же
    setDate(format(new Date(), 'yyyy-MM-dd'))
    return subscribeDailyDate(d => setDate(prev => (prev === d ? prev : d)))
  }, [])

  if (!date) return null

  return (
    <DatePickerWithIndicators
      value={date}
      calendarId="header-daily-date-calendar"
      triggerFormat="d MMM yyyy"
      onChange={(d) => {
        setDate(d)
        writeStoredDailyDate(d)
        if (!(pathname === '/daily' || pathname.startsWith('/daily/'))) {
          router.push(`/daily?date=${d}`)
        }
      }}
    />
  )
}
