<template>
  <div class="game-room text-center p-4">
        <div v-if="loading">Chargement de la partie...</div>

    <div v-else-if="!roomData">
      Partie introuvable ou supprimée.
    </div>


    <!-- MAIN DE L’ADVERSAIRE (retournée) -->
    <div v-if="opponentHand.length" class="player-hand mt-6">
      <h3 class="text-xl font-semibold mb-2":class="{ 'text-green-600': currentTurn === opponentUid }"
            >Main de l’adversaire</h3>
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
    <h3 class="text-xl font-semibold mb-2" :class="{ 'text-green-600': currentTurn === uid }"
          >Votre main</h3>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  doc,
  onSnapshot,
  runTransaction,
  arrayRemove,
  arrayUnion,
  increment
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'
import { resolveTrick } from '@/utils/gamelogic'        // <── nouvel import

/* ──────────  état général  ────────── */
const route = useRoute()
const roomId = route.params.roomId as string
const roomRef = doc(db, 'rooms', roomId)

const roomData = ref<any>(null)
const loading  = ref(true)
const uid      = ref<string | null>(null)

onMounted(() => {
  onAuthStateChanged(getAuth(), user => {
    uid.value = user?.uid ?? null
    if (uid.value) subscribeRoom()
    else loading.value = false
  })
})

function subscribeRoom() {
  onSnapshot(roomRef, snap => {
    roomData.value = snap.exists() ? snap.data() : null
    loading.value  = false
  })
}

/* ──────────  aides  ────────── */
const opponentUid = computed(() =>
  roomData.value?.hands ? Object.keys(roomData.value.hands).find(k => k !== uid.value) : null
)

const localHand = computed<string[]>(() =>
  uid.value ? roomData.value?.hands?.[uid.value] ?? [] : []
)

const opponentHand = computed<string[]>(() =>
  opponentUid.value ? roomData.value?.hands?.[opponentUid.value] ?? [] : []
)

const currentTurn = computed<string | null>(() => roomData.value?.currentTurn ?? null)
const deckCards   = computed(() => roomData.value?.deck ?? [])
const trumpCard   = computed(() => roomData.value?.trumpCard ?? '—')

/* ──────────  clic sur une carte  ────────── */
async function playCard(card: string) {
  if (!uid.value || !roomData.value) return
  if (currentTurn.value !== uid.value) return            // pas ton tour

  await runTransaction(db, async txn => {
    const snap = await txn.get(roomRef)
    if (!snap.exists()) return
    const data = snap.data()

    const trick: string[] = data.trickZoneCards ?? []
    const hands  = data.hands ?? {}
    const scores = data.scores ?? {}
    const trump  = data.trumpCard as string
    const oppUid = Object.keys(hands).find(k => k !== uid.value)

    // sécurité : la carte est-elle bien dans ta main ?
    if (!(hands[uid.value] ?? []).includes(card)) return

    /* ─── 1re carte du pli ─── */
    if (trick.length === 0) {
      txn.update(roomRef, {
        [`hands.${uid.value}`]      : arrayRemove(card),
        trickZoneCards              : arrayUnion(card),
        firstPlayerOfTrick          : uid.value,
        currentTurn                 : oppUid             // à l’adversaire
      })
      return
    }

    /* ─── 2e carte : on résout le pli ─── */
    if (trick.length === 1 && oppUid) {
      const firstCard = trick[0]
      const winnerUid = resolveTrick(
        firstCard,
        card,
        data.firstPlayerOfTrick,
        uid.value,
        trump
      )

      // Exemple de comptage : +1 au vainqueur (adapte à ta valeur réelle)
      txn.update(roomRef, {
        [`hands.${uid.value}`]      : arrayRemove(card),
        trickZoneCards              : [],                // on vide le tapis
        firstPlayerOfTrick          : null,
        currentTurn                 : winnerUid,
        [`scores.${winnerUid}`]     : increment(1),
        [`scores.${uid.value}`]     : increment(0)       // crée la clé si absente
      })
    }
  })
}

/* ──────────  helpers d’affichage  ────────── */
function getCardColor(raw: string) {
  const suit = raw.slice(-1)
  return suit === '♥' || suit === '♦' ? 'text-red-600' : 'text-black'
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
