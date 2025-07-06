<script setup lang="ts">
import { ref, computed } from "vue";
import { useDraggable, useDroppable } from "@vue-dnd-kit/core";
import PlayingCard from "@/components/PlayingCard.vue";
import { cardToStr } from "@/game/types/Card";
import {
  detectSequences,
  getQuadCandidates,
  detectMarriage,
} from "@/rules/detection";
import { useGameStore } from "@/stores/game";

const game = useGameStore();

// ———————————————————————————————————————————————
// 1)  MAIN  ➜  cartes draggables
// ———————————————————————————————————————————————
function useDraggableCard(card: string) {
  return useDraggable({
    id: card, // id unique = "AS♠" etc.
    data: { from: "HAND", code: card },
  });
}

// ———————————————————————————————————————————————
// 2)  ZONE « meld »  ➜  droppable + détection combos
// ———————————————————————————————————————————————
const { elementRef: meldZoneRef, isOver } = useDroppable({
  id: "MELD_ZONE",
  events: {
    async onDrop({ items }) {
      // a) Déplacer la carte côté store / Firebase
      const droppedCode = items[0].data.code; // "AH" etc.
      await game.moveCardToMeld(droppedCode);

      // b) Récupérer toutes les cartes libres dans la zone
      const meldArea = game.meldAreaCards;

      // c) Détections – ordre de priorité
      const quad = getQuadCandidates(meldArea)[0];
      const seq = detectSequences(meldArea, game.trumpSuit)[0];
      const marr = detectMarriage(meldArea, game.trumpSuit);

      if (quad) game.awardQuad(quad);
      else if (seq) game.awardSequence(seq);
      else if (marr) game.awardMarriage(marr);
      // sinon: aucune combinaison => rien, le joueur bluffe ou prépare
    },
  },
});
</script>

<template>
  <!-- ============ ZONE COMBINAISONS ============ -->
  <div class="player-hand mt-8">
    <!-- Zone droppable -->
    <div
      ref="meldZoneRef"
      class="drop-zone min-h-[160px] border-2 border-dashed rounded p-4 flex items-center gap-4 overflow-x-auto overflow-y-hidden transition-colors"
      :class="
        isOver ? 'border-blue-400 bg-blue-50' : 'border-green-400 bg-green-50'
      "
    >
      <p class="text-xs font-semibold mb-1 w-24 shrink-0">Vos combinaisons</p>

      <template v-if="game.playerMelds.length">
        <template
          v-for="(meld, mIndex) in game.playerMelds"
          :key="'meld-' + mIndex"
        >
          <PlayingCard
            v-for="card in meld.cards"
            :key="'meldcard-' + cardToStr(card)"
            :code="cardToStr(card)"
            :width="60"
            :height="90"
            @click="game.playCardFromMeld(card)"
          />
        </template>
      </template>

      <span v-else class="text-[10px] italic text-gray-400">Aucune</span>
    </div>

    <!-- ============ MAIN DU JOUEUR ============ -->
    <h3
      class="text-xl font-semibold mb-2 mt-4"
      :class="{ 'text-green-600': game.room?.currentTurn === game.myUid }"
    >
      Votre main
    </h3>

    <!-- listes des cartes, chacune draggable -->
    <div
      class="flex gap-2 flex-wrap justify-center overflow-x-auto overflow-y-hidden"
    >
      <template v-for="card in game.localHand" :key="cardToStr(card)">
        <DraggableCard :code="card" />
      </template>
    </div>
  </div>
</template>

<!-- ——————————————————————————————————————————————
     DraggableCard = petit sous‑composant interne
     —————————————————————————————————————————————— -->
<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  name: "DraggableCard",
  props: { code: { type: String, required: true } },
  setup(props) {
    const { elementRef, isDragging, handleDragStart } = useDraggable({
      id: props.code,
      data: { from: "HAND", code: props.code },
    });
    return { elementRef, isDragging, handleDragStart };
  },
  render() {
    return (
      <div
        ref="elementRef"
        onPointerdown={this.handleDragStart}
        class={{
          "opacity-50": this.isDragging,
          "cursor-grab": true,
        }}
      >
        <PlayingCard code={this.code} width={60} height={90} />
      </div>
    );
  },
});
</script>
