<!-- src/components/GameRoom.vue -->
<template>
  <div class="game-room text-center p-4">
    <div v-if="loading">Chargement de la partie…</div>
    <div v-else-if="!roomData">Partie introuvable ou supprimée.</div>

    <!-- MAIN ADVERSAIRE (cartes retournées) -->
    <div v-else>
      <section class="player-hand mt-6">
        <h3
          class="text-xl font-semibold mb-2"
          :style="{ color: currentTurn === opponentUid ? 'green' : 'black' }"
        >
          Main de l’adversaire
        </h3>

        <div class="cards flex gap-2 justify-center flex-wrap">
          <div
            v-for="n in opponentHand.length"
            :key="n"
            class="card border px-3 py-2 rounded shadow text-xl bg-gray-200 text-gray-400"
          >
            🂠
          </div>
        </div>
      </section>

      <!-- TAPIS CENTRAL -->
      <div class="mt-10 flex flex-col items-center gap-6">
        <!-- Scoreboard -->
        <div
          class="scoreboard flex flex-col items-center gap-4 p-4 border-2 border-gray-300 rounded-lg shadow-md w-56"
        >
          <h3 class="text-lg font-semibold">Score</h3>
          <div class="text-xl font-bold text-green-700">Vous : {{ playerScore }}</div>
          <div class="text-xl font-bold text-red-700">
            Adversaire : {{ opponentScore }}
          </div>
        </div>

        <!-- TrickZone + atout / pioche -->
        <div
          class="flex flex-col lg:flex-row items-start gap-8 bg-green-100 border-4 border-green-600 rounded-xl p-6 w-full max-w-5xl shadow-lg"
        >
          <!-- TrickZone commune -->
          <TrickZone :cards="trickZoneCards" class="flex-1" />

          <!-- Atout / pioche -->
          <div class="flex flex-col items-center">
            <div class="text-sm text-gray-600 mb-1">Atout</div>
            <div
              class="card border-2 border-green-700 px-4 py-2 rounded shadow text-2xl bg-white mb-2"
            >
              {{ trumpCard }}
            </div>
            <div class="text-gray-700 text-sm italic text-center">
              {{ deckCards.length }} carte<span v-if="deckCards.length > 1">s</span> restantes
            </div>
          </div>
        </div>
      </div>

      <!-- MAIN LOCALE -->
      <section class="player-hand mt-10">
        <h3
          class="text-xl font-semibold mb-2"
          :style="{ color: currentTurn === uid ? 'green' : 'black' }"
        >
          Votre main
        </h3>

        <div class="cards flex gap-2 justify-center flex-wrap">
          <div
            v-for="card in localHand"
            :key="card"
            class="card border px-3 py-2 rounded shadow text-xl cursor-pointer"
            :class="getCardColor(card)"
            :style="{
              pointerEvents: currentTurn === uid ? 'auto' : 'none',
              opacity: currentTurn === uid ? 1 : 0.6
            }"
            @click="playCard(card)"
          >
            {{ card }}
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayRemove,
  arrayUnion,
  increment
} from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'
import TrickZone from '@/components/TrickZone.vue'
import type { CardData } from '@/types'

/* ─────────────── état global ─────────────── */
const route = useRoute()
const roomId = route.params.roomId as string
const roomData = ref<any>(null)
const loading = ref(true)
const uid = ref<string | null>(null)

/* ─────────────── scores & mains ─────────────── */
const playerScore = ref(0)
const opponentScore = ref(0)

const localHand = computed(() => {
  if (!uid.value || !roomData.value?.hands) return []
  return roomData.value.hands[uid.value] ?? []
})

const opponentUid = computed(() =>
  roomData.value?.hands ? Object.keys(roomData.value.hands).find(k => k !== uid.value) : null
)

const opponentHand = computed(() =>
  opponentUid.value ? roomData.value.hands[opponentUid.value] ?? [] : []
)

/* ─────────────── trick zone & tour ─────────────── */
const trickZoneCards = computed<CardData[]>(() => roomData.value?.trickZoneCards ?? [])
const currentTurn = computed<string | null>(() => roomData.value?.currentTurn ?? null)

/* ─────────────── autres infos ─────────────── */
const deckCards = computed(() => roomData.value?.deck ?? [])
const trumpCard = computed(() => roomData.value?.trumpCard ?? '—')

/* ─────────────── utilitaires ─────────────── */
function getCardColor(card: string) {
  const suit = card.slice(-1)
  return suit === '♥' || suit === '♦' ? 'text-red-600' : 'text-black'
}

/* ─────────────── Firestore live ─────────────── */
onMounted(() => {
  onAuthStateChanged(getAuth(), user => {
    if (user) {
      uid.value = user.uid
      subscribeRoom()
    } else {
      loading.value = false
    }
  })
})

function subscribeRoom() {
  const roomRef = doc(db, 'rooms', roomId)
  onSnapshot(roomRef, snap => {
    roomData.value = snap.exists() ? snap.data() : null
    playerScore.value = roomData.value?.scores?.[uid.value!] ?? 0
    opponentScore.value = roomData.value?.scores?.[opponentUid.value!] ?? 0
    loading.value = false
  })
}

/* ─────────────── jouer une carte ─────────────── */
async function playCard(card: string) {
  if (!uid.value || !roomData.value) return
  if (currentTurn.value !== uid.value) return

  const roomRef = doc(db, 'rooms', roomId)

  await updateDoc(roomRef, {
    /* on retire la carte de la main */
    [`hands.${uid.value}`]: arrayRemove(card),
    /* on l’ajoute dans la trick zone commune */
    trickZoneCards: arrayUnion(card),
    /* on mémorise qui a joué (utile pour connaître le vainqueur quand 2 cartes présentes) */
    lastPlayer: uid.value
  })
}
</script>

<style scoped>
.game-room {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  min-height: 100vh;
  background-color: #f1f5f9;
}
.card {
  min-width: 48px;
  min-height: 64px;
  text-align: center;
  transition: transform 0.2s;
}
.card:hover {
  transform: scale(1.1);
}
</style>
