import request from '@/utils/http'
import type { Recommendation, Scenario, Weekly } from '@/types/personal'
/** 查询原型身份的全部周报。 */
export function getWeekly() {
  return request.get<Weekly[]>({ url: '/prototype/personal/weekly', showErrorMessage: false })
}
/** 保存指定版本的完整周报，重复周返回已有记录。 */
export function putWeekly(report: Weekly, scenario: Scenario) {
  return request.post<{ report: Weekly; duplicate: boolean }>({
    url: '/prototype/personal/weekly',
    data: { report, scenario },
    showErrorMessage: false
  })
}
/** 查询只读周报历史。 */
export function getWeeklyVersions(id: string) {
  return request.get<Weekly[]>({
    url: '/prototype/personal/weekly-versions',
    params: { id },
    showErrorMessage: false
  })
}
/** 对指定已保存版本模拟推荐，不修改手动关联。 */
export function getRecommendations(id: string, version: number, scenario: string) {
  return request.post<Recommendation[]>({
    url: '/prototype/personal/recommend',
    data: { id, version, scenario },
    showErrorMessage: false
  })
}
