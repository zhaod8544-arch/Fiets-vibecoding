import { computed, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Review, Scenario } from '@/types/personal'
import {
  completeAnalysis,
  getMaterials,
  getReviews,
  postArchive,
  putReview,
  startAnalysis
} from '@/api/personalReviews'
import { blankReview, checkReview } from '@/mock/personal/reviews'
import { copy, period } from '@/mock/personal/storage'
import { currentSession } from '@/mock/personal/session'
import { usePersonalLeave } from '@/composables/usePersonalLeave'
function content(review: Review) {
  return JSON.stringify({ ...review, version: 0, savedAt: '', updatedAt: 0 })
}
const recoveryKey = 'okr-prototype:review-recovery'

/** 汇报草稿、生成与归档交互。 */
export function useReviewEditor(refresh: () => Promise<void>) {
  const p = period(),
    draft = ref<Review>(blankReview(p.year, p.quarter)),
    visible = ref(false)
  const baseline = ref(''),
    saving = ref(false),
    archiving = ref(false),
    generating = ref(false),
    error = ref('')
  const scenario = ref<Scenario>('success'),
    aiScenario = ref('success'),
    archiveFail = ref(false),
    generationStatus = ref('尚未生成')
  const materialKey = ref(''),
    dirty = computed(() => visible.value && content(draft.value) !== baseline.value)
  const stale = computed(
    () => !!draft.value.analysis && draft.value.analysis.snapshot.key !== materialKey.value
  )
  let generation = 0
  let discardApproved = false
  let discardRecovery = false
  function backup() {
    try {
      if (dirty.value)
        sessionStorage.setItem(
          recoveryKey,
          JSON.stringify({ draft: draft.value, baseline: baseline.value })
        )
      else sessionStorage.removeItem(recoveryKey)
    } catch {
      error.value = '恢复草稿保存失败，请保留当前内容'
    }
  }
  watch(
    draft,
    () => {
      discardApproved = false
      backup()
    },
    { deep: true, flush: 'sync' }
  )
  async function allowLeave() {
    if (saving.value || archiving.value) {
      ElMessage.warning('正在保存，请稍候')
      return false
    }
    if (!dirty.value && !generating.value) return true
    try {
      await ElMessageBox.confirm('当前草稿尚未保存，是否放弃编辑并离开？', '编辑保护', {
        confirmButtonText: '放弃并离开',
        cancelButtonText: '继续编辑',
        type: 'warning'
      })
      discardApproved = true
      return true
    } catch {
      return false
    }
  }
  usePersonalLeave(dirty, allowLeave)
  onBeforeRouteLeave((to) => {
    discardRecovery = discardApproved && (!!currentSession() || to.query.message === '已退出登录。')
  })
  async function syncMaterials() {
    try {
      materialKey.value = (await getMaterials(draft.value.year, draft.value.quarter)).data.key
    } catch (cause) {
      error.value = (cause as Error).message
    }
  }
  function open(review: Review) {
    generation += 1
    discardApproved = false
    generating.value = false
    draft.value = copy(review)
    baseline.value = content(review)
    visible.value = true
    error.value = ''
    scenario.value = 'success'
    generationStatus.value = review.analysis ? '生成成功' : '尚未生成'
    void syncMaterials()
    sessionStorage.removeItem(recoveryKey)
  }
  async function save() {
    if (saving.value || !currentSession()) return false
    saving.value = true
    error.value = ''
    const sent = copy(draft.value),
      sentContent = content(sent)
    try {
      checkReview(sent)
      const { data } = await putReview(sent, scenario.value)
      baseline.value = sentContent
      draft.value.version = data.version
      draft.value.savedAt = data.savedAt
      draft.value.updatedAt = data.updatedAt
      backup()
      ElMessage.success('草稿已保存')
      await refresh()
      return true
    } catch (cause) {
      error.value = (cause as Error).message
      return false
    } finally {
      saving.value = false
    }
  }
  async function generate() {
    if (generating.value) {
      ElMessage.info('该材料版本正在生成，请稍候')
      return
    }
    if (!(await save())) {
      error.value = '当前编辑内容未能保留，请先重试保存'
      return
    }
    const id = draft.value.id,
      run = ++generation,
      initialBody = draft.value.body
    generating.value = true
    generationStatus.value = '生成中'
    error.value = ''
    try {
      const { data: task } = await startAnalysis(draft.value.year, draft.value.quarter)
      if (task.merged) ElMessage.info('该材料版本正在生成，请稍候')
      await new Promise((resolve) => setTimeout(resolve, 1200))
      const { data: result } = await completeAnalysis(task.id, aiScenario.value)
      if (
        run !== generation ||
        id !== draft.value.id ||
        draft.value.status === 'archived' ||
        !currentSession()
      )
        return
      draft.value.analysis = result
      if (!initialBody && !draft.value.body) draft.value.body = result.preview
      generationStatus.value = '生成成功'
      await syncMaterials()
      ElMessage.success('新预览已生成，当前人工编辑内容已保留')
    } catch (cause) {
      if (run === generation) {
        error.value = (cause as Error).message
        generationStatus.value = '生成失败'
      }
    } finally {
      if (run === generation) generating.value = false
    }
  }
  async function archive() {
    if (saving.value || archiving.value) return
    try {
      checkReview(draft.value, true)
    } catch (cause) {
      error.value = (cause as Error).message
      return
    }
    generation += 1
    if (generating.value) generationStatus.value = '本次归档已固定当前内容，后到分析不再应用'
    generating.value = false
    if (!(await save())) return
    try {
      await ElMessageBox.confirm('确认将当前自评汇报归档？归档后该版本仅供查看。', '确认归档', {
        confirmButtonText: '确认归档',
        cancelButtonText: '继续编辑',
        type: 'warning'
      })
    } catch {
      return
    }
    if (!(await save())) return
    archiving.value = true
    try {
      const { data } = await postArchive(draft.value.id, draft.value.version, archiveFail.value)
      generation += 1
      generating.value = false
      draft.value = data
      baseline.value = content(data)
      visible.value = false
      backup()
      ElMessage.success('自评汇报已归档')
      await refresh()
    } catch (cause) {
      error.value = (cause as Error).message
    } finally {
      archiving.value = false
    }
  }
  async function reload() {
    if (saving.value || archiving.value) return
    try {
      await ElMessageBox.confirm(
        '重新加载将替换当前编辑内容，请先复制保留。是否继续？',
        '重新加载',
        { confirmButtonText: '重新加载', cancelButtonText: '继续编辑' }
      )
      const latest = (await getReviews()).data.find((r) => r.id === draft.value.id)
      if (latest?.status === 'draft') open(latest)
      else error.value = '该草稿已归档，请保留当前内容并查看历史版本。'
    } catch (cause) {
      if (cause instanceof Error) error.value = cause.message
    }
  }
  async function close(confirmed = false) {
    if (!confirmed && !(await allowLeave())) return
    generation += 1
    generating.value = false
    visible.value = false
    draft.value = blankReview(p.year, p.quarter)
    backup()
  }
  function useManual() {
    generation += 1
    generating.value = false
    draft.value.analysis = null
    generationStatus.value = '人工汇报，未采用 AI 分析'
  }
  watch(
    () => draft.value.analysis,
    () => {
      if (visible.value) void syncMaterials()
    }
  )
  function restore() {
    const raw = sessionStorage.getItem(recoveryKey)
    if (!raw) return
    try {
      const value = JSON.parse(raw) as { draft: Review; baseline: string }
      open(value.draft)
      baseline.value = value.baseline
      backup()
      ElMessage.warning('已恢复尚未保存的汇报草稿，请核对后保存')
    } catch {
      error.value = '恢复草稿读取失败，请保留本地数据'
    }
  }
  onUnmounted(() => {
    generation += 1
    if (discardRecovery) sessionStorage.removeItem(recoveryKey)
    else backup()
  })
  return {
    draft,
    visible,
    saving,
    archiving,
    generating,
    error,
    scenario,
    aiScenario,
    archiveFail,
    generationStatus,
    dirty,
    stale,
    open,
    save,
    generate,
    archive,
    reload,
    close,
    allowLeave,
    syncMaterials,
    restore,
    useManual
  }
}
