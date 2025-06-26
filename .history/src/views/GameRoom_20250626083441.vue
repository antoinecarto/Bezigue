<template>
  <div class="game-room text-center p-4">
    <div v-if="loading">Chargement de la partie...</div>

    <div v-else-if="!roomData">
      Partie introuvable ou supprimée.
    </div>

    <!-- MAIN DE L’ADVERSAIRE (retournée) -->
    <div v-if="opponentHand.length" class="player-hand mt-6">
      <h3
        class="text-xl font-semibold mb-2"
        :class="{ 'text-green-600': currentTurn === opponentUid }"
      >
        Main de l’adversaire
      </h3>
      <div class="cards flex gap-2 justify-center flex-wrap">
        <div
          v-for="(card, index) in opponentHand"
          :key="index"
          class="card border px-3 py-2 rounded shadow text-xl bg-gray-200 text-gray-400"
        >
          📀
        </div>
      </div>

      <!-- Zone de dépôt adversaire -->
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

    <!-- Tapis de jeu : zone d’échange et atout -->
    <div class="mt-12 flex justify-center gap-8">
      <!-- Scoreboard -->
      <div class="scoreboard flex flex-col items-center gap-8 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48">
        <h3 class="text-lg font-semibold mb-4">Score</h3>
        <div class="text-xl font-bold text-green-700 mb-2">Joueur : {{ playerScore }}</div>
        <div class="text-xl font-bold text-red-700">Adversaire : {{ opponentScore }}</div>
      </div>

      <div class="flex items-start gap-8 bg-green-100 border-4 border-green-600 rounded-xl p-6 w-full shadow-lg">
        <!-- Zone d'échange -->
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

        <!-- Atout -->
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

    <!-- MAIN DU JOUEUR -->
    <div v-if="localHand.length" class="player-hand mt-8">
      <!-- Zone de dépôt joueur -->
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

      <!-- Main du joueur -->
      <div class="mt-4">
        <div class="cards flex gap-2 justify-center flex-wrap">
          <div
            v-for="card in localHand"
            :key="card"
            class="card border px-3 py-2 rounded shadow text-xl cursor-pointer"
            :class="getCardColor(card)"
            @click="playCard(card)"
          >
            {{ card }}
          </div>
        </div>
      </div>

      <h3 class="text-xl font-semibold mb-2" :class="{ 'text-green-600': currentTurn === uid }">
        Votre main
      </h3>
    </div>
  </div>
</template>



<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/firebase';

/* Util pour connaître la couleur d'une carte (string) */
function getCardColor(card: string): string {
  return card.slice(-1) === '♥' || card.slice(-1) === '♦' ? 'text-red-600' : 'text-black';
}

/* ---------- état local ---------- */
const route       = useRoute();
const roomId      = route.params.roomId as string;
const roomRef     = doc(db, 'rooms', roomId);

const loading     = ref(true);
const roomData    = ref<any>(null);
const uid         = ref<string | null>(null);

/* Données de jeu */
const localHand        = computed<string[]>(() => roomData.value?.hands?.[uid.value ?? ''] ?? []);
const opponentUid      = computed(() => Object.keys(roomData.value?.hands ?? {}).find(id => id !== uid.value) || null);
const opponentHand     = computed<string[]>(() => opponentUid.value ? roomData.value?.hands?.[opponentUid.value] ?? [] : []);

const battleZoneCards  = computed<string[]>(() => roomData.value?.trick?.cards ?? []);
const playerPlayedCards = computed<string[]>(() => {
  if (!roomData.value?.trick) return [];
  return roomData.value.trick.players
    .map((p: string, i: number) => (p === uid.value ? roomData.value.trick.cards[i] : null))
    .filter(Boolean);
});
const opponentPlayedCards = computed<string[]>(() => {
  if (!roomData.value?.trick) return [];
  return roomData.value.trick.players
    .map((p: string, i: number) => (p === opponentUid.value ? roomData.value.trick.cards[i] : null))
    .filter(Boolean);
});

const trumpCard   = computed(() => roomData.value?.trump ?? '—');
const deckCards   = computed(() => roomData.value?.deck ?? []);
const currentTurn = computed(() => roomData.value?.currentTurn ?? null);

const playerScore   = computed(() => roomData.value?.scores?.[uid.value ?? ''] ?? 0);
const opponentScore = computed(() => opponentUid.value ? roomData.value?.scores?.[opponentUid.value] ?? 0 : 0);

/* ---------- abonnement Firestore ---------- */
function subscribeRoom() {
  onSnapshot(roomRef, snap => {
    roomData.value = snap.exists() ? snap.data() : null;
    loading.value  = false;
  });
}

onMounted(() => {
  onAuthStateChanged(getAuth(), user => {
    uid.value = user?.uid ?? null;
    if (uid.value) subscribeRoom();
    else loading.value = false;
  });
});

/* ---------- clic sur une carte ---------- */
async function playCard(card: string) {
  if (!uid.value || !roomData.value) return;
  if (currentTurn.value !== uid.value) return;

  await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw 'Partie supprimée';

    const data = snap.data();
    if (data.currentTurn !== uid.value) throw 'Tour incorrect';
    if (!data.hands[uid.value].includes(card)) throw 'Carte absente';

    /* retirer carte de la main */
    const newHand = data.hands[uid.value].filter((c: string) => c !== card);
    /* ajouter au pli */
    const trick = data.trick ?? { cards: [], players: [] };
    trick.cards.push(card);
    trick.players.push(uid.value);

    const update: any = {
      [`hands.${uid.value}`]: newHand,
      trick
    };

    /* si pli complet (2 cartes) → résolution */
    if (trick.cards.length === 2) {
      const winner = resolveTrick(
        trick.cards[0],
        trick.cards[1],
        trick.players[0],
        trick.players[1],
        data.trump
      );
      update.currentTurn = winner;
      update.trick       = { cards: [], players: [] }; // vider la zone
    } else {
      update.currentTurn = opponentUid.value;
    }

    tx.update(roomRef, update);
  });
}

/* ---------- résolution simple du pli ---------- */
function resolveTrick(c1: string, c2: string, p1: string, p2: string, trump: string): string {
  const rankOrder = ['7','8','9','10','J','Q','K','A'];
  const suit = (card: string) => card.slice(-1);
  const rank = (card: string) => card.slice(0, card.length - 1);

  const sameSuit = suit(c1) === suit(c2);
  const trumpSuit = suit(trump);

  /* même couleur */
  if (sameSuit) {
    return rankOrder.indexOf(rank(c1)) > rankOrder.indexOf(rank(c2)) ? p1 : p2;
  }

  /* un seul atout */
  if (suit(c1) === trumpSuit && suit(c2) !== trumpSuit) return p1;
  if (suit(c2) === trumpSuit && suit(c1) !== trumpSuit) return p2;

  /* sinon : couleur différente sans atout → premier joueur */
  return p1;
}
</script>

<style scoped>
.card {
  min-width: 40px;
  text-align: center;
  user-select: none;
  /* ajout d'un effet léger pour la carte */
  transition: transform 0.1s ease;
}
.card:hover {
  transform: scale(1.1);
  cursor: pointer;
}

.drop-zone {
  user-select: none;
}

.player-hand {
  user-select: none;
}

.battle-drop-zone {
  min-height: 90px;
  user-select: none;
}

.cards {
  user-select: none;
}
</style>
