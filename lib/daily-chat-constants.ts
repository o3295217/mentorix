export const FALLBACK_INVALID_PROPOSAL_MESSAGE = 'Я подготовил черновик расписания, но он не прошёл проверку. Попросите меня собрать расписание ещё раз.'

export const TASK_LIST_PROPOSAL_WITH_REJECTED_SCHEDULE_MESSAGE_PREFIX = 'Я собрал список задач и могу добавить его в план.'
export const TASK_LIST_PROPOSAL_WITH_REJECTED_SCHEDULE_MESSAGE_CTA = 'Расписание пока не применяю — сначала добавим список, а временную шкалу можно собрать отдельно.'
export const DEFAULT_REJECTED_SCHEDULE_HUMAN_REASON = 'часть временной шкалы противоречит текущему плану.'

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
