<script setup lang="ts">
import { ref, watch } from "vue";
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { useGameStore } from "@/stores/game";

const props = defineProps<{
  uid: string;
  readonly?: boolean;
  cards?: string[];
}>();

const game = useGameStore();

// Local mutable ref qui contiendra les cartes affichées dans le meld
const localCards = ref<string[]>(props.cards ?? []);

// Synchroniser localCards si props.cards change (mise à jour depuis Firestore)
watch(
  () => props.cards,
  (newCards) => {
    localCards.value = newCards ?? [];
  }
);

// Quand une carte est déposée dans le meld
function onCardDropped(evt: any) {
  if (props.readonly) return;

  const addedCard = evt.item?.__draggable_context?.element;
  if (!addedCard) return;

  // Appelle la méthode pour ajouter la carte au meld dans Firestore
  game.addToMeld(props.uid, addedCard);
}

// Optionnel : gérer le clic sur une carte dans le meld (ex: retirer du meld)
// Il faudrait appeler une méthode correspondante dans le store pour retirer la carte
function onCardClick(code: string) {
  if (props.readonly) return;

  // Exemple d'appel store, à adapter selon ta méthode
  game.removeFromMeld(props.uid, code);
}
</script>

<template>
  <draggable
    :list="props.cards"
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
        :class="['cursor-pointer']"
        @click="onCardClick(element)"
      />
    </template>
  </draggable>
</template>
