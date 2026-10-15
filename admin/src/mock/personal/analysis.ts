import type { Analysis, MaterialSnapshot, KrAnalysis } from '@/types/personal'
import { allGoals, checkPeriod } from './goals'
import { allWeekly } from './weekly'
import { copy, period, quarterEnd, stamp, today } from './storage'
import { requireSession } from './session'
interface AnalysisTask {
  id: string
  input: MaterialSnapshot
  startedAt: number
  result?: Analysis
}
const tasks = new Map<string, AnalysisTask>()

export function materialSnapshot(year: number, quarter: number): MaterialSnapshot {
  const owner = requireSession().account
  checkPeriod(year, quarter)
  const goals = allGoals().filter((g) => g.year === year && g.quarter === quarter)
  const weekly = allWeekly()
    .map((r) => ({
      ...r,
      items: r.items.filter((item) => {
        const p = period(item.date)
        return p.year === year && p.quarter === quarter
      })
    }))
    .filter((r) => r.items.length)
  const key = JSON.stringify({
    goals: goals.map((g) => [g.id, g.version]),
    weekly: weekly.map((r) => [r.id, r.version, r.items.map((i) => i.id)])
  })
  return copy({ owner, year, quarter, key, goals, weekly, capturedAt: stamp() })
}
export function isAnalysisStale(analysis: Analysis) {
  return (
    materialSnapshot(analysis.snapshot.year, analysis.snapshot.quarter).key !==
    analysis.snapshot.key
  )
}
export function beginAnalysis(year: number, quarter: number) {
  const input = materialSnapshot(year, quarter)
  if (!input.goals.length) throw new Error('本季度尚无目标，请先补充目标；也可人工填写汇报。')
  if (!input.weekly.length)
    throw new Error('本季度尚无已保存工作材料，请先补充周报；也可人工填写汇报。')
  const existing = [...tasks.values()].find(
    (t) =>
      t.input.owner === input.owner &&
      t.input.key === input.key &&
      t.input.year === year &&
      t.input.quarter === quarter &&
      !t.result &&
      Date.now() - t.startedAt < 120000
  )
  if (existing) return { id: existing.id, merged: true }
  const task = { id: crypto.randomUUID(), input, startedAt: Date.now() }
  tasks.set(task.id, task)
  return { id: task.id, merged: false }
}
function analyzeKrs(snapshot: MaterialSnapshot): KrAnalysis[] {
  const items = snapshot.weekly.flatMap((r) => r.items)
  return snapshot.goals.flatMap((goal) =>
    goal.krs.map((kr) => {
      const related = items.filter((i) => i.krIds.includes(kr.id))
      const completed = related.filter((i) => i.date <= today() && i.outcome.trim())
      const outcomes = [...new Set(completed.map((i) => i.outcome.trim()))]
      const completion =
        kr.type === 'qualitative'
          ? '请对照完成标准核查实际完成情况；文字描述不构成独立证实。'
          : `${(kr.type === 'higher' ? Number(kr.actual) >= Number(kr.target) : Number(kr.actual) <= Number(kr.target)) ? '本人填报数值已达标' : '本人填报数值未达标'}，仍须核对成果证据。`
      return {
        krId: kr.id,
        description: kr.description,
        match: related.length ? 75 : null,
        reason: related.length
          ? '基于本人手动关联的模拟分析，匹配度为演示值，不代表完成度。'
          : '没有相关事项，无法判断相关程度。',
        completion,
        outcomes,
        sourceIds: related.map((i) => i.id),
        gap: outcomes.length
          ? '本人填报尚需人工核查真实性及对目标的实际贡献。'
          : '缺少已完成成果与可核查证据。'
      }
    })
  )
}
export function finishAnalysis(id: string, scenario: string): Analysis {
  const owner = requireSession().account,
    task = tasks.get(id)
  if (!task || task.input.owner !== owner) throw new Error('无权访问该记录。')
  if (task.result) return copy(task.result)
  const errors: Record<string, string> = {
    config: 'AI 服务尚未配置',
    connection: 'AI 连接失败',
    timeout: 'AI 分析超时（120秒等待上限）',
    rate: 'AI 请求限流',
    invalid: '分析结果无效，请重新生成',
    source: '分析来源无效，请重新生成'
  }
  if (errors[scenario] || Date.now() - task.startedAt > 120000) {
    tasks.delete(id)
    throw new Error(
      `${errors[scenario] || errors.timeout}。AI 分析失败，请重试；也可继续人工填写并归档`
    )
  }
  const details = analyzeKrs(task.input)
  const items = task.input.weekly.flatMap((report) => report.items)
  const outcomes = [
    ...new Set(
      items
        .filter((item) => item.date <= today() && item.outcome.trim())
        .map((item) => item.outcome.trim())
    )
  ]
  const dates = items.map((item) => item.date).sort()
  const firstDay = `${task.input.year}-${String((task.input.quarter - 1) * 3 + 1).padStart(2, '0')}-01`
  const lastDay = quarterEnd(task.input.year, task.input.quarter)
  const stage = today() <= lastDay || dates[0] > firstDay || dates[dates.length - 1] < lastDay
  const sufficient = details.every((d) => d.outcomes.length > 0) && !stage
  const result: Analysis = {
    id: crypto.randomUUID(),
    snapshot: copy(task.input),
    preview: `【Mock AI 汇报预览】\n${task.input.year}年第${task.input.quarter}季度\n\n${outcomes.length ? outcomes.map((o, i) => `${i + 1}. ${o}`).join('\n') : '暂无可核查的已完成成果。'}\n\n本预览仅演示汇总，重复成果已合并，未来计划未计作完成成果；请人工核对。`,
    suggestedScore: scenario === 'scored' && sufficient ? 75 : null,
    scoreReason:
      scenario === 'scored' && sufficient
        ? 'Mock评分示例75分：请逐项核对KR实际值、差距、贡献与来源，本分数不代表真实AI评价。'
        : sufficient
          ? '本次原型未提供 AI 建议分，请人工核对证据；可用模拟评分场景查看示例。'
          : '材料不足，暂不提供 AI 建议分；请核对季度覆盖及成果证据。',
    createdAt: stamp(),
    model: 'Mock 演示模型（未调用AI）',
    rule: 'v1 · 原型演示',
    details,
    insufficient: !sufficient,
    stage
  }
  task.result = result
  return copy(result)
}
