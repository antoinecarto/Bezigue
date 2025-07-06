<script setup lang="ts">
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { computed } from "vue";
import { useGameStore } from "@/stores/game.ts";

const props = defineProps<{ isOpponent: boolean }>();
const game = useGameStore();

/* uid ciblé */
const uid = computed(() => {
  if (!game.room) return null;
  return props.isOpponent
    ? game.room.players.find((u) => u !== game.myUid)
    : game.myUid;
});

/* liste locale réactive */
const meld = computed(() => (uid.value ? game.getMeld(uid.value) : []));

/* sur drop, on récupère la carte clonée et on délègue au store */
function onChange(evt: any) {
  if (evt.added && uid.value) {
    const code = evt.added.element;
    game.addToMeld(uid.value, code);
  }
}
</script>

<template>
  <draggable
    :list="meld"
    :group="{ name: 'cards', pull: false, put: true }"
    :disabled="props.isOpponent"
    item-key="code"
    class="flex gap-2 flex-wrap border-2 border-dashed p-2 rounded-md"
    @change="onChange"
  >
    <template #item="{ element }">
      <PlayingCard :code="element" :width="60" :height="90" />
    </template>
  </draggable>

  <p v-if="meld.length === 0" class="text-xs text-gray-400 mt-1">Aucune</p>
</template>
