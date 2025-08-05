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
const { myUid, currentTurn, room, drawQueue, hand } = storeToRefs(game);
const showMustDrawFirst = ref(false);
const isMyTurn = computed(() => currentTurn.value === myUid.value);
const isNotMyTurn = computed(() => {
  return drawQueue.value.length === 1 && drawQueue.value[0] !== myUid.value;
});
const mustDrawFirst = computed(() => {
  if (!myUid.value || !isMyTurn.value || !room.value) return false;

  const hasAnyScore = Object.values(room.value.scores || {}).some(
    (score) => score > 0
  );

  const currentTrick = room.value.trick?.cards || [];
  const currentDrawQueue = drawQueue.value || [];

  // Aucun score marqué = premier trick de la partie
  if (!hasAnyScore) {
    // Dans le premier trick, personne ne pioche (ni J1 ni J2)
    return false;
  }

  // Trick en cours, ne pas demander de piocher
  if (currentTrick.length > 0) {
    return false;
  }

  // Vérification des conditions de pioche après un trick
  const myUidInQueue = currentDrawQueue.includes(myUid.value);
  const queueHasTwoCards = currentDrawQueue.length === 2;

  // - Si mon UID est dans la drawQueue, je dois piocher
  // - OU si la drawQueue a 2 cartes (les deux joueurs doivent piocher)
  //   et c'est mon tour, alors je dois piocher en premier
  const shouldDraw = myUidInQueue || queueHasTwoCards;

  return shouldDraw;
});

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

  game.addToMeld(props.uid!, addedCard);
}

function onCardClick(code: string) {
  if (isNotMyTurn.value) {
    showNotYourTurn.value = true;
    return;
  }

  // Vérification simple du piochage obligatoire
  if (mustDrawFirst.value) {
    showMustDrawFirst.value = true;
    return;
  }

  if (playing.value) return;
  game.playCardWithValidation(code).catch((err) => {
    console.error("Erreur lors du jeu de la carte", err);
  });
}

const playableCards = computed((): string[] => {
  if (!hand.value || !room.value) return [];

  const allMyCards = [
    ...hand.value,
    ...(room.value.melds?.[myUid.value!] ?? []),
  ];

  // En phase normale, toutes les cartes sont jouables
  if (room.value.phase !== "battle") {
    return allMyCards;
  }

  // Vérifier que c'est mon tour
  if (room.value.currentTurn !== myUid.value) {
    return [];
  }

  // En phase battle, appliquer les règles strictes
  const currentTrick = room.value.trick?.cards || [];
  const leadSuit =
    currentTrick.length > 0 ? game.splitCode(currentTrick[0]).suit : null;
  const trumpSuit = game.splitCode(room.value.trumpCard).suit;
  const amFirstPlayer = currentTrick.length === 0;

  return game.getPlayableCardsInBattle(
    allMyCards,
    leadSuit,
    trumpSuit,
    amFirstPlayer
  );
});
</script>

<template>
  <draggable
    v-model:list="localCards"
    :item-key="(c: string) => c"
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
        :class="[
          {
            disabled: !isMyTurn || !playableCards.includes(element),
            'not-playable': !playableCards.includes(element),
          },
          'cursor-pointer',
        ]"
        @click="onCardClick(element)"
      />
    </template>
  </draggable>
  <div v-if="showNotYourTurn" class="popup text-black dark:text-black">
    Patience, votre adversaire n'a pas encore pioché...
    <button @click="showNotYourTurn = false">OK</button>
  </div>
  <div v-if="showMustDrawFirst" class="popup text-black dark:text-black">
    Vous devez d'abord piocher avant de jouer.
    <button @click="showMustDrawFirst = false">OK</button>
  </div>
</template>

<style scoped>
.disabled {
  pointer-events: none;
  opacity: 0.5;
  cursor: not-allowed;
}

.popup {
  position: fixed;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border: 2px solid black;
  padding: 1em 2em;
  z-index: 100;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.popup button {
  margin-left: 10px;
  padding: 5px 10px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.popup button:hover {
  background: #0056b3;
}

:not(.readonly) .not-playable {
  opacity: 0.2;
  cursor: not-allowed !important;
}
</style>
