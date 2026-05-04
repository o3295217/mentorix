import { describe, expect, it, vi } from 'vitest'
import { buildGoalsContext, buildPlanContext, mapUserInsights, mapUserProfile } from '@/lib/user-context'

const profileRecord = {
  name: 'Олег',
  occupation: 'Founder',
  industry: '',
  maritalStatus: null,
  hobbies: 'running',
  sports: null,
  location: 'Moscow',
  age: 37,
  education: null,
  teamSize: 12,
  workExperience: '15 years',
  values: 'clarity',
  challenges: null,
  other: '',
}

describe('user context mapping', () => {
  it('maps user profile to AI shape and keeps empty fields undefined', () => {
    expect(mapUserProfile(null)).toBeUndefined()
    expect(mapUserProfile(profileRecord)).toEqual({
      name: 'Олег',
      occupation: 'Founder',
      industry: undefined,
      maritalStatus: undefined,
      hobbies: 'running',
      sports: undefined,
      location: 'Moscow',
      age: 37,
      education: undefined,
      teamSize: 12,
      workExperience: '15 years',
      values: 'clarity',
      challenges: undefined,
      other: undefined,
    })
  })

  it('maps user insights to AI shape', () => {
    expect(mapUserInsights(null)).toBeUndefined()
    expect(mapUserInsights({
      patterns: 'Лучше работает утром',
      strengths: 'Фокус',
      challenges: 'Перегруз',
      preferences: 'Короткие задачи',
      recommendations: 'Держать буфер',
      motivators: 'Прогресс',
      evaluationCount: 8,
    })).toEqual({
      patterns: 'Лучше работает утром',
      strengths: 'Фокус',
      challenges: 'Перегруз',
      preferences: 'Короткие задачи',
      recommendations: 'Держать буфер',
      motivators: 'Прогресс',
      evaluationCount: 8,
    })
  })

  it('builds full goals context with safe JSON defaults', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(buildGoalsContext({
        dream: { goalText: 'Построить AION', months: 30 },
        currentYearGoal: { goalsJson: '["year"]' },
        halfYearGoals: { goalsJson: '["half"]' },
        quarterGoals: { goalsJson: 'not-json' },
        monthGoals: null,
        weekGoals: { goalsJson: '["week"]' },
      })).toEqual({
        dreamGoal: 'Построить AION',
        dreamYears: 3,
        dreamMonths: 30,
        yearGoals: ['year'],
        halfYearGoals: ['half'],
        quarterGoals: [],
        monthGoals: [],
        weekGoals: ['week'],
      })
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('builds plan context with goals, profile and insights', () => {
    expect(buildPlanContext({
      dream: null,
      weekGoalsRecord: { goalsJson: '["week"]' },
      monthGoalsRecord: { goalsJson: '["month"]' },
      userProfile: profileRecord,
      userInsights: {
        patterns: 'pattern',
        strengths: 'strength',
        challenges: 'challenge',
        preferences: 'preference',
        recommendations: 'recommendation',
        motivators: 'motivator',
        evaluationCount: 1,
      },
    })).toMatchObject({
      dreamGoal: 'Не указана',
      weekGoals: ['week'],
      monthGoals: ['month'],
      profile: { name: 'Олег' },
      insights: { patterns: 'pattern', evaluationCount: 1 },
    })
  })
})