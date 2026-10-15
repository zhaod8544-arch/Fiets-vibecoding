<!-- 人工正文、自评与独立 AI 预览。 -->
<template>
  <ElCard v-if="visible" shadow="never" class="review-editor">
    <div class="toolbar"
      ><h3
        >{{ draft.year }} 年第 {{ draft.quarter }} 季度 ·
        {{ draft.sourceArchiveId ? '修订草稿' : '自评草稿' }}</h3
      ><ElTag>草稿 v{{ draft.version }}</ElTag
      ><ElTag :type="dirty || !draft.version ? 'warning' : 'success'">{{
        dirty || !draft.version ? '未保存' : '已保存'
      }}</ElTag
      ><ElButton @click="editor.close()">关闭编辑</ElButton></div
    >
    <ElAlert
      title="AI 建议分与本人自评分独立。AI 不可用或材料不足时仍可人工填写并归档。"
      :closable="false"
    />
    <ElForm label-position="top" :disabled="saving || archiving" class="editor-form">
      <ElFormItem label="汇报正文（归档必填）"
        ><ElInput v-model="draft.body" type="textarea" :rows="10" maxlength="20000" show-word-limit
      /></ElFormItem>
      <ElFormItem label="本人自评分（0～100，最多2位小数，归档必填）"
        ><ElInput
          v-model="draft.score"
          placeholder="未填写，不自动采用AI建议分"
          style="max-width: 380px"
      /></ElFormItem>
      <ElFormItem label="自评理由（归档必填）"
        ><ElInput v-model="draft.reason" type="textarea" :rows="3" maxlength="2000" show-word-limit
      /></ElFormItem>
      <div class="toolbar"
        ><ElSelect v-model="scenario" style="width: 190px" aria-label="原型草稿保存场景"
          ><ElOption label="正常保存" value="success" /><ElOption
            label="模拟保存失败"
            value="failure" /><ElOption label="模拟版本冲突" value="conflict" /></ElSelect
        ><ElButton :loading="saving" type="primary" @click="editor.save">保存草稿</ElButton
        ><ElButton @click="editor.reload">重新加载最新版本</ElButton
        ><ElCheckbox v-model="archiveFail">模拟归档失败</ElCheckbox
        ><ElButton type="success" :loading="archiving" @click="editor.archive"
          >确认归档</ElButton
        ></div
      >
    </ElForm>
    <ElAlert v-if="error" :title="error" type="error" :closable="false" />
    <ElDivider />
    <div class="toolbar"
      ><h3>季度分析与预览</h3><ElTag type="warning">Mock</ElTag><ElTag>{{ generationStatus }}</ElTag
      ><ElSelect
        v-model="aiScenario"
        style="width: 180px"
        :disabled="generating"
        aria-label="原型分析场景"
        ><ElOption label="模拟分析（材料不足）" value="success" /><ElOption
          label="模拟评分示例"
          value="scored" /><ElOption label="AI未配置" value="config" /><ElOption
          label="连接失败"
          value="connection" /><ElOption label="120秒超时（快速演示）" value="timeout" /><ElOption
          label="限流"
          value="rate" /><ElOption label="结果结构无效" value="invalid" /><ElOption
          label="来源无效"
          value="source" /></ElSelect
      ><ElButton :loading="generating" :disabled="saving || archiving" @click="editor.generate">{{
        draft.analysis ? '重新生成' : '生成预览'
      }}</ElButton
      ><ElButton
        v-if="draft.analysis || generating"
        :disabled="saving || archiving"
        @click="editor.useManual"
        >改为人工汇报（不采用AI）</ElButton
      ></div
    >
    <p>生成前先保存人工输入；生成期间可继续编辑或归档，后到结果不会改变归档。</p>
    <ElTabs v-model="tab"
      ><ElTabPane label="查看分析" name="analysis"
        ><AnalysisView :analysis="draft.analysis" :stale="stale" /></ElTabPane
      ><ElTabPane label="查看来源" name="sources"
        ><SourcesView :snapshot="draft.analysis?.snapshot || draft.snapshot" /></ElTabPane
    ></ElTabs>
  </ElCard>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import type { useReviewEditor } from './useReviewEditor'
  import AnalysisView from './AnalysisView.vue'
  import SourcesView from './SourcesView.vue'
  const props = defineProps<{ editor: ReturnType<typeof useReviewEditor> }>()
  const {
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
    stale
  } = props.editor
  const tab = ref('analysis')
</script>
<style scoped>
  .review-editor {
    border: none;
    box-shadow: none;
    border-radius: 12px;
  }
  .toolbar {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 16px;
  }
  .editor-form {
    margin-top: 20px;
  }
  p {
    color: var(--el-text-color-secondary);
    line-height: 1.8;
    margin-bottom: 16px;
  }
</style>
