<script setup lang="ts">
import draggable from "vuedraggable";
import PlayingCard from "@/views/components/PlayingCard.vue";
import { useGameStore } from "@/stores/game";
import { storeToRefs } from "pinia";
import { computed } from "vue";

const props = defineProps<{
  uid: string;
  readonly?: boolean;
  cards?: string[];
}>();

const game = useGameStore();
const { myUid, currentTurn } = storeToRefs(game);

const isMyTurn = computed(() => currentTurn.value === myUid.value);

function onCardClick(code: string) {
  if (!isMyTurn.value) return;
  game.removeFromMeld(props.uid, code);
}

function onCardDropped(evt: any) {
  if (props.readonly) return;

  const addedCard = evt.item?.__draggable_context?.element;
  if (!addedCard) return;

  game.addToMeld(props.uid, addedCard);
}
</script>

<template>
  <draggable
    :list="props.cards"
    :item-key="(c) => c"
    class="meld-zone flex flex-wrap gap-1 bg-green-200/60 border-2 border-green-500 rounded-md p-2 min-h-[110px]"
    :group="{ name: 'cards', pull: !props.readonly, put: !props.readonly }"
    :sort="false"
    :disabled="props.readonly"
    @add="onCardDropped"
  >
    <template #item="{ element }">
      <PlayingCard
        :code="element"
        :width="70"
        :height="100"
        :class="['cursor-pointer']"
        @click="onCardClick(element)"
      />
    </template>
  </draggable>
</template>
