import { describe, expect, it } from 'vitest'
import { buildProposalApplyOptions, proposalHasExistingSchedule } from '@/hooks/daily/proposal-helpers'

describe('proposal-helpers', () => {
  it('always confirms explicit apply click for a new schedule', () => {
    const metadata = { currentScheduleExists: false, currentScheduleHash: null }

    expect(proposalHasExistingSchedule(metadata)).toBe(false)
    expect(buildProposalApplyOptions(metadata)).toEqual({ confirmed: true, replaceExisting: false })
  })

  it('uses currentScheduleExists rather than nullable hash for replacement decision', () => {
    const metadata = { currentScheduleExists: true, currentScheduleHash: null }

    expect(proposalHasExistingSchedule(metadata)).toBe(true)
    expect(buildProposalApplyOptions(metadata)).toEqual({ confirmed: true, replaceExisting: true })
  })
})
