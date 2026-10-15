<!-- 工作事项与所属季度 KR 选择。 -->
<template>
  <section class="work-fields">
    <h4>事项 {{ index + 1 }}</h4>
    <ElFormItem label="事项日期（必填）"
      ><ElDatePicker
        v-model="item.date"
        value-format="YYYY-MM-DD"
        :clearable="false"
        :disabled-date="disabledDate"
        @change="dateChanged"
    /></ElFormItem>
    <ElFormItem label="工作事项（必填）"
      ><ElInput v-model="item.work" type="textarea" :rows="3" maxlength="2000" show-word-limit
    /></ElFormItem>
    <ElFormItem label="成果说明"
      ><ElInput v-model="item.outcome" type="textarea" :rows="3" maxlength="3000" show-word-limit
    /></ElFormItem>
    <ElFormItem label="关联 KR（本人、事项所属季度）"
      ><ElSelect
        v-model="item.krIds"
        multiple
        style="width: 100%"
        :placeholder="options.length ? '可多选或不关联' : '事项所属季度暂无 KR，可先保存未关联事项'"
        ><ElOption
          v-for="kr in options"
          :key="kr.id"
          :label="`${kr.goalName} / ${kr.description}`"
          :value="kr.id" /></ElSelect
    ></ElFormItem>
    <p>未填写成果说明的事项不作为已完成成果；关联仅表示相关性，不代表目标已完成。</p>
  </section>
</template>
<script setup lang="ts">
  import { computed } from 'vue'
  import { ElMessage } from 'element-plus'
  import type { Goal, WorkItem } from '@/types/personal'
  import { period } from '@/mock/personal/storage'
  const item = defineModel<WorkItem>({ required: true })
  const props = defineProps<{ index: number; start: string; end: string; goals: Goal[] }>()
  const options = computed(() => {
    const p = period(item.value.date)
    return props.goals
      .filter((g) => g.year === p.year && g.quarter === p.quarter)
      .flatMap((g) => g.krs.map((k) => ({ ...k, goalName: g.name })))
  })
  function dateChanged() {
    if (item.value.krIds.some((id) => !options.value.some((kr) => kr.id === id))) {
      ElMessage.warning('事项日期所属季度已变化，请重新选择关联 KR')
    }
  }
  function disabledDate(date: Date) {
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    return value < props.start || value > props.end
  }
</script>
<style scoped>
  .work-fields {
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }
  h4 {
    margin-bottom: 16px;
  }
  p {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
</style>
