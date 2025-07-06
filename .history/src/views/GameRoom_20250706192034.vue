<!--
  GameRoom.vue – orchestrateur minimal (architecture Pinia + vues dédiées)
  =========================================================================
  • Ne contient plus de logique Firestore / DnD / rules.
  • Se contente dInitialiser le store `game` (joinRoom) et d’afficher
    les sous‑vues : MeldZone, PlayerHand, TrickZone (à ajouter si besoin).
-->
<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import { useGameStore } from "@/stores/game.ts";
import PlayerHand from "@/views/PlayerHand.vue";
import MeldZone from "@/views/MeldZone.vue";
import CenterBoard from "@/views/components/CenterBoard.vue";
import GameChat from "./GameChat.vue";

const route = useRoute();
const game = useGameStore();

let unsubscribeRoom: (() => void) | null = null;

onMounted(() => {
  const auth = getAuth();
  const stopAuth = onAuthStateChanged(auth, (user) => {
    if (!user) return; // non connecté
    // (re)joint la room et écoute Firestore via le store
    unsubscribeRoom?.();
    unsubscribeRoom = game.joinRoom(route.params.roomId as string, user.uid);
  });

  onUnmounted(() => {
    stopAuth();
    unsubscribeRoom?.();
  });
});
</script>

<template>
  <section v-if="game.loading" class="flex items-center justify-center h-full">
    Chargement…
  </section>
    <!-- *** ZONE STATUT MAIN DE L'ADVERSAIRE EN HAUT *** -->
    <div
      class="hand-status-top flex justify-end px-8 py-2 border-b border-gray-600"
    >
      <div
        :class="{
          'text-green-500': isOpponentTurn,
          'text-red-500': !isOpponentTurn,
        }"
        class="font-semibold"
      >
        Main de {{ opponentName }}
      </div>

  <div v-else class="grid gap-4">
    <!-- Zone des combinaisons / dépôt de l'adversaire -->
    <MeldZone :meld="player2Melds" :isOpponent="true" />

    <!-- Zone de score, d'échange, d'atout -->
    <CenterBoard />

    <!-- Zone des combinaisons / dépôt du joueur -->
    <MeldZone :meld="player1Melds" :isOpponent="false" />

    <!-- Main du joueur (draggable + sortable) -->
    <PlayerHand />
    <GameChat class="mt-4" />
  </div>
</template>

<style scoped>
/* Pas de règles spécifiques ici ; la mise en page se fait dans les sous‑vues. */
</style>
