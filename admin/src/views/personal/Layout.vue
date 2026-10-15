<!-- 个人业务导航及会话反馈。 -->
<template>
  <div class="personal-shell">
    <aside class="personal-sidebar">
      <div class="brand"
        ><span class="brand-mark">O</span
        ><div>个人成长工作台<small>OKR & QUARTERLY REVIEW</small></div></div
      >
      <ElMenu :default-active="route.path" router>
        <ElMenuItem index="/my-goals">我的季度目标</ElMenuItem>
        <ElMenuItem index="/my-weekly">我的周报</ElMenuItem>
        <ElMenuItem index="/my-reviews">我的绩效汇报</ElMenuItem>
      </ElMenu>
      <div class="sidebar-note">持续记录，回看成长。<br />仅管理本人工作材料与自评。</div>
    </aside>
    <section class="personal-main">
      <header class="personal-header">
        <span>{{ route.meta.title }}</span>
        <div class="header-actions"
          ><ElTag type="warning">Mock 原型 · 非真实授权 / AI</ElTag>
          <ElDropdown @command="command"
            ><ElButton text :loading="busy">{{ currentSession()?.name }} ▾</ElButton>
            <template #dropdown
              ><ElDropdownMenu
                ><ElDropdownItem command="logout">退出登录</ElDropdownItem
                ><ElDropdownItem command="fail">模拟退出失败</ElDropdownItem
                ><ElDropdownItem command="expire">模拟会话失效</ElDropdownItem></ElDropdownMenu
              ></template
            >
          </ElDropdown>
        </div>
      </header>
      <div class="personal-content"><RouterView /></div>
    </section>
  </div>
</template>
<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import { personalLogout } from '@/api/personal'
  import { currentSession, expireMock } from '@/mock/personal/session'
  import { approvePersonalExit, resetPersonalExit } from '@/composables/usePersonalLeave'
  const route = useRoute()
  const router = useRouter()
  const busy = ref(false)
  async function command(value: string) {
    if (value === 'expire') return expireMock()
    if (busy.value) return
    busy.value = true
    try {
      if (!(await approvePersonalExit())) return
      await personalLogout(value === 'fail')
      await router.replace({ path: '/auth/login', query: { message: '已退出登录。' } })
    } catch (error) {
      ElMessage.error((error as Error).message)
    } finally {
      resetPersonalExit()
      busy.value = false
    }
  }
  function expire() {
    void router.replace({
      path: '/auth/login',
      query: { message: '登录已失效，请通过飞书重新登录。' }
    })
  }
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    window.addEventListener('personal-session-expired', expire)
    timer = setInterval(() => {
      if (!currentSession()) expire()
    }, 15000)
  })
  onUnmounted(() => {
    window.removeEventListener('personal-session-expired', expire)
    clearInterval(timer)
  })
</script>
<style scoped>
  .personal-shell {
    min-height: 100vh;
    display: flex;
    background: var(--el-bg-color-page);
    color: var(--el-text-color-primary);
  }
  .personal-sidebar {
    width: 240px;
    flex-shrink: 0;
    background: var(--el-bg-color);
    border-right: 1px solid var(--el-border-color-light);
  }
  .brand {
    padding: 28px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
  }
  .brand small {
    display: block;
    font-size: 9px;
    color: var(--el-text-color-secondary);
    margin-top: 6px;
    letter-spacing: 1px;
  }
  .brand-mark {
    width: 36px;
    height: 36px;
    background: var(--el-color-primary);
    color: white;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 24px;
  }
  .el-menu {
    border-right: 0;
  }
  .sidebar-note {
    padding: 24px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 2;
  }
  .personal-main {
    flex: 1;
    min-width: 0;
  }
  .personal-header {
    padding: 16px 28px;
    background: var(--el-bg-color);
    border-bottom: 1px solid var(--el-border-color-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-actions {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .personal-content {
    padding: 24px;
    max-width: 1600px;
    margin: auto;
  }
</style>
