<!-- src/views/components/CardDraggable.vue -->
<script setup lang="ts">
import { ref } from "vue";
import { useDraggable, useDroppable } from "@dnd-kit/core";

const props = defineProps<{ code: string }>();

const root = ref(null);

const {
  attributes,
  listeners,
  setNodeRef: setDragRef,
} = useDraggable({
  id: props.code,
});

const { setNodeRef: setDropRef } = useDroppable({
  id: props.code,
});

// Fusionne refs pour drag + drop
function setCombinedRef(el: HTMLElement | null) {
  setDragRef(el);
  setDropRef(el);
  root.value = el;
}
</script>

<template>
  <div ref="setCombinedRef" v-bind="attributes" v-on="listeners" class="card">
    {{ code }}
  </div>
</template>

<style scoped>
.card {
  width: 60px;
  height: 90px;
  background-color: white;
  border: 1px solid #888;
  border-radius: 4px;
  text-align: center;
  line-height: 90px;
  font-weight: bold;
  user-select: none;
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
