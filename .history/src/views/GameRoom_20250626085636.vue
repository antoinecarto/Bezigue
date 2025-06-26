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
          🂠
        </div>
      </div>

      <!-- Zone de dépôt adversaire dans le même bloc -->
      <div
        class="drop-zone mt-4 p-4 border-2 border-dashed border-gray-400 rounded bg-gray-50"
      >
        Zone de dépôt adversaire (visible par tous)
        <!-- <div class="played-cards flex justify-center gap-2 mt-2">
          <div
            v-for="(card, index) in opponentPlayedCards"
            :key="'opp-played-' + index"
            class="card border px-3 py-2 rounded shadow text-xl"
            :class="getCardColor(card)"
          >
            {{ card }}
          </div>
        </div> -->
      </div>
    </div>

    <!-- Tapis de jeu : zone d’échange à gauche, atout à droite -->
    <div class="mt-12 flex justify-center gap-8">
      <!-- Compteur de score à gauche -->
      <div
        class="scoreboard flex flex-col items-center gap-8 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48"
      >
        <h3 class="text-lg font-semibold mb-4">Score</h3>
        <div class="text-xl font-bold text-green-700 mb-2">
          Joueur : {{ playerScore }}
        </div>
        <div class="text-xl font-bold text-red-700">
          Adversaire : {{ opponentScore }}
        </div>
      </div>

      <div
        class="flex items-start gap-8 bg-green-100 border-4 border-green-600 rounded-xl p-6 w-full shadow-lg"
      >
    <!-- Zone d'échange (dépose de cartes) -->
  <div class="flex-grow">
    <h3 class="text-lg font-semibold text-green-800 mb-2 text-center">
      Zone d'échange
    </h3>
    <div
      class="battle-drop-zone h-32 border-2 border-dashed border-green-400 rounded bg-green-50 p-4 flex items-center justify-start gap-4"
    >
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
          <div
            class="card border-2 border-green-700 px-4 py-2 rounded shadow text-2xl bg-white mb-2"
          >
            {{ trumpCard }}
          </div>
          <div class="text-gray-700 text-sm italic text-center">
            {{ deckCards.length }} carte<span v-if="deckCards.length > 1"
              >s</span
            >
            restantes
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN DU JOUEUR ACTIF + Zone de dépôt intégrée -->
    <div v-if="localHand.length" class="player-hand mt-8">
      <!-- Zone de dépôt du joueur -->
      <div
        class="drop-zone mt-4 p-4 border-2 border-dashed border-gray-400 rounded bg-gray-50"
      >
        Zone de dépôt joueur (visible par tous)
        <!-- <div class="played-cards flex justify-center gap-2 mt-2">
          <div
            v-for="(card, index) in playerPlayedCards"
            :key="'player-played-' + index"
            class="card border px-3 py-2 rounded shadow text-xl"
            :class="getCardColor(card)"
          >
            {{ card }}
          </div>
        </div> -->
      </div>

      <!-- MAIN DU JOUEUR avec espacement -->
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
      <h3
        class="text-xl font-semibold mb-2"
        :class="{ 'text-green-600': currentTurn === uid }"
      >
        Votre main
      </h3>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import {
  doc,
  onSnapshot,
  runTransaction,
  arrayRemove,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase";

// Fonction utilitaire pour résoudre le pli (logique du jeu)
function resolveTrick(
  firstCard: string,
  secondCard: string,
  firstPlayerUid: string,
  secondPlayerUid: string,
  trumpCard: string
): string {
  // Extraire la couleur et la valeur (supposons que la valeur est avant la dernière lettre, la couleur est la dernière lettre)
  const getValue = (card: string) => {
    const val = card.slice(0, card.length - 1);
    if (val === "A") return 14;
    if (val === "K") return 13;
    if (val === "Q") return 12;
    if (val === "J") return 11;
    if (val === "10") return 10;
    if (!isNaN(parseInt(val))) return parseInt(val);
    return 0;
  };
  const getSuit = (card: string) => card.slice(-1);

  const firstSuit = getSuit(firstCard);
  const secondSuit = getSuit(secondCard);
  const firstValue = getValue(firstCard);
  const secondValue = getValue(secondCard);
  const trumpSuit = getSuit(trumpCard);

  // Règles de résolution du pli
  // Si même couleur => plus haute valeur gagne (sinon premier joueur si égalité)
  if (firstSuit === secondSuit) {
    if (secondValue > firstValue) return secondPlayerUid;
    else return firstPlayerUid;
  }

  // Si couleur différente sans atout => premier joueur gagne
  if (firstSuit !== trumpSuit && secondSuit !== trumpSuit) {
    return firstPlayerUid;
  }

  // Sinon atout gagne (si deux atouts, plus forte valeur gagne)
  if (firstSuit === trumpSuit && secondSuit !== trumpSuit) return firstPlayerUid;
  if (firstSuit !== trumpSuit && secondSuit === trumpSuit) return secondPlayerUid;

  // Les deux sont atout, plus forte valeur gagne
  if (firstSuit === trumpSuit && secondSuit === trumpSuit) {
    if (secondValue > firstValue) return secondPlayerUid;
    else return firstPlayerUid;
  }

  // Cas par défaut, premier joueur gagne
  return firstPlayerUid;
}

/* ── nouveau state ───────────────────────────── */
const battleZoneCards = ref<string[]>([]);

const currentMeneId = computed(() => roomData.value?.currentMeneId ?? 0);

let unsubscribeMene: (() => void) | null = null;

function subscribeMene(roomId: string, meneId: number) {
  return onSnapshot(
    doc(db, "rooms", roomId, "menes", String(meneId)),
    (snap) => {
      battleZoneCards.value = snap.exists()
        ? snap.data().currentPliCards ?? []
        : [];
    }
  );
}

/* ──────────  état général  ────────── */
const route = useRoute();
const roomId = route.params.roomId as string;
const roomRef = doc(db, "rooms", roomId);

const roomData = ref<any>(null);
const loading = ref(true);
const uid = ref<string | null>(null);

onMounted(() => {
  onAuthStateChanged(getAuth(), (user) => {
    uid.value = user?.uid ?? null;
    if (uid.value) subscribeRoom();
    else loading.value = false;
  });
});

function subscribeRoom() {
  onSnapshot(roomRef, (snap) => {
    roomData.value = snap.exists() ? snap.data() : null;
    loading.value = false;
  });
}

/* ──────────  aides  ────────── */
const opponentUid = computed(() =>
  roomData.value?.hands
    ? Object.keys(roomData.value.hands).find((k) => k !== uid.value)
    : null
);

const localHand = computed<string[]>(() =>
  uid.value ? roomData.value?.hands?.[uid.value] ?? [] : []
);

const opponentHand = computed<string[]>(() =>
  opponentUid.value ? roomData.value?.hands?.[opponentUid.value] ?? [] : []
);

const currentTurn = computed<string | null>(() => roomData.value?.currentTurn ?? null);
const deckCards = computed(() => roomData.value?.deck ?? []);
const trumpCard = computed(() => roomData.value?.trumpCard ?? "—");

// Cartes jouées visibles dans les zones de dépôt
// const playerPlayedCards = computed<string[]>(() => roomData.value?.playerPlayedCards ?? []);
// const opponentPlayedCards = computed<string[]>(() => roomData.value?.opponentPlayedCards ?? []);

// Scores
const playerScore = computed(() => roomData.value?.scores?.[uid.value ?? ""] ?? 0);
const opponentScore = computed(() =>
  opponentUid.value ? roomData.value?.scores?.[opponentUid.value] ?? 0 : 0
);

/* ──────────  clic sur une carte  ────────── */
async function playCard(card: string) {
  if (!uid.value || !roomData.value) return;
  if (currentTurn.value !== uid.value) {
    alert("Ce n'est pas votre tour.");
    return;
  }

  const hand = roomData.value.hands[uid.value];
  if (!hand.includes(card)) {
    alert("Vous ne possédez pas cette carte.");
    return;
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "La partie n'existe plus";

    const data = snap.data();

    if (data.currentTurn !== uid.value) throw "Ce n'est pas votre tour";

    const hands = data.hands;
    if (!hands[uid.value].includes(card)) throw "Carte non trouvée";

    // Retirer la carte jouée de la main
    hands[uid.value] = hands[uid.value].filter((c: string) => c !== card);

    // Mise à jour des cartes jouées
    let playerPlayedCards = data.playerPlayedCards ?? [];
    let opponentPlayedCards = data.opponentPlayedCards ?? [];

    // Ajouter la carte jouée dans la zone de dépôt du joueur
    playerPlayedCards.push(card);

    // Mise à jour des cartes jouées dans la DB
    tx.update(roomRef, {
      [`hands.${uid.value}`]: hands[uid.value],
      playerPlayedCards: playerPlayedCards,
    });

    // Changer le tour ou résoudre le pli s’il y a deux cartes jouées
    const nextTurnUid = opponentUid.value;

    // Si l'adversaire a aussi joué une carte, résoudre le pli
    if (opponentPlayedCards.length > 0) {
      const winnerUid = resolveTrick(
        playerPlayedCards[0],
        opponentPlayedCards[0],
        uid.value,
        opponentUid.value!,
        trumpCard.value
      );

      // Mise à jour du score si les cartes contiennent un 10 ou un A
      const cardsForScore = [...playerPlayedCards, ...opponentPlayedCards];
      const containsPointCard = cardsForScore.some((c) =>
        ["10", "A"].some((v) => c.startsWith(v))
      );

      // Ajouter les cartes au pli remporté
      const currentPliCards = data.currentPliCards ?? [];
      const newPliCards = [...currentPliCards, ...cardsForScore];

      // Mettre à jour la DB : vider les zones de dépôt, changer le tour, ajouter pli aux cartes capturées, mettre à jour le score
      const scores = data.scores ?? {};
      if (containsPointCard) {
        scores[winnerUid] = (scores[winnerUid] ?? 0) + cardsForScore.length;
      }

      tx.update(roomRef, {
        currentTurn: winnerUid,
        playerPlayedCards: [],
        opponentPlayedCards: [],
        scores: scores,
        currentPliCards: newPliCards,
      });
    } else {
      // Sinon juste passer le tour à l’adversaire
      tx.update(roomRef, {
        currentTurn: nextTurnUid,
      });
    }
  });
}

/* ──────────  style des cartes selon la couleur ────────── */
function getCardColor(card: string): string {
  const suit = card.slice(-1);
  switch (suit) {
    case "♠":
      return "text-black";
    case "♥":
      return "text-red-600";
    case "♦":
      return "text-red-500";
    case "♣":
      return "text-black";
    default:
      return "";
  }
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
