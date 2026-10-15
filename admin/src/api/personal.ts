import request from '@/utils/http'
/** 模拟授权结果，仅在 Mock 模式注册。 */
export function personalLogin(scenario: string) {
  return request.post<{ first: boolean }>({
    url: '/prototype/personal/login',
    data: { scenario },
    showErrorMessage: false
  })
}
/** 模拟结束当前标签页的原型会话。 */
export function personalLogout(fail = false) {
  return request.post<boolean>({
    url: '/prototype/personal/logout',
    data: { fail },
    showErrorMessage: false,
    skipAuthHandler: true
  })
}
