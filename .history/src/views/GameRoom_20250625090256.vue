<template>
  <div class="game-room text-center p-4">

    <!-- MAIN DE L’ADVERSAIRE (retournée) -->
    <div v-if="reservedHand.length" class="player-hand mt-6">
      <h3 class="text-xl font-semibold mb-2">Main de l’adversaire</h3>
      <div class="cards flex gap-2 justify-center flex-wrap">
        <div
          v-for="(card, index) in reservedHand"
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
        {{ drawPile.length }} carte<span v-if="drawPile.length > 1">s</span> restantes
      </div>
    </div>

  </div>
</div>



    <!-- MAIN DU JOUEUR ACTIF + Zone de dépôt intégrée -->
    <div v-if="playerHand.length" class="player-hand mt-8">

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
          v-for="card in playerHand"
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
    <div v-if="room">
    <h2>Room {{ room.id }} – Atout : {{ room.trump }}</h2>

    <!-- Main du joueur 1 -->
    <div class="hand">
      <Card v-for="c in game?.player1Hand" :key="c" :card="c" @click="onCardClick(c)" />
    </div>

    <!-- Historique des mènes -->
    <ul class="history">
      <li v-for="m in menes" :key="m.id">
        Mène {{ m.meneNumber }} – {{ m.scores?.player1 }} / {{ m.scores?.player2 }}
      </li>
    </ul>
  </div>
</template>



<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useGameRoom } from '@/composables/useGameRoom';
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { getPlayerId } from '../utils/playerId'

const route = useRoute()
const roomId = route.params.roomId as string;
const { room, game, playCard, menes } = useGameRoom(roomId);
const playerId = getPlayerId()

const playerHand = ref([])
const reservedHand = ref([])
const trumpCard = ref(null)
const drawPile = ref([])

function onCardClick(card: string) {
  playCard(card);
}

function getCardColor(card) {
  if (card.includes('♥') || card.includes('♦')) {
    return 'text-red-600'
  }
  return 'text-black'
}

// 🕹️ Gestion du clic sur une carte
function playCard(card, from) {
  console.log(`🃏 Carte jouée (${from}):`, card)
  // Tu peux ici appeler une fonction qui met à jour Firestore,
  // ou qui affiche la carte dans la TrickZone
}

onMounted(() => {
  const roomRef = doc(db, 'rooms', roomId)

  onSnapshot(roomRef, (docSnap) => {
    const data = docSnap.data()
    if (!data) return

    const allHands = data.hands || {}
    const allReserved = data.reservedHands || {}
    const players = data.players || []

    const isPlayer2 = playerId !== players[0]

    // Distribution des mains selon qui est connecté
    if (isPlayer2) {
      playerHand.value = allReserved['reservedPlayer2'] || []
      reservedHand.value = allHands[players[0]] || []
    } else {
      playerHand.value = allHands[playerId] || []
      reservedHand.value = allReserved['reservedPlayer2'] || []
    }

    trumpCard.value = data.trump || null
    drawPile.value = data.deck || []
 || []

    console.log('👤 Joueur ID:', playerId)
    console.log('🎴 Main:', playerHand.value)
    console.log('🂠 Main adverse:', reservedHand.value)
    console.log('🃏 Atout:', trumpCard.value)
  })
})
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
