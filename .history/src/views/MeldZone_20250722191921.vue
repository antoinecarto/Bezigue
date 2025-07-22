<script setup lang="ts">
import { computed, ref } from "vue";
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";

const props = defineProps<{
  uid: string;
  readonly?: boolean;
}>();

const game = useGameStore();
const { myUid, currentTurn, melds, hand } = storeToRefs(game);

const isMyTurn = computed(() => currentTurn.value === myUid.value);
const showNotYourTurn = ref(false);
const playing = ref(false);

// Utilise directement les données Firestore
const meldCards = computed(() => melds.value[props.uid] ?? []);

function onCardClick(code: string) {
  if (!isMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }
  if (playing.value) return;

  game.playCard(code).catch((err) => {
    console.error(err);
  });
}

function onCardDropped(evt: any) {
  const addedCard = evt.item?.__draggable_context?.element;
  if (!addedCard) return;

  const fromMeld = evt.from?.classList?.contains("meld-zone");
  const toMeld = evt.to?.classList?.contains("meld-zone");

  if (toMeld && !fromMeld) {
    game.addToMeld(props.uid, addedCard);
  } else if (fromMeld && !toMeld) {
    game.removeFromMeld(props.uid, addedCard);
    if (!hand.value.includes(addedCard)) {
      hand.value.push(addedCard);
    }
  }
}
</script>

<template>
  <draggable
    v-model="meldCards"
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
</template>
