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
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bg-elevated) 95%, transparent) 0%,
    color-mix(in srgb, var(--bg-panel) 98%, transparent) 100%
  );
  border: 1px solid var(--border);
  border-top-color: var(--border-light);
  border-left-color: var(--border-light);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 4px 12px rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.panel-frame--no-padding {
  padding: 0;
}

.panel-frame--focused {
  border-color: var(--accent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    0 4px 12px rgba(0, 0, 0, 0.4),
    0 0 20px color-mix(in srgb, var(--accent) 15%, transparent);
}
</style>
