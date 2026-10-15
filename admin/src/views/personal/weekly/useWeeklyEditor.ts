import { computed, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Recommendation, Scenario, Weekly } from '@/types/personal'
import { getRecommendations, getWeekly, putWeekly } from '@/api/personalWeekly'
import { blankWeekly, checkWeekly } from '@/mock/personal/weekly'
import { copy } from '@/mock/personal/storage'
import { currentSession } from '@/mock/personal/session'
import { usePersonalLeave } from '@/composables/usePersonalLeave'

const recoveryKey = 'okr-prototype:weekly-recovery'
function content(report: Weekly) {
  return JSON.stringify({ ...report, version: 0, savedAt: '' })
}

/** 周报自动保存及原型推荐状态机。 */
export function useWeeklyEditor(refresh: () => Promise<void>) {
  const draft = ref<Weekly>(blankWeekly()),
    visible = ref(false)
  const baseline = ref(''),
    saving = ref(false),
    error = ref(''),
    status = ref('未保存')
  const scenario = ref<Scenario>('success'),
    aiScenario = ref('success'),
    recommending = ref(false)
  const recommendations = ref<Recommendation[]>([]),
    recommendationVersion = ref(0),
    recommendationContent = ref('')
  const dirty = computed(() => visible.value && content(draft.value) !== baseline.value)
  const stale = computed(
    () =>
      recommendationVersion.value !== draft.value.version ||
      recommendationContent.value !== content(draft.value)
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  let replacing = false
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
      error.value = '本地恢复草稿写入失败，请保留当前编辑页面'
    }
  }
  async function allowLeave() {
    if (saving.value) {
      ElMessage.warning('正在保存，请稍候')
      return false
    }
    if (!dirty.value) return true
    try {
      await ElMessageBox.confirm('当前周报尚未保存，是否放弃编辑并离开？', '未保存内容', {
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
  watch(
    draft,
    () => {
      if (replacing || !visible.value) return
      discardApproved = false
      backup()
      clearTimeout(timer)
      if (!dirty.value) return
      status.value = saving.value ? '保存中' : '未保存'
      if (!saving.value && currentSession()) timer = setTimeout(() => void save(), 2000)
    },
    { deep: true, flush: 'sync' }
  )
  function open(report: Weekly, saved = true) {
    clearTimeout(timer)
    replacing = true
    discardApproved = false
    draft.value = copy(report)
    baseline.value = content(report)
    visible.value = true
    status.value = saved && report.version ? '已保存' : '未保存'
    error.value = ''
    recommendations.value = []
    scenario.value = 'success'
    replacing = false
    backup()
  }
  async function openNew(date: string) {
    if (!(await allowLeave())) return
    try {
      const fresh = blankWeekly(date),
        list = (await getWeekly()).data
      const existing = list.find((r) => r.start === fresh.start)
      open(existing || fresh)
      if (existing) ElMessage.info('本周已有周报，已打开已有记录')
    } catch (cause) {
      error.value = (cause as Error).message
    }
  }
  async function save() {
    if (saving.value || !visible.value || !currentSession()) return false
    clearTimeout(timer)
    error.value = ''
    try {
      checkWeekly(draft.value)
    } catch (cause) {
      error.value = (cause as Error).message
      status.value = '未保存'
      return false
    }
    const sent = copy(draft.value),
      sentContent = content(sent)
    saving.value = true
    status.value = '保存中'
    try {
      await new Promise((resolve) => setTimeout(resolve, 400))
      const { data } = await putWeekly(sent, scenario.value)
      if (data.duplicate) {
        try {
          await ElMessageBox.confirm(
            '本周已有周报。当前输入尚未保存，请先复制保留；是否打开已有记录？',
            '重复周报',
            { confirmButtonText: '打开已有记录', cancelButtonText: '保留当前编辑', type: 'warning' }
          )
        } catch {
          throw new Error('本周已有周报，当前编辑内容已保留，请复制后打开已有记录')
        }
      }
      replacing = true
      if (data.duplicate) {
        open(data.report)
        ElMessage.info('本周已有周报，已打开已有记录')
      } else {
        baseline.value = sentContent
        draft.value.version = data.report.version
        draft.value.savedAt = data.report.savedAt
      }
      replacing = false
      status.value = dirty.value ? '未保存' : '已保存'
      backup()
      await refresh()
      return true
    } catch (cause) {
      error.value = (cause as Error).message
      status.value = '保存失败'
      backup()
      return false
    } finally {
      saving.value = false
      replacing = false
      if (dirty.value && !error.value && currentSession())
        timer = setTimeout(() => void save(), 2000)
    }
  }
  async function reload() {
    if (saving.value) return
    try {
      await ElMessageBox.confirm(
        '重新加载将替换当前编辑内容，请先复制保留。是否继续？',
        '重新加载',
        { confirmButtonText: '重新加载', cancelButtonText: '继续编辑' }
      )
      const latest = (await getWeekly()).data.find((r) => r.id === draft.value.id)
      if (latest) {
        open(latest)
        backup()
      }
    } catch (cause) {
      if (cause instanceof Error) error.value = cause.message
    }
  }
  async function recommend() {
    if (recommending.value) {
      ElMessage.info('该版本正在推荐，请稍候')
      return
    }
    if (dirty.value || !draft.value.version || saving.value || status.value === '保存失败') {
      ElMessage.warning('请先保存当前周报，再获取 AI 关联推荐')
      return
    }
    const id = draft.value.id,
      version = draft.value.version,
      input = content(draft.value)
    recommending.value = true
    error.value = ''
    try {
      await new Promise((resolve) => setTimeout(resolve, 700))
      const { data } = await getRecommendations(id, version, aiScenario.value)
      if (
        id !== draft.value.id ||
        version !== draft.value.version ||
        input !== content(draft.value)
      )
        throw new Error('周报内容已变化，请基于最新已保存版本重新推荐')
      recommendations.value = data
      recommendationVersion.value = version
      recommendationContent.value = input
      ElMessage.success(
        data.length ? '关联推荐已生成，请核对后选择 KR' : '暂无合适的 KR 推荐，可手动关联'
      )
    } catch (cause) {
      error.value = (cause as Error).message
    } finally {
      recommending.value = false
    }
  }
  function adopt(rec: Recommendation) {
    if (stale.value) {
      ElMessage.warning('周报内容已变化，请基于最新已保存版本重新推荐')
      return
    }
    const item = draft.value.items.find((i) => i.id === rec.itemId)
    if (item && !item.krIds.includes(rec.krId)) item.krIds.push(rec.krId)
  }
  async function close(confirmed = false) {
    if (!confirmed && !(await allowLeave())) return
    clearTimeout(timer)
    visible.value = false
    draft.value = blankWeekly()
    recommendations.value = []
    sessionStorage.removeItem(recoveryKey)
  }
  function restore() {
    const raw = sessionStorage.getItem(recoveryKey)
    if (!raw) return
    try {
      const value = JSON.parse(raw) as { draft: Weekly; baseline: string }
      open(value.draft)
      baseline.value = value.baseline
      status.value = '未保存'
      backup()
      ElMessage.warning('已恢复尚未保存的周报，请核对后重试保存')
    } catch {
      error.value = '恢复草稿读取失败，请保留本地数据'
    }
  }
  onUnmounted(() => {
    clearTimeout(timer)
    if (discardRecovery) sessionStorage.removeItem(recoveryKey)
    else backup()
  })
  return {
    draft,
    visible,
    saving,
    error,
    status,
    scenario,
    aiScenario,
    recommending,
    recommendations,
    dirty,
    stale,
    open,
    openNew,
    save,
    reload,
    recommend,
    adopt,
    close,
    allowLeave,
    restore
  }
}
