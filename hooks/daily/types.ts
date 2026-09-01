import type { DragEvent } from 'react'
import type { DailyEntry, OpenTask } from '@/lib/types'
import type { DailyChatProposalMetadata } from '@/lib/daily-schedule-proposal'

export type DailyPlanDraft = {
  updatedAt: string
  planText: string
  selectedTaskIds: number[]
  newTaskText?: string
}

export interface TaskSuggestion {
  goalText: string
  reason: string
  difficulty: 'легко' | 'средне' | 'сложно'
  source: 'week' | 'month'
}

export interface CheckPlanResult {
  overall: string
  suggestions: TaskSuggestion[]
  warnings: string[]
  tips: string[]
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  metadata?: DailyChatProposalMetadata | null
}

export interface Habit {
  id: number
  taskText: string
  frequency: string
  daysOfWeek: string | null
  interval: number | null
  isActive: boolean
  streak: number
  bestStreak: number
  totalDone: number
  sortOrder: number
}

export interface HabitSuggestion {
  text: string
  consecutiveDays: number
  totalCount: number
  reason: string
}

export interface PeriodGoalItem {
  text: string
  completed: boolean
}

export interface FactItem {
  id: number
  text: string
  type: string
  category: string | null
}

export interface UseDailyReturn {
  selectedDate: string
  setSelectedDate: (date: string) => void
  planText: string
  setPlanText: (text: string) => void
  weekGoals: PeriodGoalItem[]
  monthGoals: PeriodGoalItem[]
  dailyEntry: DailyEntry | null
  tasks: OpenTask[]
  selectedTasks: Set<number>
  extraTasks: string[]
  newTaskText: string
  setNewTaskText: (text: string) => void
  saving: boolean
  evaluating: boolean
  message: string
  showMessage: (text: string, duration?: number) => void
  hasUnsavedChanges: boolean

  habits: Habit[]
  habitSuggestions: HabitSuggestion[]
  addHabitsToTasks: (habitTexts?: string[]) => void
  createHabitFromTask: (taskText: string, frequency?: string, daysOfWeek?: number[]) => Promise<void>
  updateHabit: (habitId: number, updates: { taskText?: string; frequency?: string; daysOfWeek?: number[] }) => Promise<void>
  deleteHabit: (habitId: number) => Promise<void>

  checkingPlan: boolean
  checkPlanResult: CheckPlanResult | null
  checkPlan: () => Promise<void>
  clearCheckPlanResult: () => void

  chatMessages: ChatMessage[]
  chatInput: string
  setChatInput: (text: string) => void
  sendChatMessage: (initialMessage?: string) => Promise<void>
  sendingChat: boolean
  clearChat: () => void
  markChatProposalApplied: (messageId: string, appliedAt: string) => void
  requestPlanChatKickoff: (isSubmittingChat?: boolean, force?: boolean) => Promise<boolean>
  canShowPlanChatKickoffCta: boolean
  applyPlanTasksFromProposal: (planTasks: string[]) => void

  /** Свежепришедшее предложение расписания для фонового применения (карточка в чат не выкладывается) */
  pendingAutoApplyScheduleProposalId: string | null
  clearPendingAutoApplyScheduleProposal: () => void

  addTask: () => void
  addGoalToTasks: (goalText: string) => void
  removeTask: (taskId: number) => void
  postponeTask: (taskId: number, taskText: string, targetDate?: string) => Promise<void>
  toggleTaskSelection: (taskId: number) => void
  startEditingTask: (taskId: number, currentText: string) => void
  saveEditedTask: (taskId: number) => void
  cancelEditingTask: () => void
  editingTaskId: number | null
  editingTaskText: string
  setEditingTaskText: (text: string) => void

  draggedTaskId: number | null
  handleDragStart: (taskId: number) => void
  handleDragOver: (e: DragEvent) => void
  handleDrop: (targetTaskId: number) => void

  savePlan: () => Promise<boolean>
  evaluate: (router: { push: (path: string) => void }) => Promise<void>
}
