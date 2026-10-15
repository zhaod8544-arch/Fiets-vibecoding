<!-- 周报完整历史快照。 -->
<template>
  <article class="weekly-detail">
    <h3>{{ report.start }} 至 {{ report.end }}</h3
    ><p>v{{ report.version }} · {{ report.savedAt }}</p>
    <section v-for="(item, i) in report.items" :key="item.id"
      ><h4>事项 {{ i + 1 }} · {{ item.date }}</h4
      ><p>工作事项：{{ item.work }}</p
      ><p>成果说明：{{ item.outcome || '未填写' }}</p
      ><p
        >关联 KR：{{
          item.krIds.length
            ? item.krIds.map((id) => item.krNames?.[id] || label(id)).join('；')
            : '未关联'
        }}</p
      ></section
    >
    <p>阻碍：{{ report.blockers || '未填写' }}</p
    ><p>下周计划：{{ report.plan || '未填写' }}</p>
  </article>
</template>
<script setup lang="ts">
  import type { Goal, Weekly } from '@/types/personal'
  const props = defineProps<{ report: Weekly; goals: Goal[] }>()
  function label(id: string) {
    return props.goals.flatMap((g) => g.krs).find((k) => k.id === id)?.description || id
  }
</script>
<style scoped>
  .weekly-detail {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.8;
  }
  section {
    padding: 16px 0;
    border-bottom: 1px solid var(--el-border-color-light);
  }
  p {
    margin: 8px 0;
  }
</style>
