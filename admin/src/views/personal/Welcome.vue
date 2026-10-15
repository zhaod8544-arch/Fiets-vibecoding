<template>
  <ElCard shadow="never"
    ><ElEmpty :description="`${String(route.meta.title)}正在按交付计划实现`"
  /></ElCard>
</template>
<script setup lang="ts">
  import { useRoute } from 'vue-router'
  const route = useRoute()
</script>
