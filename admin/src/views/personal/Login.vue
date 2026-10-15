<!-- 独立飞书登录交互原型。 -->
<template>
  <main class="personal-login">
    <section>
      <span class="eyebrow">PERSONAL OKR · 季度成长记录</span>
      <h1>让每一周的投入，<br />成为看得见的成长。</h1>
      <p>从季度目标到每周记录，再到有据可查的个人自评。</p>
      <ol
        ><li>设定季度目标与关键结果</li
        ><li>持续记录工作与成果</li
        ><li>核对来源，自评并归档</li></ol
      >
    </section>
    <ElCard class="login-panel" shadow="never">
      <ElTag type="warning">Phase 1 · Mock 交互原型</ElTag>
      <h2>飞书 OKR 与季度绩效</h2><p>个人版 · 我的目标，我的成长</p>
      <ElAlert
        title="当前使用模拟身份和浏览器本地数据，不会发起真实飞书授权。"
        type="warning"
        :closable="false"
      />
      <ElForm label-position="top" class="login-form">
        <ElFormItem label="原型授权场景">
          <ElSelect v-model="scenario" :disabled="loading" aria-label="原型授权场景">
            <ElOption label="授权成功（模拟）" value="success" />
            <ElOption v-for="(label, key) in loginErrors" :key="key" :label="label" :value="key" />
          </ElSelect>
        </ElFormItem>
        <ElButton
          type="primary"
          size="large"
          :loading="loading"
          class="login-action"
          @click="login"
        >
          {{ loading ? '授权处理中，请稍候' : '通过飞书登录（Mock）' }}
        </ElButton>
      </ElForm>
      <ElAlert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <p class="muted">每人独立维护本人记录 · 无审批流程</p>
    </ElCard>
  </main>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { personalLogin } from '@/api/personal'
  import { loginErrors } from '@/mock/personal/session'
  const router = useRouter()
  const route = useRoute()
  const scenario = ref('success')
  const loading = ref(false)
  const error = ref(typeof route.query.message === 'string' ? route.query.message : '')
  async function login() {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      await new Promise((resolve) => setTimeout(resolve, 700))
      const { data } = await personalLogin(scenario.value)
      await router.replace(data.first ? '/my-goals' : '/my-weekly')
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '飞书登录失败，请重试。'
    } finally {
      loading.value = false
    }
  }
</script>
<style scoped>
  .personal-login {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 1fr 460px;
    gap: 64px;
    align-items: center;
    padding: 7vw;
    background: #e8eef6;
  }
  .eyebrow {
    color: var(--el-color-primary);
    font-weight: 600;
    letter-spacing: 2px;
  }
  h1 {
    font-size: 42px;
    line-height: 1.5;
    margin: 24px 0;
  }
  h2 {
    font-size: 24px;
    margin: 24px 0 12px;
  }
  p,
  li {
    color: var(--el-text-color-secondary);
    line-height: 2;
  }
  ol {
    padding-left: 22px;
    margin-top: 32px;
  }
  .login-panel {
    border-radius: 12px;
    padding: 12px;
  }
  .login-form {
    margin: 24px 0;
  }
  .login-action {
    width: 100%;
  }
  .muted {
    margin-top: 24px;
    font-size: 13px;
  }
  @media (max-width: 900px) {
    .personal-login {
      grid-template-columns: 1fr;
      gap: 24px;
      padding: 24px;
    }
    h1 {
      font-size: 28px;
    }
  }
</style>
