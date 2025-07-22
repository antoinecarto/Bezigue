<script setup lang="ts">
import { ref, watch, computed } from "vue";
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { useGameStore } from "@/stores/game";

const props = defineProps<{
  uid: string;
  readonly?: boolean;
  cards?: string[];
}>();

/* ---------- état local ---------- */
const pending = ref<string[]>([]);
const game = useGameStore();

const isMyTurn = computed(() => currentTurn.value === myUid.value);
const showNotYourTurn = ref(false);
const playing = ref(false);

/* ---------- synchronisation avec props.cards ---------- */
watch(
  () => props.cards,
  (cards) => {
    if (cards) {
      pending.value = [...cards];
    } else {
      pending.value = [];
    }
  },
  { immediate: true }
);
function onCardClick(code: string) {
  if (!isMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }
  if (playing.value) return; // already playing

  const idx = hand.value.indexOf(code);
  if (idx !== -1) hand.value.splice(idx, 1);

  game.playCard(code).catch((err) => {
    hand.value.splice(idx, 0, code); // rollback en cas d'erreur
    console.error(err);
  });
}

function onCardDropped(evt: any) {
  if (props.readonly) return;

  const addedCard = evt?.added?.element;
  if (!addedCard) return;

  console.log("Carte ajoutée dans le meld :", addedCard);

  // 🔥 Appelle addToMeld pour mise à jour Firestore
  game.addToMeld(props.uid, addedCard);
}
</script>

<template>
  <!-- Zone verte : LISTE CIBLE = pending -->
  <draggable
    v-model="pending"
    :item-key="(c) => c"
    class="meld-zone flex flex-wrap gap-1 bg-green-200/60 border-2 border-green-500 rounded-md p-2 min-h-[110px]"
    :group="{
      name: 'cards',
      put: !props.readonly,
      pull: !props.readonly,
    }"
    :sort="false"
    :disabled="props.readonly"
    @change="onCardDropped"
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
