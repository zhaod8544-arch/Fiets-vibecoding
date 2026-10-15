import type { Goal, KeyResult, Scenario } from '@/types/personal'
import {
  copy,
  period,
  quarterEnd,
  readLocal,
  stamp,
  validDate,
  validNumber,
  writeLocal
} from './storage'
import { requireSession } from './session'
interface GoalRecord {
  current: Goal
  history: Goal[]
}

export function blankKr(year: number, quarter: number): KeyResult {
  return {
    id: crypto.randomUUID(),
    description: '',
    metric: '',
    type: '',
    target: '',
    actual: '',
    unit: '',
    standard: '',
    situation: '尚未完成',
    progress: '',
    deadline: quarterEnd(year, quarter)
  }
}
export function blankGoal(year: number, quarter: number): Goal {
  return {
    id: crypto.randomUUID(),
    year,
    quarter,
    name: '',
    krs: [blankKr(year, quarter)],
    version: 0,
    savedAt: ''
  }
}
export function checkText(value: string, name: string, max: number, required = true) {
  if (required && !value.trim()) throw new Error(`请填写${name}`)
  if (value.length > max) throw new Error(`${name}不能超过${max}字`)
}
export function checkPeriod(year: number, quarter: number) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error('请选择有效的四位年度')
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) throw new Error('请选择有效季度')
}
export function checkGoal(goal: Goal) {
  checkPeriod(goal.year, goal.quarter)
  checkText(goal.name, 'O 名称', 200)
  if (!goal.krs.length) throw new Error('每个 O 至少需要 1 个完整 KR')
  goal.krs.forEach((kr) => {
    checkText(kr.description, 'KR 描述', 500)
    checkText(kr.metric, '衡量指标', 200)
    if (!['higher', 'lower', 'qualitative'].includes(kr.type)) throw new Error('请选择指标类型')
    if (kr.type === 'qualitative') {
      checkText(kr.standard, '完成标准', 1000)
      checkText(kr.situation, '实际完成情况', 1000)
    } else {
      if (![kr.target, kr.actual].every((v) => validNumber(v, 4))) {
        throw new Error('请输入有效数值，最多保留 4 位小数')
      }
      checkText(kr.unit, '单位', 20, false)
    }
    if (kr.progress !== '' && !validNumber(kr.progress, 2, 0, 100)) {
      throw new Error('进度须为 0～100，最多保留 2 位小数')
    }
    const datePeriod = period(kr.deadline)
    if (
      !validDate(kr.deadline) ||
      datePeriod.year !== goal.year ||
      datePeriod.quarter !== goal.quarter
    ) {
      throw new Error('截止日期须在所选季度内')
    }
  })
}
export function allGoals() {
  requireSession()
  return copy(readLocal<GoalRecord[]>('goals', []).map((r) => r.current))
}
export function goalVersions(id: string) {
  requireSession()
  const record = readLocal<GoalRecord[]>('goals', []).find((r) => r.current.id === id)
  if (!record) throw new Error('无权访问该记录。')
  return copy(record.history)
}
export function saveGoal(input: Goal, scenario: Scenario) {
  requireSession()
  checkGoal(input)
  if (scenario === 'failure') throw new Error('保存失败，请重试。当前编辑内容已保留')
  const records = readLocal<GoalRecord[]>('goals', [])
  const found = records.find((r) => r.current.id === input.id)
  if (
    scenario === 'conflict' ||
    (found ? found.current.version !== input.version : input.version !== 0)
  ) {
    throw new Error('目标已在其他窗口编辑，请保留当前内容并重新加载最新版本')
  }
  if (found && (found.current.year !== input.year || found.current.quarter !== input.quarter)) {
    throw new Error('编辑时不能改变所属年度和季度')
  }
  const goal = copy(input)
  goal.krs.forEach((kr) => {
    if (kr.type === 'qualitative') {
      kr.target = ''
      kr.actual = ''
      kr.unit = ''
    } else {
      kr.standard = ''
      kr.situation = ''
    }
  })
  if (
    found &&
    JSON.stringify({ ...found.current, savedAt: '', version: 0 }) ===
      JSON.stringify({ ...goal, savedAt: '', version: 0 })
  )
    return copy(found.current)
  goal.version += 1
  goal.savedAt = stamp()
  if (found) {
    found.current = goal
    found.history.push(copy(goal))
  } else records.push({ current: goal, history: [copy(goal)] })
  try {
    writeLocal('goals', records)
  } catch {
    throw new Error('保存失败，请重试。当前编辑内容已保留')
  }
  return copy(goal)
}
