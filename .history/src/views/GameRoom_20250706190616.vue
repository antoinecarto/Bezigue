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

<style scoped>
/* Pas de règles spécifiques ici ; la mise en page se fait dans les sous‑vues. */
</style>
