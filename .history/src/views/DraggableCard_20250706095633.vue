<!-- DraggableCard.vue -->
<script setup lang="ts">
import { useDraggable } from "@vue-dnd-kit/core";
import PlayingCard from "@/components/PlayingCard.vue";

const props = defineProps<{ code: string }>();

const { setNodeRef, listeners, isDragging } = useDraggable({
  id: props.code,
  data: { code: props.code },
});
</script>

<template>
  <div
    ref="setNodeRef"
    v-bind="listeners"
    :class="[isDragging ? 'opacity-50' : 'cursor-grab']"
  >
    <PlayingCard :code="props.code" width="60" height="90" />
  </div>
</template>
