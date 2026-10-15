import request from '@/utils/http'
import type { Goal, Scenario } from '@/types/personal'
/** 查询本人季度目标，原型仅返回本地模拟身份的数据。 */
export function getGoals() {
  return request.get<Goal[]>({ url: '/prototype/personal/goals', showErrorMessage: false })
}
/** 校验并保存完整 O/KR，携带版本进行冲突检查。 */
export function putGoal(goal: Goal, scenario: Scenario) {
  return request.post<Goal>({
    url: '/prototype/personal/goals',
    data: { goal, scenario },
    showErrorMessage: false
  })
}
/** 查询完整只读历史版本。 */
export function getGoalVersions(id: string) {
  return request.get<Goal[]>({
    url: '/prototype/personal/goal-versions',
    params: { id },
    showErrorMessage: false
  })
}
