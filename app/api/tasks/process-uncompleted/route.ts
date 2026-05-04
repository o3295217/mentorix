import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDateParam } from '@/lib/dates'
import { requireUserId } from '@/lib/get-user-id'
import { areTasksSimilar } from '@/lib/task-match'
import { safeParseJson } from '@/lib/api-utils'

interface TransferAction {
  type: 'transfer'
  date: string
}

interface BacklogAction {
  type: 'backlog'
}

interface CompletedAction {
  type: 'completed'
}

interface SkipAction {
  type: 'skip'
}

type TaskAction = TransferAction | BacklogAction | CompletedAction | SkipAction

interface TaskDecision {
  taskId: number
  taskText: string
  action: TaskAction
}

interface RequestBody {
  decisions: TaskDecision[]
  sourceDate: string
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request)
    const body: RequestBody = await request.json()
    const { decisions, sourceDate } = body

    if (!decisions || !Array.isArray(decisions)) {
      return NextResponse.json({ error: 'decisions array required' }, { status: 400 })
    }

    const results: { taskId: number; success: boolean; action: string }[] = []

    for (const decision of decisions) {
      const { taskId, taskText, action } = decision

      try {
        switch (action.type) {
          case 'transfer': {
            // Перенести задачу на другой день = добавить в план того дня
            const targetDate = parseDateParam(action.date)
            
            // Найти или создать запись на целевую дату
            let targetEntry = await prisma.dailyEntry.findFirst({
              where: { userId, date: targetDate }
            })

            if (!targetEntry) {
              targetEntry = await prisma.dailyEntry.create({
                data: { userId, date: targetDate, planText: '' }
              })
            }

            // Добавить задачу в план (если её там ещё нет)
            const currentPlan = targetEntry.planText || ''
            const planLines = currentPlan.split('\n').filter(l => l.trim())
            
            // Проверить, нет ли уже такой задачи
            const normalizedTaskText = taskText.toLowerCase().trim()
            const alreadyExists = planLines.some(
              line => line.toLowerCase().trim() === normalizedTaskText
            )

            if (!alreadyExists) {
              const newPlan = [...planLines, taskText].join('\n')
              await prisma.dailyEntry.update({
                where: { id: targetEntry.id },
                data: { planText: newPlan }
              })
            }

            results.push({ taskId, success: true, action: 'transferred' })
            break
          }

          case 'backlog': {
            // Добавить в OpenTasks
            // Проверить, нет ли уже похожей задачи
            const existingTasks = await prisma.openTask.findMany({
              where: {
                userId,
                isClosed: false
              },
              select: { taskText: true }
            })

            const hasSimilar = existingTasks.some(t => areTasksSimilar(t.taskText, taskText))

            if (!hasSimilar) {
              await prisma.openTask.create({
                data: {
                  userId,
                  taskText: taskText,
                  taskType: 'operational', // по умолчанию операционная
                  originDate: parseDateParam(sourceDate)
                }
              })
            }

            results.push({ taskId, success: true, action: 'added_to_backlog' })
            break
          }

          case 'completed': {
            // Пометить как выполненную — добавить в selectedTasks текущего дня
            const sourceEntry = await prisma.dailyEntry.findFirst({
              where: { userId, date: parseDateParam(sourceDate) }
            })

            if (sourceEntry) {
              const selectedTasks = safeParseJson<number[]>(sourceEntry.selectedTasksJson, [])

              if (!selectedTasks.includes(taskId)) {
                selectedTasks.push(taskId)
                await prisma.dailyEntry.update({
                  where: { id: sourceEntry.id },
                  data: { selectedTasksJson: selectedTasks }
                })
              }
            }

            results.push({ taskId, success: true, action: 'marked_completed' })
            break
          }

          case 'skip': {
            // Ничего не делаем
            results.push({ taskId, success: true, action: 'skipped' })
            break
          }
        }
      } catch (error) {
        console.error(`Error processing task ${taskId}:`, error)
        results.push({ taskId, success: false, action: 'error' })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Error processing task decisions:', error)
    return NextResponse.json(
      { error: 'Failed to process task decisions' },
      { status: 500 }
    )
  }
}
