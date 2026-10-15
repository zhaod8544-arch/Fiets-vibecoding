<!-- 我的季度目标：筛选、生效版本、编辑和历史查看。 -->
<template>
  <div class="business-page">
    <div class="page-heading"
      ><div><h2>我的季度目标</h2><p>将季度方向拆解为可核查的关键结果，持续记录实际进展。</p></div
      ><ElButton type="primary" @click="openNew">新增 O</ElButton></div
    >
    <ElCard shadow="never"
      ><div class="toolbar"
        ><ElInputNumber
          v-model="year"
          :controls="false"
          :min="1000"
          :max="9999"
          aria-label="年度"
        /><ElSelect v-model="quarter" aria-label="季度" style="width: 160px"
          ><ElOption v-for="q in 4" :key="q" :label="`第 ${q} 季度`" :value="q" /></ElSelect
        ><ElButton :loading="loading" @click="query">查询</ElButton
        ><ElButton @click="reset">本季度</ElButton></div
      ></ElCard
    >
    <ElAlert v-if="error" :title="error" type="error" :closable="false" />
    <ElCard v-loading="loading" shadow="never"
      ><ElEmpty v-if="!filtered.length" description="本季度暂无目标，请新增季度目标" /><div
        v-for="goal in filtered"
        :key="goal.id"
        class="goal-card"
        ><div class="toolbar"
          ><ElTag>已生效 · v{{ goal.version }}</ElTag
          ><ElButton text type="primary" @click="edit(goal)">编辑</ElButton
          ><ElButton text @click="history(goal)">查看版本</ElButton></div
        ><GoalDetails :goal="goal" /></div
    ></ElCard>
    <ElDialog
      v-model="visible"
      :title="draft.version ? '编辑季度目标' : '新增季度目标'"
      width="900px"
      :close-on-click-modal="false"
      :before-close="closeEditor"
      @closed="clearEditor"
    >
      <ElAlert
        title="实际进度由本人维护，AI 不会自动修改；后续目标编辑不影响已归档内容。"
        :closable="false"
      />
      <ElForm label-position="top" class="editor-form" :disabled="saving">
        <div v-if="!draft.version" class="toolbar">
          <ElFormItem label="年度（必填）"
            ><ElInputNumber
              v-model="draft.year"
              :controls="false"
              :min="1000"
              :max="9999"
              @change="changePeriod"
          /></ElFormItem>
          <ElFormItem label="季度（必填）"
            ><ElSelect v-model="draft.quarter" style="width: 160px" @change="changePeriod"
              ><ElOption v-for="q in 4" :key="q" :label="`第 ${q} 季度`" :value="q" /></ElSelect
          ></ElFormItem>
        </div>
        <div class="toolbar"
          ><ElTag>{{ draft.year }} 年 · 第 {{ draft.quarter }} 季度</ElTag
          ><span>所属周期保存后不可修改</span></div
        >
        <ElFormItem label="O 名称（必填）"
          ><ElInput v-model="draft.name" maxlength="200" show-word-limit
        /></ElFormItem>
        <KrFields
          v-for="(kr, i) in draft.krs"
          :key="kr.id"
          v-model="draft.krs[i]"
          :index="i"
          :year="draft.year"
          :quarter="draft.quarter"
        />
        <ElButton @click="draft.krs.push(blankKr(draft.year, draft.quarter))">新增 KR</ElButton>
        <ElFormItem label="原型保存场景"
          ><ElSelect v-model="scenario"
            ><ElOption label="正常保存" value="success" /><ElOption
              label="模拟保存失败"
              value="failure" /><ElOption label="模拟版本冲突" value="conflict" /></ElSelect
        ></ElFormItem>
      </ElForm>
      <ElAlert v-if="saveError" :title="saveError" type="error" :closable="false" />
      <template #footer
        ><ElButton @click="closeEditor()">取消</ElButton
        ><ElButton :disabled="saving" @click="reload">重新加载最新版本</ElButton
        ><ElButton type="primary" :loading="saving" @click="save">保存</ElButton></template
      >
    </ElDialog>
    <ElDrawer v-model="historyVisible" title="历史版本仅供查看" size="760px" @closed="versions = []"
      ><ElEmpty v-if="!versions.length" description="暂无目标版本记录" /><ElCollapse
        ><ElCollapseItem
          v-for="g in versions"
          :key="g.version"
          :title="`v${g.version} · ${g.savedAt}`"
          :name="g.version"
          ><GoalDetails :goal="g" /></ElCollapseItem></ElCollapse
    ></ElDrawer>
  </div>
</template>
<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { usePersonalLeave } from '@/composables/usePersonalLeave'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import type { Goal, Scenario } from '@/types/personal'
  import { getGoals, getGoalVersions, putGoal } from '@/api/personalGoals'
  import { blankGoal, blankKr, checkGoal, checkPeriod } from '@/mock/personal/goals'
  import { copy, period, quarterEnd } from '@/mock/personal/storage'
  import GoalDetails from './GoalDetails.vue'
  import KrFields from './KrFields.vue'
  const current = period()
  const year = ref(current.year),
    quarter = ref(current.quarter)
  const selected = ref({ ...current })
  const rows = ref<Goal[]>([]),
    versions = ref<Goal[]>([])
  const loading = ref(false),
    visible = ref(false),
    saving = ref(false),
    historyVisible = ref(false)
  const error = ref(''),
    saveError = ref(''),
    baseline = ref('')
  const scenario = ref<Scenario>('success')
  const draft = ref(blankGoal(current.year, current.quarter))
  const dirty = computed(() => visible.value && JSON.stringify(draft.value) !== baseline.value)
  const filtered = computed(() =>
    rows.value.filter((g) => g.year === selected.value.year && g.quarter === selected.value.quarter)
  )
  async function allowLeave() {
    if (!dirty.value) return true
    try {
      await ElMessageBox.confirm('当前内容尚未保存，是否放弃编辑并切换？', '未保存内容', {
        confirmButtonText: '放弃并切换',
        cancelButtonText: '继续编辑',
        type: 'warning'
      })
      return true
    } catch {
      return false
    }
  }
  usePersonalLeave(dirty, allowLeave)
  function changePeriod() {
    try {
      checkPeriod(draft.value.year, draft.value.quarter)
    } catch {
      return
    }
    draft.value.krs.forEach((kr) => {
      kr.deadline = quarterEnd(draft.value.year, draft.value.quarter)
    })
  }
  async function query() {
    if (!(await allowLeave())) return
    loading.value = true
    error.value = ''
    try {
      checkPeriod(year.value, quarter.value)
      rows.value = (await getGoals()).data
      selected.value = { year: year.value, quarter: quarter.value }
      visible.value = false
    } catch (cause) {
      error.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }
  function reset() {
    year.value = current.year
    quarter.value = current.quarter
    void query()
  }
  function edit(goal: Goal) {
    draft.value = copy(goal)
    baseline.value = JSON.stringify(draft.value)
    saveError.value = ''
    scenario.value = 'success'
    visible.value = true
  }
  function openNew() {
    edit(blankGoal(selected.value.year, selected.value.quarter))
  }
  async function closeEditor(done?: () => void) {
    if (saving.value || !(await allowLeave())) return
    visible.value = false
    done?.()
  }
  function clearEditor() {
    draft.value = blankGoal(selected.value.year, selected.value.quarter)
    saveError.value = ''
    baseline.value = ''
  }
  async function save() {
    if (saving.value) return
    saving.value = true
    saveError.value = ''
    try {
      checkGoal(draft.value)
      await putGoal(copy(draft.value), scenario.value)
      baseline.value = JSON.stringify(draft.value)
      visible.value = false
      ElMessage.success('季度目标已保存并生效')
      await query()
    } catch (cause) {
      saveError.value = (cause as Error).message
    } finally {
      saving.value = false
    }
  }
  async function history(goal: Goal) {
    loading.value = true
    try {
      versions.value = (await getGoalVersions(goal.id)).data.slice().reverse()
      historyVisible.value = true
    } catch (cause) {
      error.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }
  async function reload() {
    if (!draft.value.version || !(await allowLeave())) return
    try {
      const list = (await getGoals()).data
      const latest = list.find((g) => g.id === draft.value.id)
      if (latest) edit(latest)
    } catch (cause) {
      saveError.value = (cause as Error).message
    }
  }
  onMounted(query)
</script>
<style scoped>
  .business-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .page-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  h2 {
    font-size: 24px;
    margin-bottom: 8px;
  }
  p {
    color: var(--el-text-color-secondary);
  }
  .toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .goal-card {
    padding: 20px 0;
    border-bottom: 1px solid var(--el-border-color-light);
  }
  .editor-form {
    margin-top: 20px;
  }
  .editor-form .toolbar {
    margin-bottom: 16px;
  }
  .el-card {
    border: none;
    box-shadow: none;
    border-radius: 12px;
  }
</style>
