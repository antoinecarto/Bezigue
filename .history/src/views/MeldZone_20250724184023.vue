<script setup lang="ts">
import { computed, watch, ref } from "vue";
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";

const props = defineProps({
  uid: String,
  readonly: Boolean,
  cards: Array as () => string[] | undefined,
});
const showNotYourTurn = ref(false);
const playing = ref(false);
const isMyTurn = computed(() => currentTurn.value === myUid.value);

const localCards = computed(() => {
  return Array.isArray(props.cards) ? props.cards : [];
});
const game = useGameStore();
const { myUid, currentTurn } = storeToRefs(game);

watch(
  () => props.cards,
  (newCards) => {
    localCards.value = newCards ?? [];
  }
);

function onCardDropped(evt: any) {
  if (props.readonly) return;

  const addedCard = evt.item?.__draggable_context?.element;
  console.log("Carte drag-n-drop reçue:", addedCard);

  game.addToMeld(props.uid!, addedCard);
}

// Optionnel : gérer le clic sur une carte dans le meld (ex: retirer du meld)
// Il faudrait appeler une méthode correspondante dans le store pour retirer la carte
function onCardClick(code: string) {
  if (!isMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }
  if (playing.value) return;
  game.playCard(code).catch((err) => {
    console.error("Erreur lors du jeu de la carte", err);
  });
}
</script>

<template>
<draggable
  :model-value="localCards"
  @update:modelValue="(newVal) => localCards = newVal"
  :item-key="(c) => c"
  class="meld-zone flex flex-wrap gap-1 bg-green-200/60 border-2 border-green-500 rounded-md p-2 min-h-[110px]"
  :group="{
    name: 'cards',
    put: !props.readonly,
    pull: !props.readonly,
  }"
  :sort="false"
  :disabled="props.readonly"
  @add="onCardDropped"
/>
    <template #item="{ element }">
      <PlayingCard
        :code="element"
        :key="element"
        :width="70"
        :height="100"
        :class="[{ disabled: !isMyTurn }, 'cursor-pointer']"
        @click="onCardClick(element)"
      />
    </template>
  </draggable>
  <div v-if="showNotYourTurn" class="popup">
    Ce n'est pas votre tour !
    <button @click="showNotYourTurn = false">OK</button>
  </div>
</template>
