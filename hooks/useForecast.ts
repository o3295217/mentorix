'use client'

import { useState, useCallback } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays } from 'date-fns'
import { ForecastResponse } from '@/lib/prompts/types'

type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom'

interface ForecastApiResponse {
  forecast: ForecastResponse
  metadata: {
    basePeriod: {
      type: string
      start: string
      end: string
      daysCount: number
    }
    horizon: {
      type: string
      start?: string
      end?: string
      goalsCount: number
    }
    dream: {
      goal: string
      years: number
    }
  }
}

interface UseForecastReturn {
  // Base period settings
  basePeriodType: PeriodType
  basePeriodStart: string
  basePeriodEnd: string
  selectBasePeriod: (type: PeriodType) => void
  setBasePeriodStart: (date: string) => void
  setBasePeriodEnd: (date: string) => void
  
  // Forecast horizon settings
  forecastHorizon: PeriodType
  horizonStart: string
  horizonEnd: string
  selectHorizonPeriod: (type: PeriodType) => void
  setHorizonStart: (date: string) => void
  setHorizonEnd: (date: string) => void
  
  // Generation
  loading: boolean
  forecast: ForecastApiResponse | null
  generateForecast: () => Promise<void>
  
  // Helpers
  getRiskColor: (risk: string) => string
  getImpactColor: (impact: string) => string
  getProbabilityColor: (probability: string) => string
}

export function useForecast(): UseForecastReturn {
  const [basePeriodType, setBasePeriodType] = useState<PeriodType>('month')
  const [basePeriodStart, setBasePeriodStart] = useState('')
  const [basePeriodEnd, setBasePeriodEnd] = useState('')
  const [forecastHorizon, setForecastHorizon] = useState<PeriodType>('month')
  const [horizonStart, setHorizonStart] = useState('')
  const [horizonEnd, setHorizonEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState<ForecastApiResponse | null>(null)

  const selectBasePeriod = useCallback((type: PeriodType) => {
    setBasePeriodType(type)

    if (type === 'custom') return

    const today = new Date()
    let start: Date
    const end: Date = today

    switch (type) {
      case 'week':
        start = subDays(today, 7)
        break
      case 'month':
        start = subDays(today, 30)
        break
      case 'quarter':
        start = subDays(today, 90)
        break
      case 'year':
        start = subDays(today, 365)
        break
      default:
        start = subDays(today, 30)
    }

    setBasePeriodStart(format(start, 'yyyy-MM-dd'))
    setBasePeriodEnd(format(end, 'yyyy-MM-dd'))
  }, [])

  const selectHorizonPeriod = useCallback((type: PeriodType) => {
    setForecastHorizon(type)

    if (type === 'custom') return

    const today = new Date()
    let start: Date
    let end: Date

    switch (type) {
      case 'week':
        start = startOfWeek(today, { weekStartsOn: 1 })
        end = endOfWeek(today, { weekStartsOn: 1 })
        break
      case 'month':
        start = startOfMonth(today)
        end = endOfMonth(today)
        break
      case 'quarter':
        start = startOfQuarter(today)
        end = endOfQuarter(today)
        break
      case 'year':
        start = startOfYear(today)
        end = endOfYear(today)
        break
      default:
        start = startOfMonth(today)
        end = endOfMonth(today)
    }

    setHorizonStart(format(start, 'yyyy-MM-dd'))
    setHorizonEnd(format(end, 'yyyy-MM-dd'))
  }, [])

  const generateForecast = useCallback(async () => {
    if (!basePeriodStart || !basePeriodEnd) {
      alert('Выберите базовый период для анализа')
      return
    }

    if (!horizonStart || !horizonEnd) {
      alert('Выберите период для прогноза')
      return
    }

    setLoading(true)
    try {
      const body = {
        basePeriodType,
        basePeriodStart,
        basePeriodEnd,
        forecastHorizon,
        horizonStart,
        horizonEnd,
      }

      const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to generate forecast')
      }

      const data = await res.json()
      setForecast(data)
    } catch (error) {
      console.error('Error generating forecast:', error)
      alert(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }, [basePeriodType, basePeriodStart, basePeriodEnd, forecastHorizon, horizonStart, horizonEnd])

  const getRiskColor = useCallback((risk: string) => {
    const colors: Record<string, string> = {
      'низкий': 'bg-green-100 text-green-800 border-green-300',
      'средний': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'высокий': 'bg-red-100 text-red-800 border-red-300',
    }
    return colors[risk] || 'bg-gray-100 text-gray-800 border-gray-300'
  }, [])

  const getImpactColor = useCallback((impact: string) => {
    const colors: Record<string, string> = {
      'позитивный': 'border-green-500',
      'негативный': 'border-red-500',
      'нейтральный': 'border-gray-400',
    }
    return colors[impact] || 'border-gray-400'
  }, [])

  const getProbabilityColor = useCallback((probability: string) => {
    const colors: Record<string, string> = {
      'низкая': 'text-gray-600',
      'средняя': 'text-yellow-600',
      'высокая': 'text-red-600',
    }
    return colors[probability] || 'text-gray-600'
  }, [])

  return {
    basePeriodType,
    basePeriodStart,
    basePeriodEnd,
    selectBasePeriod,
    setBasePeriodStart,
    setBasePeriodEnd,
    forecastHorizon,
    horizonStart,
    horizonEnd,
    selectHorizonPeriod,
    setHorizonStart,
    setHorizonEnd,
    loading,
    forecast,
    generateForecast,
    getRiskColor,
    getImpactColor,
    getProbabilityColor,
  }
}
