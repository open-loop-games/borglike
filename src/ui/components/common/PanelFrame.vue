<script setup lang="ts">
defineProps<{
  focused?: boolean
  noPadding?: boolean
}>()
</script>

<template>
  <div
    class="panel-frame"
    :class="{ 'panel-frame--focused': focused, 'panel-frame--no-padding': noPadding }"
  >
    <slot />
  </div>
</template>

<style scoped>
.panel-frame {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  box-shadow: var(--panel-shadow);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.panel-frame--no-padding {
  padding: 0;
}

.panel-frame--focused {
  border-color: var(--accent);
  box-shadow:
    var(--panel-shadow),
    0 0 20px color-mix(in srgb, var(--accent) 15%, transparent);
}
</style>
