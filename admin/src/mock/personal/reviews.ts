import type { Review, Scenario } from '@/types/personal'
import { copy, readLocal, stamp, validNumber, writeLocal } from './storage'
import { checkPeriod, checkText } from './goals'
import { isAnalysisStale, materialSnapshot } from './analysis'
import { requireSession } from './session'

export function blankReview(year: number, quarter: number): Review {
  return {
    id: crypto.randomUUID(),
    year,
    quarter,
    status: 'draft',
    body: '',
    score: '',
    reason: '',
    version: 0,
    savedAt: '',
    archiveVersion: 0,
    archivedAt: '',
    sourceArchiveId: '',
    analysis: null,
    snapshot: null,
    outdatedAtArchive: false
  }
}
export function allReviews() {
  requireSession()
  return copy(readLocal<Review[]>('reviews', []))
}
export function checkReview(review: Review, archive = false) {
  checkPeriod(review.year, review.quarter)
  checkText(review.body, '汇报正文', 20000, archive)
  checkText(review.reason, '自评理由', 2000, archive)
  if (archive && review.score === '') throw new Error('请填写本人自评分')
  if (review.score !== '' && !validNumber(review.score, 2, 0, 100))
    throw new Error('本人自评分须为 0～100，最多保留 2 位小数')
}
function writeReviews(records: Review[], message: string) {
  try {
    writeLocal('reviews', records)
  } catch {
    throw new Error(message)
  }
}
export function saveReview(input: Review, scenario: Scenario) {
  requireSession()
  checkReview(input)
  if (scenario === 'failure') throw new Error('草稿保存失败，请重试。当前编辑内容已保留')
  const records = allReviews(),
    old = records.find((r) => r.id === input.id)
  if (old?.status === 'archived') throw new Error('已归档版本仅供查看，需编辑请新增修订草稿。')
  if (scenario === 'conflict' || (old ? old.version !== input.version : input.version !== 0))
    throw new Error('草稿已在其他窗口编辑，请保留当前内容并重新加载最新版本')
  if (old && (old.year !== input.year || old.quarter !== input.quarter))
    throw new Error('草稿所属周期不能修改')
  const next = {
    ...copy(input),
    status: 'draft' as const,
    version: input.version + 1,
    savedAt: stamp(),
    updatedAt: Date.now()
  }
  if (
    old &&
    JSON.stringify({ ...old, version: 0, savedAt: '', updatedAt: 0 }) ===
      JSON.stringify({ ...input, version: 0, savedAt: '', updatedAt: 0 })
  )
    return copy(old)
  if (old) records[records.indexOf(old)] = next
  else records.push(next)
  writeReviews(records, '草稿保存失败，请重试。当前编辑内容已保留')
  return copy(next)
}
export function archiveReview(id: string, version: number, fail: boolean) {
  requireSession()
  const records = allReviews(),
    record = records.find((r) => r.id === id)
  if (!record) throw new Error('无权访问该记录。')
  if (record.status === 'archived') return copy(record)
  if (record.version !== version)
    throw new Error('草稿已在其他窗口编辑，请保留当前内容并重新加载最新版本')
  checkReview(record, true)
  if (fail) throw new Error('归档失败，请重试。草稿已保留')
  record.outdatedAtArchive = record.analysis ? isAnalysisStale(record.analysis) : false
  record.snapshot = record.analysis
    ? copy(record.analysis.snapshot)
    : record.sourceArchiveId && record.snapshot
      ? copy(record.snapshot)
      : materialSnapshot(record.year, record.quarter)
  record.archiveVersion =
    Math.max(
      0,
      ...records
        .filter((r) => r.year === record.year && r.quarter === record.quarter)
        .map((r) => r.archiveVersion)
    ) + 1
  record.status = 'archived'
  record.archivedAt = stamp()
  record.updatedAt = Date.now()
  writeReviews(records, '归档失败，请重试。草稿已保留')
  return copy(record)
}
export function reviseReview(id: string) {
  requireSession()
  const records = allReviews(),
    original = records.find((r) => r.id === id && r.status === 'archived')
  if (!original) throw new Error('无权访问该记录。')
  const draft = {
    ...copy(original),
    id: crypto.randomUUID(),
    status: 'draft' as const,
    sourceArchiveId: original.id,
    archiveVersion: 0,
    archivedAt: '',
    version: 1,
    savedAt: stamp(),
    updatedAt: Date.now()
  }
  records.push(draft)
  writeReviews(records, '修订草稿保存失败，请重试')
  return copy(draft)
}
