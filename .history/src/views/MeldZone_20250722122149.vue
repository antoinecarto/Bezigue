<script setup lang="ts">
import { ref, watch } from "vue";
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";

const props = defineProps<{
  uid: string;
  readonly?: boolean;
  cards?: string[];
}>();

/* ---------- état local ---------- */
const pending = ref<string[]>([]);

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
      <PlayingCard :code="element" :key="element" />
    </template>
  </draggable>
</template>
