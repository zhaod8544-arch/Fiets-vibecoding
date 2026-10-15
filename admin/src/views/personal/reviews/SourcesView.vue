<!-- 来源严格采用当前分析或归档快照，不读取最新记录替换历史。 -->
<template>
  <div class="sources-view">
    <ElEmpty v-if="!snapshot" description="尚未建立来源快照；人工归档时将记录当时材料及缺失情况" />
    <template v-else>
      <ElAlert title="本人填报 · 来源快照只读；工作计划不计入已完成成果。" :closable="false" />
      <p
        >所属人：{{ snapshot.owner }} · {{ snapshot.year }} 年第 {{ snapshot.quarter }} 季度 ·
        采集：{{ snapshot.capturedAt }}</p
      >
      <ElEmpty v-if="!snapshot.goals.length" description="本快照缺少季度目标，未虚构补齐" />
      <GoalDetails v-for="goal in snapshot.goals" :key="goal.id" :goal="goal" />
      <ElEmpty v-if="!snapshot.weekly.length" description="本快照缺少已保存工作事项，未虚构补齐" />
      <div v-for="report in snapshot.weekly" :key="report.id"
        ><p>周报标识：{{ report.id }}</p
        ><WeeklyDetails :report="report" :goals="snapshot.goals" /><p
          v-for="item in report.items"
          :key="item.id"
          >来源事项标识：{{ item.id }} · {{ item.date }}</p
        ></div
      >
    </template>
  </div>
</template>
<script setup lang="ts">
  import type { MaterialSnapshot } from '@/types/personal'
  import GoalDetails from '../goals/GoalDetails.vue'
  import WeeklyDetails from '../weekly/WeeklyDetails.vue'
  defineProps<{ snapshot: MaterialSnapshot | null }>()
</script>
<style scoped>
  .sources-view {
    overflow-wrap: anywhere;
    line-height: 1.8;
  }
  p {
    margin: 16px 0;
  }
</style>
