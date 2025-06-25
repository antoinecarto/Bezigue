<template>
  <div class="game-room text-center p-4">

    <!-- MAIN DE L’ADVERSAIRE (retournée) -->
    <div v-if="opponentHand.length" class="player-hand mt-6">
      <h3 class="text-xl font-semibold mb-2">Main de l’adversaire</h3>
      <div class="cards flex gap-2 justify-center flex-wrap">
        <div
          v-for="(card, index) in opponentHand"
          :key="index"
          class="card border px-3 py-2 rounded shadow text-xl bg-gray-200 text-gray-400"
        >
          🂠
        </div>
      </div>

      <!-- Zone de dépôt adversaire dans le même bloc -->
      <div class="drop-zone mt-4 p-4 border-2 border-dashed border-gray-400 rounded bg-gray-50">
        Zone de dépôt adversaire (visible par tous)
        <div class="played-cards flex justify-center gap-2 mt-2">
          <div
            v-for="(card, index) in opponentPlayedCards"
            :key="'opp-played-' + index"
            class="card border px-3 py-2 rounded shadow text-xl"
            :class="getCardColor(card)"
          >
            {{ card }}
          </div>
        </div>
      </div>
    </div>

<!-- Tapis de jeu : zone d’échange à gauche, atout à droite -->
<div class="mt-12 flex justify-center gap-8">
  <!-- Compteur de score à gauche -->
      <div class="scoreboard flex flex-col items-center gap-8 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48">
        <h3 class="text-lg font-semibold mb-4">Score</h3>
        <div class="text-xl font-bold text-green-700 mb-2">
          Joueur : {{ playerScore }}
        </div>
        <div class="text-xl font-bold text-red-700">
          Adversaire : {{ opponentScore }}
        </div>
      </div>
  <div class="flex items-start gap-8 bg-green-100 border-4 border-green-600 rounded-xl p-6 w-full shadow-lg">

    <!-- Zone d'échange (dépose de cartes) -->
    <div class="flex-grow">
      <h3 class="text-lg font-semibold text-green-800 mb-2 text-center">Zone d'échange</h3>
      <div class="battle-drop-zone h-32 border-2 border-dashed border-green-400 rounded bg-green-50 p-4 flex items-center justify-start gap-4">
        <div
          v-for="(card, index) in battleZoneCards"
          :key="'battle-card-' + index"
          class="card border px-3 py-2 rounded shadow text-xl"
          :class="getCardColor(card)"
        >
          {{ card }}
        </div>
      </div>
    </div>

    <!-- Atout à droite -->
    <div class="flex flex-col items-center">
      <div class="text-sm text-gray-600 mb-1">Atout</div>
      <div class="card border-2 border-green-700 px-4 py-2 rounded shadow text-2xl bg-white mb-2">
        {{ trumpCard }}
      </div>
      <div class="text-gray-700 text-sm italic text-center">
          {{ deckCards.length }} carte<span v-if="deckCards.length > 1">s</span> restantes
      </div>
    </div>

  </div>
</div>



    <!-- MAIN DU JOUEUR ACTIF + Zone de dépôt intégrée -->
    <div v-if="localHand.length" class="player-hand mt-8">

      <!-- Zone de dépôt du joueur -->
      <div class="drop-zone mt-4 p-4 border-2 border-dashed border-gray-400 rounded bg-gray-50">
        Zone de dépôt joueur (visible par tous)
        <div class="played-cards flex justify-center gap-2 mt-2">
          <div
            v-for="(card, index) in playerPlayedCards"
            :key="'player-played-' + index"
            class="card border px-3 py-2 rounded shadow text-xl"
            :class="getCardColor(card)"
          >
            {{ card }}
          </div>
        </div>
      </div>

      <!-- MAIN DU JOUEUR avec espacement -->
      <div class="mt-4">
        <div class="cards flex gap-2 justify-center flex-wrap">
          <div
          v-for="card in localHand"
          :key="card"
          class="card border px-3 py-2 rounded shadow text-xl cursor-pointer"
          :class="getCardColor(card)"
          @click="playCard(card, 'player')"
          >
          {{ card }}
        </div>
      </div>
    </div>
    <h3 class="text-xl font-semibold mb-2">Votre main</h3>

    </div>
  </div>
</template>



<script setup lang="ts">  
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { doc, onSnapshot } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '@/firebase'



/* -------------------------------------------------------------------------- */
/* 1. Réactifs & route                                                        */
/* -------------------------------------------------------------------------- */
const route   = useRoute()
const roomId  = route.params.roomId as string   // adapte 'id' au nom réel du param

const roomData = ref<any>(null)             // OK puisque lang="ts"
/* si tu restes en JS :  const roomData = ref(null) */

/* -------------------------------------------------------------------------- */
/* 2. Auth                                                 */
/* -------------------------------------------------------------------------- */

const auth = getAuth();
const uid = computed(() => auth.currentUser?.uid ?? null);

/* -------------------------------------------------------------------------- */
/* 3. Abonnement temps réel                                                   */
/* -------------------------------------------------------------------------- */
onMounted(() => {
  const auth = getAuth();

  // Attendre que l'utilisateur soit chargé
  auth.onAuthStateChanged((user) => {
    if (user) {
      uid.value = user.uid;

      // Activer l'abonnement Firestore ici seulement après avoir le uid
      const roomRef = doc(db, 'rooms', roomId)
      onSnapshot(roomRef, snap => (roomData.value = snap.data()))
    } else {
      console.warn("Aucun utilisateur connecté.");
      // tu peux rediriger vers la page de login ici si besoin
    }
  });
});

watch(() => localHand.value, (newHand) => {
  console.log('localHand changed:', newHand);
}, { immediate: true });

console.log('uid:', uid.value);
console.log('roomData.hands:', roomData.value?.hands);
console.log('localHand:', localHand.value);
/* -------------------------------------------------------------------------- */
/* 4. Données dérivées                                                        */
/* -------------------------------------------------------------------------- */
const localHand = computed(() => {
  const h = roomData.value?.hands ?? {}
  return uid.value ? h[uid.value] ?? [] : []
})

const opponentHand = computed(() => {
  const h = roomData.value?.hands ?? {}
  const oppUid = uid.value
    ? Object.keys(h).find(k => k !== uid.value)
    : null
  return oppUid ? h[oppUid] : []
})


const deckCards = computed(() => roomData.value?.deck ?? [])
const trumpCard = computed(() => roomData.value?.trumpCard ?? null)


function getCardColor(card: string | undefined) {
  if (!card) return 'text-black'           // carte indéfinie → couleur neutre

  // On prend le dernier caractère (♠ ♥ ♦ ♣)
  const suit = card.slice(-1)

  // Pique / Trèfle = noir  |  Cœur / Carreau = rouge
  return suit === '♥' || suit === '♦'
    ? 'text-red-600'
    : 'text-black'
}

</script>


<style scoped>
.game-room {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  padding: 2rem;
  background-color: #f1f5f9;
  min-height: 100vh;
}

.player-hand {
  width: 100%;
  text-align: center;
}

.cards {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.card {
  padding: 12px 18px;
  border: 2px solid #475569;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  font-weight: 600;
  font-size: 1.1rem;
  transition: transform 0.2s;
}

.card:hover {
  transform: scale(1.1);
}

.text-red-600 {
  color: #dc2626;
}

.text-black {
  color: #000000;
}
</style>
