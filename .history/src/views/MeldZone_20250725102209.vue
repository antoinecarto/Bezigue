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
const game = useGameStore();
const { myUid, currentTurn } = storeToRefs(game);

const isMyTurn = computed(() => currentTurn.value === myUid.value);

// localCards est un ref modifiable, initialisé par une copie de props.cards
const localCards = ref<string[]>([]);

watch(
  () => props.cards,
  (newCards) => {
    localCards.value = newCards ? [...newCards] : [];
  },
  { immediate: true }
);

function onCardDropped(evt: any) {
  if (props.readonly) return;

  const addedCard = evt.item?.__draggable_context?.element;
  console.log("Carte drag-n-drop reçue:", addedCard);

  game.addToMeld(props.uid!, addedCard);
}

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
    v-model:list="localCards"
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
  >
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
