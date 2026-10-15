<!-- 归档仅使用保存的独立正文、自评及材料。 -->
<template>
  <div>
    <ElAlert title="已归档版本仅供查看，需编辑请新增修订草稿。" type="info" :closable="false" />
    <p
      >{{ review.year }}年第{{ review.quarter }}季度 · 归档 v{{ review.archiveVersion }} · 草稿 v{{
        review.version
      }}
      · {{ review.archivedAt }}</p
    >
    <p>来源归档：{{ review.sourceArchiveId || '首次归档' }}</p
    ><p>本人自评分：{{ review.score }} · 自评理由：{{ review.reason }}</p
    ><p class="body">{{ review.body }}</p>
    <ElTabs
      ><ElTabPane label="AI 分析"
        ><AnalysisView :analysis="review.analysis" :stale="review.outdatedAtArchive" /></ElTabPane
      ><ElTabPane label="当时来源快照"><SourcesView :snapshot="review.snapshot" /></ElTabPane
    ></ElTabs>
  </div>
</template>
<script setup lang="ts">
  import type { Review } from '@/types/personal'
  import AnalysisView from './AnalysisView.vue'
  import SourcesView from './SourcesView.vue'
  defineProps<{ review: Review }>()
</script>
<style scoped>
  p {
    margin: 16px 0;
    overflow-wrap: anywhere;
    line-height: 1.8;
  }
  .body {
    white-space: pre-wrap;
    padding: 16px;
    background: var(--el-fill-color-light);
  }
</style>
