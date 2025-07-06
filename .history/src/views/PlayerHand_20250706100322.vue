<!-- src/views/components/PlayerHand.vue -->
<script setup lang="ts">
import { ref, computed } from "vue";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { useGameStore } from "@/stores/game";

const game = useGameStore();

const hand = computed(() => game.myHand); // ← main du joueur courant

const cards = ref([...hand.value]); // Copie locale triable

function onDragEnd(event: any) {
  const { active, over } = event;

  if (!active || !over || active.id === over.id) return;

  const fromIndex = cards.value.findIndex((c) => c === active.id);
  const toIndex = cards.value.findIndex((c) => c === over.id);

  if (fromIndex < 0 || toIndex < 0) return;

  const updated = [...cards.value];
  const [moved] = updated.splice(fromIndex, 1);
  updated.splice(toIndex, 0, moved);
  cards.value = updated;
}
</script>

<template>
  <DndContext @dragend="onDragEnd">
    <div class="flex gap-2 justify-center">
      <CardDraggable v-for="code in cards" :key="code" :code="code" />
    </div>
  </DndContext>
</template>
