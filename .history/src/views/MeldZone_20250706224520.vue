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
    :disabled="game.room?.phase !== 'play' || game.currentTurn !== game.myUid"
    :list="meld"
    :group="{ name: 'cards', pull: false, put: true }"
    item-key="code"
    class="meld-zone flex gap-2 flex-wrap border-2 border-dashed p-2 rounded-md relative"
    @change="onChange"
  >
    <template #item="{ element }">
      <PlayingCard :code="element" :width="60" :height="90" />
    </template>

    <!-- Message quand meld est vide -->
    <div
      v-if="meld.length === 0"
      class="empty-message absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      Combinaisons
    </div>
  </draggable>
</template>

<style scoped>
.meld-zone {
  min-height: 90px; /* hauteur au moins égale à la hauteur de la carte */
  background-color: #0b5e1e; /* couleur tapis vert foncé */
  color: white;
  position: relative;
}

.empty-message {
  font-size: 1rem;
  font-weight: bold;
  user-select: none;
}
</style>
