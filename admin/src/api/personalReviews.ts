import request from '@/utils/http'
import type { Analysis, MaterialSnapshot, Review, Scenario } from '@/types/personal'
/** 查询本人的草稿与归档。 */
export function getReviews() {
  return request.get<Review[]>({ url: '/prototype/personal/reviews', showErrorMessage: false })
}
/** 保存人工草稿及采用的分析，不自动修改自评分。 */
export function putReview(review: Review, scenario: Scenario) {
  return request.post<Review>({
    url: '/prototype/personal/reviews',
    data: { review, scenario },
    showErrorMessage: false
  })
}
/** 按已保存材料建立分析输入快照。 */
export function startAnalysis(year: number, quarter: number) {
  return request.post<{ id: string; merged: boolean }>({
    url: '/prototype/personal/analysis-start',
    data: { year, quarter },
    showErrorMessage: false
  })
}
/** 模拟完成生成，仅返回独立预览。 */
export function completeAnalysis(id: string, scenario: string) {
  return request.post<Analysis>({
    url: '/prototype/personal/analysis-finish',
    data: { id, scenario },
    showErrorMessage: false
  })
}
/** 归档已保存草稿，重复调用返回原归档。 */
export function postArchive(id: string, version: number, fail: boolean) {
  return request.post<Review>({
    url: '/prototype/personal/archive',
    data: { id, version, fail },
    showErrorMessage: false
  })
}
/** 从归档副本建立修订草稿。 */
export function postRevision(id: string) {
  return request.post<Review>({
    url: '/prototype/personal/revise',
    data: { id },
    showErrorMessage: false
  })
}
/** 获取指定季度的材料版本用于识别旧分析。 */
export function getMaterials(year: number, quarter: number) {
  return request.get<MaterialSnapshot>({
    url: '/prototype/personal/materials',
    params: { year, quarter },
    showErrorMessage: false
  })
}
