<!-- 单个 KR 字段，根据指标类型联动。 -->
<template>
  <section class="kr-fields">
    <h4>KR {{ index + 1 }}</h4>
    <ElFormItem label="KR 描述（必填）"
      ><ElInput v-model="kr.description" type="textarea" maxlength="500" show-word-limit
    /></ElFormItem>
    <ElFormItem label="衡量指标（必填）"
      ><ElInput v-model="kr.metric" maxlength="200" show-word-limit
    /></ElFormItem>
    <ElFormItem label="指标类型（必填）"
      ><ElSelect v-model="kr.type" @change="changeType"
        ><ElOption label="越大越好" value="higher" /><ElOption
          label="越小越好"
          value="lower" /><ElOption label="定性" value="qualitative" /></ElSelect
    ></ElFormItem>
    <template v-if="kr.type === 'qualitative'">
      <ElFormItem label="完成标准（必填）"
        ><ElInput v-model="kr.standard" type="textarea" maxlength="1000" show-word-limit
      /></ElFormItem>
      <ElFormItem label="实际完成情况（必填）"
        ><ElInput v-model="kr.situation" type="textarea" maxlength="1000" show-word-limit
      /></ElFormItem>
    </template>
    <template v-else-if="kr.type">
      <div class="field-row"
        ><ElFormItem label="目标值（必填，最多4位小数）"><ElInput v-model="kr.target" /></ElFormItem
        ><ElFormItem label="实际值（必填，最多4位小数）"><ElInput v-model="kr.actual" /></ElFormItem
        ><ElFormItem label="单位"><ElInput v-model="kr.unit" maxlength="20" /></ElFormItem
      ></div>
    </template>
    <div class="field-row"
      ><ElFormItem label="本人填报进度（%，可留空）"
        ><ElInput v-model="kr.progress" placeholder="未填写" /></ElFormItem
      ><ElFormItem label="截止日期（必填）"
        ><ElDatePicker
          v-model="kr.deadline"
          value-format="YYYY-MM-DD"
          :clearable="false"
          :disabled-date="disabledDate" /></ElFormItem
    ></div>
  </section>
</template>
<script setup lang="ts">
  import type { KeyResult } from '@/types/personal'
  import { period } from '@/mock/personal/storage'
  const props = defineProps<{ index: number; year: number; quarter: number }>()
  const kr = defineModel<KeyResult>({ required: true })
  function changeType() {
    kr.value.target = ''
    kr.value.actual = ''
    kr.value.unit = ''
    kr.value.standard = ''
    kr.value.situation = kr.value.type === 'qualitative' ? '尚未完成' : ''
  }
  function disabledDate(date: Date) {
    const p = period(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`)
    return p.year !== props.year || p.quarter !== props.quarter
  }
</script>
<style scoped>
  .kr-fields {
    padding: 16px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 12px;
    margin-bottom: 16px;
  }
  h4 {
    margin-bottom: 16px;
  }
  .field-row {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .field-row > * {
    flex: 1;
    min-width: 180px;
  }
</style>
