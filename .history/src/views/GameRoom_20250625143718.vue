<template>
  <div class="game-room text-center p-4">
        <div v-if="loading">Chargement de la partie...</div>

    <div v-else-if="!roomData">
      Partie introuvable ou supprimée.
    </div>


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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { doc, onSnapshot } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '@/firebase'

const route = useRoute()
const roomId = route.params.roomId as string

const roomData = ref<any>(null)
const loading = ref(true)
const uid = ref<string | null>(null)

// Scores et zones de jeu (initialisés vides, à compléter selon ta logique)
const playerScore = ref(0)
const opponentScore = ref(0)
const playerPlayedCards = ref<string[]>([])
const opponentPlayedCards = ref<string[]>([])
const battleZoneCards = ref<string[]>([])

const auth = getAuth()

// Attente auth et subscription Firestore
onMounted(() => {
  auth.onAuthStateChanged((user) => {
    if (user) {
      uid.value = user.uid

      // On lance l’écoute Firestore seulement après avoir l’UID
      subscribeRoom(roomId)
    } else {
      console.warn('Utilisateur non connecté')
      loading.value = false
      // ici tu peux rediriger vers login si besoin
    }
  })
})

// Abonnement Firestore
function subscribeRoom(roomId: string) {
  const roomRef = doc(db, 'rooms', roomId)
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) {
      roomData.value = snap.data()
    } else {
      roomData.value = null
    }
    loading.value = false
  })
}

// Computed pour mains locales et adversaires
const localHand = computed(() => {
  if (!uid.value || !roomData.value?.hands) return []
  return roomData.value.hands[uid.value] ?? []
})

const opponentHand = computed(() => {
  if (!roomData.value?.hands || !uid.value) return []
  const oppUid = Object.keys(roomData.value.hands).find(k => k !== uid.value)
  return oppUid ? roomData.value.hands[oppUid] : []
})

const deckCards = computed(() => roomData.value?.deck ?? [])
const trumpCard = computed(() => roomData.value?.trumpCard ?? null)

function getCardColor(card: string | undefined) {
  if (!card) return 'text-black'
  const suit = card.slice(-1)
  return suit === '♥' || suit === '♦' ? 'text-red-600' : 'text-black'
}

function playCard(card: string, player: 'player' | 'opponent') {
  console.log(`Joueur ${player} joue la carte`, card)
  // TODO : ta logique de jeu ici
}

watch([uid, roomData], ([newUid, newRoomData]) => {
  console.log('uid:', newUid)
  console.log('roomData:', newRoomData)
  console.log('hands:', newRoomData?.hands)
  if (newUid && newRoomData?.hands) {
    console.log('local hand:', newRoomData.hands[newUid])
  }
}, { immediate: true })
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
