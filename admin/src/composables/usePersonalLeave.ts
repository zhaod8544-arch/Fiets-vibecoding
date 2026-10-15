import { onMounted, onUnmounted, type ComputedRef } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { currentSession } from '@/mock/personal/session'
let activeConfirm: (() => Promise<boolean>) | undefined
let approved = false

/** 退出先完成编辑保护，再注销会话。 */
export async function approvePersonalExit() {
  approved = activeConfirm ? await activeConfirm() : true
  return approved
}
export function resetPersonalExit() {
  approved = false
}

/** 同时保护站内离开与浏览器刷新；会话失效必须允许返回登录。 */
export function usePersonalLeave(dirty: ComputedRef<boolean>, confirm: () => Promise<boolean>) {
  onBeforeRouteLeave(() => approved || !currentSession() || confirm())
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(() => {
    activeConfirm = confirm
    window.addEventListener('beforeunload', beforeUnload)
  })
  onUnmounted(() => {
    if (activeConfirm === confirm) activeConfirm = undefined
    window.removeEventListener('beforeunload', beforeUnload)
  })
}
