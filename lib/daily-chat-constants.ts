export const FALLBACK_INVALID_PROPOSAL_MESSAGE = 'Я подготовил черновик расписания, но он не прошёл проверку. Попросите меня собрать расписание ещё раз.'

export const TASK_LIST_PROPOSAL_WITH_REJECTED_SCHEDULE_MESSAGE_PREFIX = 'Я собрал список задач и могу добавить его в план.'
export const TASK_LIST_PROPOSAL_WITH_REJECTED_SCHEDULE_MESSAGE_CTA = 'Расписание пока не применяю — сначала добавим список, а временную шкалу можно собрать отдельно.'
export const DEFAULT_REJECTED_SCHEDULE_HUMAN_REASON = 'часть временной шкалы противоречит текущему плану.'

export type DailyScheduleIssueAction = 'place_from_current' | 'ignore_current' | 'edit'

export const DAILY_SCHEDULE_ISSUE_ACTIONS: Array<{
  action: DailyScheduleIssueAction
  label: string
  marker: string
  modelInstruction: string
}> = [
  {
    action: 'place_from_current',
    label: 'С текущего момента',
    marker: '[SYSTEM_PLACE_SCHEDULE_FROM_CURRENT]',
    modelInstruction: 'Собери расписание для добавленного списка задач на оставшуюся часть дня. Используй planningBasis: current_time — начинай размещение с текущего момента и не планируй уже прошедшее время.',
  },
  {
    action: 'ignore_current',
    label: 'День с начала',
    marker: '[SYSTEM_PLACE_SCHEDULE_FROM_DAY_START]',
    modelInstruction: 'Собери расписание для добавленного списка задач на весь день. Используй planningBasis: day_start — игнорируй текущее время и планируй так, как будто день ещё не начался.',
  },
  {
    action: 'edit',
    label: 'Учесть сделанное',
    marker: '[SYSTEM_EDIT_SCHEDULE_WITH_COMPLETED_DAY_PART]',
    modelInstruction: 'Скорректируй расписание для добавленного списка задач с учётом того, что часть дня уже прошла и я уже успел(а) что-то сделать. Используй planningBasis: custom_time — предложи правку существующей временной шкалы, не собирай день заново с нуля.',
  },
]

export function getDailyScheduleIssueActionByMarker(message: string) {
  const marker = message.trim()
  return DAILY_SCHEDULE_ISSUE_ACTIONS.find(item => item.marker === marker) ?? null
}

export function humanizeScheduleProposalDiagnostics(diagnostics: string[]): string {
  const text = diagnostics.join('\n').toLocaleLowerCase('ru-RU')
  if (text.includes('overlap')) return 'в расписании есть пересекающиеся блоки.'
  if (text.includes('starts before') || (text.includes('startminutes') && text.includes('<'))) return 'один из блоков начинается раньше выбранного начала дня.'
  if (text.includes('ends after') || (text.includes('block end') && text.includes('>'))) return 'один из блоков выходит за пределы выбранного дня.'
  if (text.includes('date mismatch') || text.includes('does not match request date')) return 'дата расписания не совпала с датой плана.'
  if (text.includes('timezone mismatch') || text.includes('does not match request timezone')) return 'часовой пояс расписания не совпал с часовым поясом плана.'
  if (text.includes('tasktext mismatch') || text.includes('does not match current plan') || text.includes('does not match newtasks')) return 'задачи на временной шкале не совпали со списком задач.'
  if (text.includes('taskindex') || text.includes('current plantasks') || text.includes('newtasks')) return 'часть блоков ссылается на задачи, которых нет в текущем списке.'
  if (text.includes('inside day range')) return 'часть расписания выходит за границы дня.'
  return DEFAULT_REJECTED_SCHEDULE_HUMAN_REASON
}

export function buildTaskListProposalWithRejectedScheduleMessage(reason: string): string {
  return `${TASK_LIST_PROPOSAL_WITH_REJECTED_SCHEDULE_MESSAGE_PREFIX} С временной шкалой не получилось: ${reason} ${TASK_LIST_PROPOSAL_WITH_REJECTED_SCHEDULE_MESSAGE_CTA}`
}
