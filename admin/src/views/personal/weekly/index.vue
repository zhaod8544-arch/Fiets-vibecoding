<!-- 周报筛选、自动保存、历史及人工采纳推荐。 -->
<template>
  <div class="business-page">
    <div class="page-heading"
      ><div><h2>我的周报</h2><p>记录正在开展的工作，让每一份成果都有来源。</p></div
      ><div class="toolbar"
        ><ElDatePicker
          v-model="newDate"
          value-format="YYYY-MM-DD"
          :clearable="false"
          aria-label="新增周报所属周"
        /><ElButton type="primary" @click="editor.openNew(newDate)">新增周报</ElButton></div
      ></div
    >
    <ElCard shadow="never"
      ><div class="toolbar"
        ><ElDatePicker
          v-model="start"
          value-format="YYYY-MM-DD"
          placeholder="起始周"
        /><ElDatePicker v-model="end" value-format="YYYY-MM-DD" placeholder="结束周" /><ElButton
          :loading="loading"
          @click="query"
          >查询</ElButton
        ><ElButton @click="allHistory">全部历史</ElButton></div
      ></ElCard
    >
    <ElAlert v-if="pageError" :title="pageError" type="error" :closable="false" />
    <ElCard v-loading="loading" shadow="never">
      <ElTable :data="paged" empty-text="暂无周报，请新增周报"
        ><ElTableColumn label="周起止日期" min-width="230"
          ><template #default="{ row }">{{ row.start }} 至 {{ row.end }}</template></ElTableColumn
        ><ElTableColumn label="工作事项数量" width="130"
          ><template #default="{ row }">{{ row.items.length }}</template></ElTableColumn
        ><ElTableColumn prop="savedAt" label="最近保存时间" min-width="180" /><ElTableColumn
          prop="version"
          label="保存版本"
          width="100"
        /><ElTableColumn label="操作" width="160"
          ><template #default="{ row }"
            ><ElButton text type="primary" @click="edit(row.id)">编辑</ElButton
            ><ElButton text @click="history(row.id)">详情查看</ElButton></template
          ></ElTableColumn
        ></ElTable
      >
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="filtered.length"
        layout="total, sizes, prev, pager, next"
        @size-change="page = 1"
      />
    </ElCard>
    <ElCard v-if="visible" shadow="never">
      <div class="toolbar"
        ><h3>{{ draft.start }} 至 {{ draft.end }}</h3
        ><ElTag :type="status === '已保存' ? 'success' : 'warning'">{{ status }}</ElTag
        ><span>v{{ draft.version }} · {{ draft.savedAt || '尚未保存' }}</span
        ><ElButton @click="editor.close()">关闭编辑</ElButton></div
      >
      <ElAlert
        title="停止输入 2 秒后自动保存；未来计划不计作成果。后续周报编辑不影响已归档内容。"
        :closable="false"
      />
      <ElForm label-position="top" class="editor-form">
        <WorkFields
          v-for="(item, i) in draft.items"
          :key="item.id"
          v-model="draft.items[i]"
          :index="i"
          :start="draft.start"
          :end="draft.end"
          :goals="goals"
        />
        <ElButton @click="draft.items.push(blankItem(draft.start, draft.end))"
          >新增工作事项</ElButton
        >
        <ElFormItem label="本周阻碍"
          ><ElInput
            v-model="draft.blockers"
            type="textarea"
            maxlength="2000"
            show-word-limit /></ElFormItem
        ><ElFormItem label="下周计划"
          ><ElInput v-model="draft.plan" type="textarea" maxlength="2000" show-word-limit
        /></ElFormItem>
        <div class="toolbar"
          ><ElSelect v-model="scenario" style="width: 190px" aria-label="原型保存场景"
            ><ElOption label="正常保存" value="success" /><ElOption
              label="模拟保存失败"
              value="failure" /><ElOption label="模拟版本冲突" value="conflict" /></ElSelect
          ><ElButton :loading="saving" type="primary" @click="editor.save">{{
            status === '保存失败' ? '重试保存' : '立即保存'
          }}</ElButton
          ><ElButton :disabled="saving" @click="editor.reload">重新加载最新版本</ElButton></div
        >
      </ElForm>
      <ElAlert v-if="error" :title="error" type="error" :closable="false" />
      <ElDivider />
      <div class="toolbar"
        ><h3>AI 关联推荐 <ElTag type="warning">模拟结果</ElTag></h3
        ><ElSelect v-model="aiScenario" style="width: 180px" aria-label="原型推荐场景"
          ><ElOption label="模拟正常推荐" value="success" /><ElOption
            label="无合适推荐"
            value="empty" /><ElOption label="AI未配置" value="config" /><ElOption
            label="超时"
            value="timeout" /><ElOption label="限流" value="rate" /><ElOption
            label="无效结果"
            value="invalid" /></ElSelect
        ><ElButton :loading="recommending" @click="editor.recommend">AI 关联推荐</ElButton></div
      >
      <p class="muted">关联仅表示相关性，不代表目标已完成；推荐不会自动覆盖手动关联。</p>
      <ElAlert
        v-if="recommendations.length && stale"
        title="周报内容已变化，请基于最新已保存版本重新推荐"
        type="warning"
        :closable="false"
      />
      <div v-for="rec in recommendations" :key="`${rec.itemId}:${rec.krId}`" class="recommendation"
        ><h4>{{ rec.description }}</h4
        ><p>匹配度 {{ rec.match }}%（Mock） · {{ rec.reason }}</p
        ><p>来源事项：{{ rec.source }}</p
        ><ElButton :disabled="stale" @click="editor.adopt(rec)">关联 KR</ElButton></div
      >
    </ElCard>
    <ElDrawer v-model="historyVisible" title="历史版本仅供查看" size="760px" @closed="versions = []"
      ><ElCollapse
        ><ElCollapseItem
          v-for="report in versions"
          :key="report.version"
          :title="`v${report.version} · ${report.savedAt}`"
          :name="report.version"
          ><WeeklyDetails :report="report" :goals="goals" /></ElCollapseItem></ElCollapse
    ></ElDrawer>
  </div>
</template>
<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import type { Goal, Weekly } from '@/types/personal'
  import { getGoals } from '@/api/personalGoals'
  import { getWeekly, getWeeklyVersions } from '@/api/personalWeekly'
  import { blankItem } from '@/mock/personal/weekly'
  import { today, weekOf } from '@/mock/personal/storage'
  import WorkFields from './WorkFields.vue'
  import WeeklyDetails from './WeeklyDetails.vue'
  import { useWeeklyEditor } from './useWeeklyEditor'
  const week = weekOf()
  const start = ref<string | null>(week.start),
    end = ref<string | null>(week.end),
    newDate = ref(today())
  const selected = ref({ start: week.start, end: week.start })
  const page = ref(1),
    pageSize = ref(10),
    rows = ref<Weekly[]>([]),
    goals = ref<Goal[]>([])
  const versions = ref<Weekly[]>([]),
    loading = ref(false),
    historyVisible = ref(false),
    pageError = ref('')
  const editor = useWeeklyEditor(refresh)
  const {
    draft,
    visible,
    saving,
    error,
    status,
    scenario,
    aiScenario,
    recommending,
    recommendations,
    stale
  } = editor
  const filtered = computed(() =>
    rows.value.filter(
      (r) =>
        (!selected.value.start || r.start >= selected.value.start) &&
        (!selected.value.end || r.start <= selected.value.end)
    )
  )
  const paged = computed(() =>
    filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
  )
  async function refresh() {
    const [reports, targets] = await Promise.all([getWeekly(), getGoals()])
    rows.value = reports.data
    goals.value = targets.data
  }
  async function query() {
    if (!(await editor.allowLeave())) return
    loading.value = true
    pageError.value = ''
    try {
      const first = start.value ? weekOf(start.value).start : '',
        last = end.value ? weekOf(end.value).start : ''
      if (first && last && last < first) throw new Error('结束周不能早于起始周')
      await refresh()
      selected.value = { start: first, end: last }
      page.value = 1
      if (visible.value) await editor.close(true)
    } catch (cause) {
      pageError.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }
  function allHistory() {
    start.value = null
    end.value = null
    void query()
  }
  async function edit(id: string) {
    const report = rows.value.find((row) => row.id === id)
    if (report && (await editor.allowLeave())) editor.open(report)
  }
  async function history(id: string) {
    loading.value = true
    try {
      versions.value = (await getWeeklyVersions(id)).data.slice().reverse()
      historyVisible.value = true
    } catch (cause) {
      pageError.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }
  onMounted(async () => {
    await query()
    editor.restore()
  })
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
    flex-wrap: wrap;
  }
  h2 {
    font-size: 24px;
    margin-bottom: 8px;
  }
  h3 {
    font-size: 17px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  p {
    color: var(--el-text-color-secondary);
    line-height: 1.8;
    overflow-wrap: anywhere;
  }
  .editor-form {
    margin-top: 20px;
  }
  .recommendation {
    padding: 16px 0;
    border-bottom: 1px solid var(--el-border-color-light);
  }
  .el-card {
    border: none;
    box-shadow: none;
    border-radius: 12px;
  }
  .el-pagination {
    margin-top: 20px;
  }
</style>
