<!-- 我的绩效汇报列表、分析来源和归档历史。 -->
<template>
  <div class="business-page">
    <div class="page-heading"
      ><div><h2>我的绩效汇报</h2><p>回看季度材料，核对分析来源，由自己完成自评与归档。</p></div
      ><div class="toolbar"
        ><ElButton @click="newDraft(false)">新增人工草稿</ElButton
        ><ElButton type="primary" @click="newDraft(true)">生成预览</ElButton></div
      ></div
    >
    <ElCard shadow="never"
      ><div class="toolbar"
        ><ElInputNumber
          v-model="year"
          :controls="false"
          :min="1000"
          :max="9999"
          aria-label="年度"
        /><ElSelect v-model="quarter" style="width: 150px" aria-label="季度"
          ><ElOption v-for="q in 4" :key="q" :label="`第 ${q} 季度`" :value="q" /></ElSelect
        ><ElSelect v-model="status" style="width: 150px" aria-label="汇报状态"
          ><ElOption label="全部状态" value="all" /><ElOption label="草稿" value="draft" /><ElOption
            label="已归档"
            value="archived" /></ElSelect
        ><ElButton :loading="loading" @click="query">查询</ElButton></div
      ></ElCard
    >
    <ElAlert v-if="error" :title="error" type="error" :closable="false" />
    <ElCard v-loading="loading" shadow="never">
      <ElTable :data="paged" empty-text="暂无符合条件的绩效汇报，可生成预览或新增人工草稿。">
        <ElTableColumn label="年度 / 季度" width="140"
          ><template #default="{ row }"
            >{{ row.year }} / Q{{ row.quarter }}</template
          ></ElTableColumn
        >
        <ElTableColumn label="状态 / 版本" min-width="170"
          ><template #default="{ row }"
            ><ElTag :type="row.status === 'archived' ? 'success' : 'info'">{{
              row.status === 'archived' ? `归档 v${row.archiveVersion}` : '草稿'
            }}</ElTag>
            · 草稿 v{{ row.version }}</template
          ></ElTableColumn
        >
        <ElTableColumn label="AI建议分 / 本人自评分" min-width="175"
          ><template #default="{ row }"
            >{{ row.analysis?.suggestedScore ?? '未评分' }} /
            {{ row.score === '' ? '未填写' : row.score }}</template
          ></ElTableColumn
        >
        <ElTableColumn label="材料标记" min-width="180"
          ><template #default="{ row }"
            ><ElTag v-if="row.analysis?.insufficient" type="warning">材料不足</ElTag
            ><ElTag v-if="row.analysis?.stage" type="info">阶段性分析</ElTag
            ><ElTag v-if="outdated(row.id)" type="danger">已过时</ElTag
            ><span v-if="!row.analysis">人工汇报，未采用AI</span></template
          ></ElTableColumn
        >
        <ElTableColumn prop="savedAt" label="最近保存时间" min-width="175" /><ElTableColumn
          label="归档时间"
          min-width="175"
          ><template #default="{ row }">{{ row.archivedAt || '未归档' }}</template></ElTableColumn
        >
        <ElTableColumn label="操作" min-width="300" fixed="right"
          ><template #default="{ row }"
            ><template v-if="row.status === 'draft'"
              ><ElButton text type="primary" @click="edit(row.id)">编辑</ElButton
              ><ElButton text @click="inspect(row.id, 'analysis')">查看分析</ElButton
              ><ElButton text @click="inspect(row.id, 'sources')">查看来源</ElButton
              ><ElButton text @click="regenerate(row.id)">重新生成</ElButton
              ><ElButton text type="success" @click="archive(row.id)">确认归档</ElButton></template
            ><template v-else
              ><ElButton text @click="inspect(row.id, 'history')">历史查看</ElButton
              ><ElButton text type="primary" @click="revise(row.id)">修订</ElButton></template
            ></template
          ></ElTableColumn
        >
      </ElTable>
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="filtered.length"
        layout="total, sizes, prev, pager, next"
        @size-change="page = 1"
      />
    </ElCard>
    <ReviewEditor :editor="editor" />
    <ElDrawer
      v-model="detailVisible"
      :title="detail?.status === 'archived' ? '归档历史' : '已保存分析与来源'"
      size="860px"
      @closed="detail = null"
      ><template v-if="detail"
        ><ReviewDetails v-if="detail.status === 'archived'" :review="detail" /><ElTabs
          v-else
          v-model="detailTab"
          ><ElTabPane name="analysis" label="查看分析"
            ><AnalysisView :analysis="detail.analysis" :stale="outdated(detail.id)" /></ElTabPane
          ><ElTabPane name="sources" label="查看来源"
            ><SourcesView
              :snapshot="
                detail.analysis?.snapshot || detail.snapshot
              " /></ElTabPane></ElTabs></template
    ></ElDrawer>
  </div>
</template>
<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import type { Review } from '@/types/personal'
  import { getMaterials, getReviews, postRevision } from '@/api/personalReviews'
  import { blankReview } from '@/mock/personal/reviews'
  import { checkPeriod } from '@/mock/personal/goals'
  import { copy, period } from '@/mock/personal/storage'
  import { useReviewEditor } from './useReviewEditor'
  import ReviewEditor from './ReviewEditor.vue'
  import ReviewDetails from './ReviewDetails.vue'
  import AnalysisView from './AnalysisView.vue'
  import SourcesView from './SourcesView.vue'
  const current = period(),
    year = ref(current.year),
    quarter = ref(current.quarter),
    status = ref('all')
  const selected = ref({ ...current, status: 'all' }),
    rows = ref<Review[]>([])
  const page = ref(1),
    pageSize = ref(10),
    loading = ref(false),
    error = ref(''),
    materialKey = ref('')
  const detail = ref<Review | null>(null),
    detailVisible = ref(false),
    detailTab = ref('analysis')
  const editor = useReviewEditor(refresh)
  const filtered = computed(() =>
    rows.value
      .filter(
        (r) =>
          r.year === selected.value.year &&
          r.quarter === selected.value.quarter &&
          (selected.value.status === 'all' || r.status === selected.value.status)
      )
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  )
  const paged = computed(() =>
    filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
  )
  function outdated(id: string) {
    const row = rows.value.find((r) => r.id === id)
    return row?.status === 'archived'
      ? row.outdatedAtArchive
      : !!row?.analysis && row.analysis.snapshot.key !== materialKey.value
  }
  async function refresh() {
    const [list, materials] = await Promise.all([
      getReviews(),
      getMaterials(selected.value.year, selected.value.quarter)
    ])
    rows.value = list.data
    materialKey.value = materials.data.key
    if (editor.visible.value) await editor.syncMaterials()
  }
  async function query() {
    if (!(await editor.allowLeave())) return
    loading.value = true
    error.value = ''
    try {
      checkPeriod(year.value, quarter.value)
      if (!['all', 'draft', 'archived'].includes(status.value))
        throw new Error('请选择有效汇报状态')
      await editor.close(true)
      selected.value = { year: year.value, quarter: quarter.value, status: status.value }
      await refresh()
      page.value = 1
    } catch (cause) {
      error.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }
  async function newDraft(generate: boolean) {
    if (!(await editor.allowLeave())) return
    editor.open(blankReview(selected.value.year, selected.value.quarter))
    if (generate) await editor.generate()
  }
  async function edit(id: string) {
    const row = rows.value.find((r) => r.id === id && r.status === 'draft')
    if (row && (await editor.allowLeave())) {
      editor.open(row)
      return true
    }
    return false
  }
  function inspect(id: string, tab: string) {
    const row = rows.value.find((r) => r.id === id)
    if (row) {
      detail.value = copy(row)
      detailTab.value = tab
      detailVisible.value = true
    }
  }
  async function regenerate(id: string) {
    if (editor.visible.value && editor.draft.value.id === id) await editor.generate()
    else if (await edit(id)) await editor.generate()
  }
  async function archive(id: string) {
    if (editor.visible.value && editor.draft.value.id === id) await editor.archive()
    else if (await edit(id)) await editor.archive()
  }
  async function revise(id: string) {
    if (!(await editor.allowLeave())) return
    loading.value = true
    try {
      const { data } = await postRevision(id)
      await refresh()
      editor.open(data)
      ElMessage.success('已新增修订草稿，原归档版本保留')
    } catch (cause) {
      error.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }
  function refreshMaterials() {
    void refresh().catch((cause) => {
      error.value = (cause as Error).message
    })
  }
  onMounted(async () => {
    await query()
    editor.restore()
    window.addEventListener('storage', refreshMaterials)
    window.addEventListener('focus', refreshMaterials)
  })
  onUnmounted(() => {
    window.removeEventListener('storage', refreshMaterials)
    window.removeEventListener('focus', refreshMaterials)
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
  p {
    color: var(--el-text-color-secondary);
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
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
