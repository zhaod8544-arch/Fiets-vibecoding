import type { Recommendation, Scenario, Weekly, WorkItem } from '@/types/personal'
import { allGoals, checkText } from './goals'
import { copy, period, readLocal, stamp, today, validDate, weekOf, writeLocal } from './storage'
import { requireSession } from './session'
interface WeeklyRecord {
  current: Weekly
  history: Weekly[]
}
export function weeklyContent(report: Weekly) {
  return JSON.stringify({
    ...report,
    version: 0,
    savedAt: '',
    items: report.items.map((item) => ({ ...item, krNames: undefined }))
  })
}
export function blankItem(start: string, end: string): WorkItem {
  return {
    id: crypto.randomUUID(),
    date: today() >= start && today() <= end ? today() : start,
    work: '',
    outcome: '',
    krIds: []
  }
}
export function blankWeekly(date = today()): Weekly {
  const { start, end } = weekOf(date)
  return {
    id: crypto.randomUUID(),
    start,
    end,
    items: [blankItem(start, end)],
    blockers: '',
    plan: '',
    version: 0,
    savedAt: ''
  }
}
export function candidateKrs(date: string) {
  const p = period(date)
  return allGoals()
    .filter((g) => g.year === p.year && g.quarter === p.quarter)
    .flatMap((g) => g.krs.map((kr) => ({ ...kr, goalName: g.name })))
}
export function checkWeekly(report: Weekly) {
  const week = weekOf(report.start)
  if (week.start !== report.start || week.end !== report.end) throw new Error('请选择有效的所属周')
  if (!report.items.length) throw new Error('每份周报至少需要 1 条完整工作事项')
  report.items.forEach((item) => {
    if (!validDate(item.date) || item.date < report.start || item.date > report.end)
      throw new Error('事项日期须在所属周内')
    checkText(item.work, '工作事项', 2000)
    checkText(item.outcome, '成果说明', 3000, false)
    const ids = candidateKrs(item.date).map((kr) => kr.id)
    if (item.krIds.some((id) => !ids.includes(id))) throw new Error('请选择事项所属季度的本人 KR')
  })
  checkText(report.blockers, '阻碍', 2000, false)
  checkText(report.plan, '下周计划', 2000, false)
}
export function allWeekly() {
  requireSession()
  return copy(readLocal<WeeklyRecord[]>('weekly', []).map((r) => r.current)).sort((a, b) =>
    b.start.localeCompare(a.start)
  )
}
export function weeklyVersions(id: string) {
  requireSession()
  const record = readLocal<WeeklyRecord[]>('weekly', []).find((r) => r.current.id === id)
  if (!record) throw new Error('无权访问该记录。')
  return copy(record.history)
}
export function saveWeekly(input: Weekly, scenario: Scenario) {
  requireSession()
  checkWeekly(input)
  if (scenario === 'failure') throw new Error('保存失败，请重试。当前编辑内容已保留')
  const records = readLocal<WeeklyRecord[]>('weekly', [])
  const record = records.find((r) => r.current.id === input.id)
  const duplicate = records.find(
    (r) => r.current.start === input.start && r.current.id !== input.id
  )
  if (duplicate) return { report: copy(duplicate.current), duplicate: true }
  if (
    scenario === 'conflict' ||
    (record ? record.current.version !== input.version : input.version !== 0)
  ) {
    throw new Error('周报已在其他窗口编辑，请保留当前内容并重新加载最新版本')
  }
  if (record && (record.current.start !== input.start || record.current.end !== input.end))
    throw new Error('首次保存后不能改周')
  if (record && weeklyContent(record.current) === weeklyContent(input))
    return { report: copy(record.current), duplicate: false }
  const next = { ...copy(input), version: input.version + 1, savedAt: stamp() }
  next.items.forEach((item) => {
    const options = candidateKrs(item.date)
    item.krNames = Object.fromEntries(
      item.krIds.map((id) => [id, options.find((kr) => kr.id === id)?.description || id])
    )
  })
  if (record) {
    record.current = next
    record.history.push(copy(next))
  } else records.push({ current: next, history: [copy(next)] })
  try {
    writeLocal('weekly', records)
  } catch {
    throw new Error('保存失败，请重试。当前编辑内容已保留')
  }
  return { report: copy(next), duplicate: false }
}
export function recommendWeekly(id: string, version: number, scenario: string): Recommendation[] {
  const report = allWeekly().find((r) => r.id === id && r.version === version)
  if (!report) throw new Error('周报内容已变化，请基于最新已保存版本重新推荐')
  const errors: Record<string, string> = {
    config: 'AI 服务尚未配置，暂无法推荐，可手动关联 KR',
    timeout: 'AI 关联推荐超时，请重试',
    rate: 'AI 关联推荐请求过于频繁，请稍后重试',
    invalid: 'AI 关联推荐结果无效，请重试'
  }
  if (errors[scenario]) throw new Error(errors[scenario])
  if (!report.items.some((item) => candidateKrs(item.date).length))
    throw new Error('事项所属季度暂无 KR，可先保存未关联事项')
  if (scenario === 'empty') return []
  return report.items.flatMap((item) => {
    const kr = candidateKrs(item.date)[0]
    return kr
      ? [
          {
            itemId: item.id,
            krId: kr.id,
            description: kr.description,
            match: 75,
            reason: 'Mock 示例候选，请人工核对工作内容与关键结果。该匹配度为演示值。',
            source: `${item.date} · ${item.work}`
          }
        ]
      : []
  })
}
