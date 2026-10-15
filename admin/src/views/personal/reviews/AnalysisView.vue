<!-- 分析与人工正文分开，所有内容仅文本渲染。 -->
<template>
  <section class="analysis-view">
    <ElAlert
      title="Mock AI 推断：来源仅证明引用材料，不代表对成果真实性的独立验证。"
      type="warning"
      :closable="false"
    />
    <ElEmpty v-if="!analysis" description="人工汇报，未采用 AI 分析" />
    <template v-else>
      <div class="tags"
        ><ElTag v-if="analysis.insufficient" type="warning">材料不足</ElTag
        ><ElTag v-if="analysis.stage" type="info">阶段性分析</ElTag
        ><ElTag v-if="stale" type="danger">已过时</ElTag></div
      >
      <p v-if="stale">目标或周报已编辑，已有分析已过时，可基于最新材料重新生成。</p>
      <p v-if="analysis.stage">当前材料仅支持阶段性分析，不代表完整季度结果。</p>
      <h3>AI 建议分：{{ analysis.suggestedScore === null ? '未评分' : analysis.suggestedScore }}</h3
      ><p>{{ analysis.scoreReason }}</p>
      <p
        >模型：{{ analysis.model }} · 规则：{{ analysis.rule }} · 生成时间：{{
          analysis.createdAt
        }}</p
      >
      <p
        >材料版本：{{
          analysis.snapshot.goals.map((g) => `目标 ${g.name} v${g.version}`).join('；')
        }}；{{ analysis.snapshot.weekly.map((w) => `周报 ${w.start} v${w.version}`).join('；') }}</p
      >
      <p>事项日期范围：{{ dates[0] || '无材料' }} 至 {{ dates[dates.length - 1] || '无材料' }}</p>
      <GoalDetails v-for="goal in analysis.snapshot.goals" :key="goal.id" :goal="goal" />
      <section v-for="detail in analysis.details" :key="detail.krId" class="kr-analysis"
        ><h4>{{ detail.description }}</h4
        ><p
          >AI 匹配度：{{ detail.match === null ? '未评分' : `${detail.match}%` }} ·
          {{ detail.reason }}</p
        ><p>KR 完成分析：{{ detail.completion }}</p
        ><p>去重成果：{{ detail.outcomes.join('；') || '缺少成果' }}</p
        ><p>证据缺口：{{ detail.gap }}</p
        ><p>来源事项：{{ detail.sourceIds.join('；') || '无来源' }}</p></section
      >
      <h3>AI 汇报预览（独立保存）</h3><p class="preview">{{ analysis.preview }}</p>
    </template>
  </section>
</template>
<script setup lang="ts">
  import { computed } from 'vue'
  import type { Analysis } from '@/types/personal'
  import GoalDetails from '../goals/GoalDetails.vue'
  const props = defineProps<{ analysis: Analysis | null; stale: boolean }>()
  const dates = computed(
    () => props.analysis?.snapshot.weekly.flatMap((w) => w.items.map((i) => i.date)).sort() || []
  )
</script>
<style scoped>
  .analysis-view {
    overflow-wrap: anywhere;
    line-height: 1.8;
  }
  p {
    margin: 12px 0;
  }
  .tags {
    display: flex;
    gap: 8px;
    margin: 16px 0;
  }
  .kr-analysis {
    border-top: 1px solid var(--el-border-color-light);
    padding: 16px 0;
  }
  .preview {
    white-space: pre-wrap;
    padding: 16px;
    background: var(--el-fill-color-light);
    border-radius: 12px;
  }
</style>
