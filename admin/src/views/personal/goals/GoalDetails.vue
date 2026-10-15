<!-- 完整 O/KR 内容，同时用于生效记录和只读历史。 -->
<template>
  <div class="goal-details">
    <h3>{{ goal.name }}</h3
    ><p
      >{{ goal.year }} 年 · 第 {{ goal.quarter }} 季度 · v{{ goal.version }} · {{ goal.savedAt }}</p
    >
    <div v-for="(kr, index) in goal.krs" :key="kr.id" class="kr-detail">
      <h4>KR {{ index + 1 }} · {{ kr.description }}</h4>
      <ElDescriptions :column="2" border>
        <ElDescriptionsItem label="衡量指标">{{ kr.metric }}</ElDescriptionsItem>
        <ElDescriptionsItem label="指标类型">{{ metricLabels[kr.type] }}</ElDescriptionsItem>
        <template v-if="kr.type === 'qualitative'"
          ><ElDescriptionsItem label="完成标准">{{ kr.standard }}</ElDescriptionsItem
          ><ElDescriptionsItem label="实际完成情况">{{
            kr.situation
          }}</ElDescriptionsItem></template
        >
        <template v-else
          ><ElDescriptionsItem label="目标值">{{ kr.target }}</ElDescriptionsItem
          ><ElDescriptionsItem label="实际值"
            >{{ kr.actual }}
            <ElTag :type="achieved(kr) ? 'success' : 'info'">{{
              achieved(kr) ? '已达标' : '未达标'
            }}</ElTag></ElDescriptionsItem
          ><ElDescriptionsItem label="单位">{{ kr.unit || '未填写' }}</ElDescriptionsItem></template
        >
        <ElDescriptionsItem label="本人填报进度">{{
          kr.progress === '' ? '未填写' : `${kr.progress}%`
        }}</ElDescriptionsItem>
        <ElDescriptionsItem label="截止日期">{{ kr.deadline }}</ElDescriptionsItem>
      </ElDescriptions>
      <p v-if="kr.type === 'qualitative'">请对照完成标准核查实际完成情况</p>
    </div>
  </div>
</template>
<script setup lang="ts">
  import type { Goal, KeyResult } from '@/types/personal'
  defineProps<{ goal: Goal }>()
  const metricLabels = { higher: '越大越好', lower: '越小越好', qualitative: '定性', '': '未选择' }
  function achieved(kr: KeyResult) {
    return kr.type === 'higher'
      ? Number(kr.actual) >= Number(kr.target)
      : Number(kr.actual) <= Number(kr.target)
  }
</script>
<style scoped>
  .goal-details {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  h3 {
    font-size: 18px;
    margin-bottom: 8px;
  }
  h4 {
    margin-bottom: 12px;
  }
  p {
    color: var(--el-text-color-secondary);
    margin: 12px 0;
    font-size: 13px;
  }
  .kr-detail {
    margin-top: 20px;
  }
</style>
