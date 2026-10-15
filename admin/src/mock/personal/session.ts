import { readLocal, writeLocal } from './storage'
export interface PersonalSession {
  name: string
  account: string
  expires: number
}
const sessionKey = 'okr-prototype:session'
export const loginErrors: Record<string, string> = {
  cancel: '已取消飞书授权，请重新登录。',
  failure: '飞书登录失败，请重试。',
  config: '飞书登录尚未配置，请联系应用管理员。',
  permission: '当前飞书账号无权使用此应用，请联系企业管理员。',
  enterprise: '当前飞书账号不属于允许登录的企业，请更换账号。',
  identity: '未能获取有效飞书身份，请重新授权。',
  state: '本次授权请求无效，请重新登录。',
  expired: '本次授权已失效，请重新登录。',
  account: '登录未完成，请重试。'
}
export function currentSession(): PersonalSession | null {
  const raw = sessionStorage.getItem(sessionKey)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as PersonalSession
    return value.account === 'prototype-employee' && value.expires > Date.now() ? value : null
  } catch {
    return null
  }
}
export function requireSession() {
  const session = currentSession()
  if (!session) {
    window.dispatchEvent(new Event('personal-session-expired'))
    throw new Error('登录已失效，请通过飞书重新登录。')
  }
  return session
}
export function loginMock(scenario: string) {
  if (scenario !== 'success') throw new Error(loginErrors[scenario] || loginErrors.failure)
  const first = !readLocal('visited', false)
  try {
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify({
        name: '原型体验员工',
        account: 'prototype-employee',
        expires: Date.now() + 8 * 3600000
      })
    )
    writeLocal('visited', true)
  } catch {
    sessionStorage.removeItem(sessionKey)
    throw new Error('登录未完成，请重试。')
  }
  return { first }
}
export function logoutMock(fail: boolean) {
  requireSession()
  if (fail) throw new Error('退出失败，请重试。')
  sessionStorage.removeItem(sessionKey)
  return true
}
export function expireMock() {
  sessionStorage.removeItem(sessionKey)
  window.dispatchEvent(new Event('personal-session-expired'))
}
