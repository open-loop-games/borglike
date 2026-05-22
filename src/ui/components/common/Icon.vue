<script setup lang="ts">
import { Icon as IconifyIcon } from '@iconify/vue'

defineProps<{
  name: string
  size?: string | number
}>()
</script>

<template>
  <IconifyIcon
    :icon="name"
    :width="size ?? '1em'"
    :height="size ?? '1em'"
    aria-hidden="true"
    class="icon"
  />
</template>

<style scoped>
.icon {
  display: inline-block;
  vertical-align: -0.125em;
}
</style>
