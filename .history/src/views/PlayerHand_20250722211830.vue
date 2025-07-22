<template>
  <draggable
    :list="cards"
    :item-key="(c) => c"
    class="player-hand"
    :group="{ name: 'cards', pull: true, put: false }"
    :sort="false"
    @add="onCardDropped"
  >
    <template #item="{ element }">
      <PlayingCard
        :code="element"
        :class="['cursor-pointer']"
        @click="onCardClick(element)"
      />
    </template>
  </draggable>
</template>

<script setup lang="ts">
import draggable from "vuedraggable";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";

const props = defineProps<{ cards: string[] }>();

const game = useGameStore();
const { myUid } = storeToRefs(game);

function onCardClick(code: string) {
  game.playCard(code); // À toi d'ajuster ça
}

function onCardDropped(evt: any) {
  const code = evt.item?.__draggable_context?.element;
  if (!code) return;
  game.removeFromMeld(myUid.value, code);
}
</script>
