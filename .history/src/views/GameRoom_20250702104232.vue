<template>
  <div v-if="room?.phase === 'waiting'" class="text-center mt-8">
    <p class="text-xl">En attente dʼun adversaire…</p>
    <p class="text-sm text-gray-500"></p>
  </div>
  <!-- Modal des combinaisons (affiché seulement si showComboPopup === true) -->
  <teleport to="body">
    <ComboModal
      v-if="showComboPopup"
      :combos="validCombosFiltered"
      @combo-played="handleComboPlayed"
      @close="showComboPopup = false"
    />
  </teleport>
  <div class="game-room text-center p-4">
    <div v-if="loading">Chargement de la partie...</div>

    <div v-else-if="!room">Partie introuvable ou supprimée.</div>

    <!-- MAIN DE L’ADVERSAIRE (retournée) -->
    <div v-if="opponentHand.length" class="player-hand mt-6">
      <h3
        class="text-xl font-semibold mb-2"
        :class="{ 'text-green-600': room?.currentTurn === opponentUid }"
      >
        Main {{ deOuD(opponentName) }} {{ opponentName }}
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
      <div class="drop-zone …">
        <p class="text-xs font-semibold mb-1">Combinaisons adverses</p>

        <div
          v-if="opponentMelds.length"
          class="flex flex-wrap gap-2 justify-center"
        >
          <template v-for="(meld, i) in opponentMelds" :key="'oppmeld-' + i">
            <div
              v-for="c in meld.cards"
              :key="'opp' + c.rank + c.suit"
              class="card border px-3 py-2 rounded shadow text-xl"
              :class="getCardColor(cardToStr(c))"
            >
              {{ cardToStr(c) }}
            </div>
          </template>
        </div>

        <span v-else class="text-[10px] italic text-gray-400">Aucune</span>
      </div>
    </div>

    <div class="mt-12 flex justify-center gap-8">
      <!-- Premier scoreboard -->
      <!-- Scoreboard partie -->
      <div
        class="scoreboard flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48"
      >
        <h3 class="text-lg font-semibold mb-4">Partie</h3>

        <div class="text-xl font-bold text-gray-700">
          Vainqueur : {{ winnerName }}
        </div>

        <div class="text-xl font-bold text-gray-700">
          Partie en : {{ targetScore }} pts
        </div>
      </div>

      <!-- Deuxième scoreboard -->
      <div
        class="scoreboard flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48"
      >
        <h3 class="text-lg font-semibold mb-4">Score</h3>
        <div class="text-xl font-bold text-black-700 mb-2">
          {{ playerName }} : {{ playerScore }}
        </div>
        <div class="text-xl font-bold text-black-700">
          {{ opponentName }} : {{ opponentScore }}
        </div>
      </div>

      <!-- Conteneur vert qui encapsule zone d’échange + atout -->
      <div
        class="flex gap-8 bg-green-100 border-4 border-green-600 rounded-xl p-6 shadow-lg w-full max-w-4xl"
      >
        <!-- Zone d’échange -->
        <div class="flex-grow">
          <h3 class="text-lg font-semibold text-green-800 mb-2 text-center">
            Zone d'échange
          </h3>
          <div
            class="battle-drop-zone h-32 border-2 border-dashed border-green-400 rounded bg-green-50 p-4 flex items-center gap-4"
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

        <!-- Carte d’atout et pioche -->
        <div class="flex flex-col items-center">
          <div class="text-sm text-gray-600 mb-1">Atout</div>
          <div
            class="card border-2 border-green-700 px-4 py-2 rounded shadow text-2xl bg-white mb-2"
            :class="getCardColor(trumpCard)"
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
      <!-- Zone de dépôt joueur : mêmes cartes que la main -->
      <div
        class="drop-zone mt-4 p-4 border-2 border-dashed border-gray-400 rounded bg-gray-50"
      >
        <p class="text-xs font-semibold mb-1">Vos combinaisons</p>

        <div
          v-if="playerMelds.length"
          class="flex flex-wrap gap-2 justify-center"
        >
          <!-- on parcourt chaque combinaison -->
          <template
            v-for="(meld, mIndex) in playerMelds"
            :key="'meld-' + mIndex"
          >
            <div
              v-for="c in meld.cards"
              :key="c.rank + c.suit"
              class="card border px-3 py-2 rounded shadow text-xl"
              :class="getCardColor(cardToStr(c))"
              @click="playCardFromMeld(c)"
            >
              {{ cardToStr(c) }}
            </div>
          </template>
        </div>

        <span v-else class="text-[10px] italic text-gray-400">Aucune</span>
      </div>

      <!-- MAIN DU JOUEUR avec espacement -->
      <div class="mt-4">
        <draggable
          v-model="localHand"
          @end="onHandReorder"
          class="cards flex gap-2 justify-center flex-wrap"
          :item-key="keyForCard"
        >
          <template #item="{ element: card }">
            <div
              class="card w-10 h-14 sm:w-12 sm:h-16 lg:w-14 lg:h-20 border rounded shadow flex items-center justify-center select-none text-1xl sm:text-2xl lg:text-3xl"
              :class="getCardColor(card)"
              @click="playCardFromHand(card)"
            >
              {{ card }}
            </div>
          </template>
        </draggable>
      </div>
      <h3
        class="text-xl font-semibold mb-2"
        :class="{ 'text-green-600': room?.currentTurn === myUid }"
      >
        Votre main
      </h3>
    </div>
  </div>
  <!-- popup -->
  <div
    v-if="showComboPopup"
    class="fixed inset-0 bg-black/50 flex items-center justify-center"
    @click.self="showComboPopup = false"
  >
    <div class="bg-white p-6 rounded-lg w-80">
      <h3 class="text-lg font-semibold mb-4">Combinaisons possibles</h3>
      <ul class="space-y-2 max-h-56 overflow-y-auto">
        <li v-for="(combo, i) in validCombosFiltered" :key="combo.name">
          <button
            class="w-full px-3 py-1 border rounded hover:bg-slate-100"
            @click="choose(combo)"
          >
            {{ combo.name }} ({{ combo.points }} pts)
          </button>
        </li>
      </ul>
      <button class="mt-4 text-sm text-red-600" @click="showComboPopup = false">
        Fermer
      </button>
    </div>
  </div>
  <teleport to="body">
    <div
      v-if="showExchange"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="showExchange = false"
      role="dialog"
      aria-modal="true"
    >
      <div class="bg-white p-6 rounded-2xl w-72">
        <h2 class="text-lg font-semibold mb-4 text-center">
          Échanger le 7 d’atout&nbsp;?
        </h2>

        <p class="text-center mb-4">
          Vous pouvez prendre
          <strong>{{ trumpCard }}</strong>
          et placer votre
          <strong>7{{ trumpSuit }}</strong>
          face visible.
        </p>

        <div class="flex gap-3">
          <button class="flex-1 btn" @click="confirmExchange">Oui</button>
          <button class="flex-1 btn" @click="showExchange = false">Non</button>
        </div>
      </div>
    </div>
  </teleport>
  <!-- MODAL NOM -->
  <div
    v-if="showNameModal"
    class="fixed inset-0 bg-black/50 flex items-center justify-center"
  >
    <div class="bg-white p-6 rounded-lg w-80">
      <h3 class="text-lg font-semibold mb-4">Choisissez votre nom :</h3>
      <input v-model="nameInput" class="border w-full p-2 rounded mb-4" />
      <button
        class="w-full bg-green-600 text-white py-2 rounded"
        @click="saveName"
        :disabled="!nameInput.trim()"
      >
        Enregistrer
      </button>
    </div>
  </div>
  <!-- POP‑UP Pas votre tour --------------------------------------------- -->
  <div
    v-if="showTurnAlert"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
  >
    <div
      class="w-80 max-w-[90%] rounded-2xl bg-white p-6 text-center shadow-2xl"
    >
      <h2 class="mb-4 text-2xl font-semibold text-red-600">
        Pas votre tour&nbsp;!
      </h2>
      <p class="mb-6">
        Attendez que votre adversaire joue avant de poser une carte.
      </p>
      <button class="btn w-full" @click="showTurnAlert = false">OK</button>
    </div>
  </div>
</template>
<script setup lang="ts">
/* ────────────── Imports ─────────────────────────────── */
import { ref, computed, watch, onMounted, onUnmounted, watchEffect } from "vue";
import { useRoute } from "vue-router";
import {
  collection,
  setDoc,
  Transaction,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
  getFirestore,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Draggable from "vuedraggable";
import { generateShuffledDeck, distributeCards } from "@/game/BezigueGame";

// import { db } from "@/firebase";

/* ────────────── Types ───────────────────────────────── */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "J" | "Q" | "K" | "10" | "A";
export interface Card {
  rank: Rank;
  suit: Suit;
}
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}
const db = getFirestore();

interface RoomDoc {
  players: string[];
  playerNames: Record<string, string>;
  phase: "waiting" | "play" | "draw" | "meld" | "finished";
  currentTurn: string;
  drawQueue: string[];
  trumpCard: string;
  trumpTaken: boolean;
  deck: string[];
  hands: Record<string, string[]>;
  melds: Record<string, Combination[]>;
  canMeld: string | null;
  trick: { cards: string[]; players: string[] };
  scores: Record<string, number>;
  targetScore: number;
  winnerName: string;
  currentMeneIndex: number;
  trumpSuit: Suit;
}

/* ────────────── Helpers ─────────────────────────────── */
const cardToStr = (c: Card | string) =>
  typeof c === "string" ? c : `${c.rank}${c.suit}`;

/* ────────────── Reactive State ───────────────────────── */
const route = useRoute();
const roomId = route.params.roomId as string;
const roomRef = doc(db, "rooms", roomId);

const myUid = ref<string | null>(null);
const room = ref<RoomDoc | null>(null);
const loading = ref(true);
const localHand = ref<string[]>([]);

/** Retourne une clé unique « valeur-rang » (ex : "J♣-0") */
const keyForCard = (card: string, index: number) => `${card}-${index}`;

// UI & modal helpers
const showNameModal = ref(false);
const nameInput = ref("");
const roomData = ref<any>(null);
const showTurnAlert = ref(false);
const combosDecisionTaken = ref(false);

/* ─── FLAGS réactifs ─────────────────────────── */
const showExchange = ref(false); // popup 7
const exchangeDone = ref(false); // transaction 7 réussie
const showComboPopup = ref(false); // popup combinaisons
const validCombosFiltered = ref<Combination[]>([]);
const asked7ThisTrick = ref(false); // popup 7 déjà proposée
const askedCombiThisTrick = ref(false); // popup combo déjà proposée

/* ─── ID du timer qui déclenchera la résolution du pli ─── */
/* protège contre les appels multiples */
/* ────────────── Computed Shortcuts ───────────────────── */
const targetScore = computed(
  () => room.value?.targetScore ?? 2000 // repli si champ absent
);

const roomReady = computed(() => room.value?.players.length === 2);

/* winnerName = le premier joueur dont le score >= targetScore */
const winnerName = computed(() => {
  if (!roomData.value?.scores) return "—";
  const entries = Object.entries(roomData.value.scores);
  const hit = entries.find(([, pts]) => pts >= targetScore.value);
  if (!hit) return "—";
  const [uidHit] = hit;
  return roomData.value.names?.[uidHit] || "—";
});
const opponentUid = computed(
  () => room.value?.players.find((u) => u !== myUid.value) ?? null
);

const opponentHand = computed(() =>
  opponentUid.value ? room.value?.hands?.[opponentUid.value] ?? [] : []
);

const trumpCard = computed(() => room.value?.trumpCard ?? "—");
const deckCards = computed(() => room.value?.deck ?? []);

const playerMelds = computed(
  () => room.value?.melds?.[myUid.value ?? ""] ?? []
);
const opponentMelds = computed(() =>
  opponentUid.value ? room.value?.melds?.[opponentUid.value] ?? [] : []
);

const playerScore = computed(
  () => room.value?.scores?.[myUid.value ?? ""] ?? 0
);
const opponentScore = computed(() =>
  opponentUid.value ? room.value?.scores?.[opponentUid.value] ?? 0 : 0
);

const battleZoneCards = computed(() => room.value?.trick?.cards ?? []);

const playerName = computed(
  () => room.value?.playerNames?.[myUid.value ?? ""] ?? "Vous"
);
const opponentName = computed(() =>
  opponentUid.value
    ? room.value?.playerNames?.[opponentUid.value] ?? "Adversaire"
    : "Adversaire"
);
// dérive la couleur d'atout → '♠', '♥', …
const trumpSuit = computed(() => trumpCard.value.slice(-1));

const isMyTurn = computed(() => {
  if (!room.value || !myUid.value) return false;
  switch (room.value.phase) {
    case "play":
      return room.value.currentTurn === myUid.value;
    case "draw":
      return room.value.drawQueue?.[0] === myUid.value;
    case "meld":
      return room.value.canMeld === myUid.value;
    default:
      return false;
  }
});

//* ───────── Firestore subscription ───────── */
function subscribeRoom() {
  return onSnapshot(roomRef, async (snap) => {
    loading.value = false;

    /* Room supprimée ? */
    if (!snap.exists()) {
      room.value = null;
      return;
    }

    /* 1. Données courantes ---------------------------------- */
    const d = snap.data() as RoomDoc;
    room.value = d;

    /* 2. Lancer la partie si « waiting » et deux joueurs ------ */
    if (d.phase === "waiting" && d.players.length === 2) {
      // Transaction pour éviter la course avec l’autre client
      await runTransaction(db, async (tx) => {
        const freshSnap = await tx.get(roomRef);
        const fresh = freshSnap.data() as RoomDoc;
        if (fresh.phase === "waiting" && fresh.players.length === 2) {
          maybeStartGame(tx, fresh); // distribue + currentTurn
        }
      });
      return; // on attend le prochain snapshot « play »
    }

    /* 3. Mettre à jour l’état local ------------------------- */
    if (myUid.value) {
      localHand.value = d.hands?.[myUid.value] ?? [];

      /* Nom manquant ? → popup */
      showNameModal.value = !d.playerNames?.[myUid.value];
    }

    /* 4. Pli complet ? ------------------------------------- */
    if (d.phase === "play" && d.trick.cards.length === 2) {
      tryEndTrick(); // résout le pli
    }
  });
}

/* ────────────── Lifecycle ───────────────────────────── */
let unsubscribeRoom: (() => void) | null = null;

onMounted(() => {
  const auth = getAuth();
  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    myUid.value = user?.uid ?? null;

    // Si déjà abonné à la room, on se désabonne avant
    if (unsubscribeRoom) {
      unsubscribeRoom();
      unsubscribeRoom = null;
    }

    if (myUid.value) {
      unsubscribeRoom = subscribeRoom();
    } else {
      loading.value = false;
    }
  });

  // Nettoyage aussi du listener auth si besoin
  onUnmounted(() => {
    unsubscribeRoom?.();
    unsubscribeAuth(); // ⬅️ important si tu veux éviter une fuite mémoire
  });
});

/* ────────────── Watchers ─────────────────────────────── */
/* Ouvre la popup de demande de nom si vide */
watch(
  () => roomData.value?.playerNames,
  () => {
    if (myUid.value && roomData.value) {
      const current = roomData.value.playerNames?.[myUid.value] ?? "";
      if (!current.trim()) {
        // nom encore vide
        nameInput.value = "";
        showNameModal.value = true;
      } else {
        showNameModal.value = false;
      }
    }
  },
  { immediate: true }
);

/* RESET en début de tour */
watchEffect(() => {
  if (room.value?.phase === "play") {
    askedCombiThisTrick.value = false;
    showComboPopup.value = false;
  }
});

/* WATCHER popup Combinaisons */
watchEffect(() => {
  const r = room.value;
  if (!r || !myUid.value) return;

  if (showComboPopup.value || askedCombiThisTrick.value) return;
  if (showExchange.value) return; // popup 7 encore visible
  if (asked7ThisTrick.value && !exchangeDone.value) return;

  if (r.phase !== "meld" || r.canMeld !== myUid.value) return;

  const handCards = r.hands[myUid.value].map(strToCard); // Card[]
  const meldCards = (r.melds?.[myUid.value] ?? []).flatMap((m) => m.cards);
  const combos = detectCombinations(
    handCards, // main
    meldCards, // cartes déjà posées
    r.trumpSuit, // atout stocké dans le doc
    r.melds?.[myUid.value] ?? []
  );

  if (combos.length) {
    validCombosFiltered.value = combos;
    showComboPopup.value = true; // on attend le clic
  } else {
    forceEndMeldPhase(); // rien à poser → draw
  }
  askedCombiThisTrick.value = true;
});
/*------------------------------------------------------------------------------------------------------*/
/*----------------------------------------- Démarrage du jeu -------------------------------------------*/
/*------------------------------------------------------------------------------------------------------*/

function maybeStartGame(tx: Transaction, d: RoomDoc) {
  if (d.phase !== "waiting") return;
  if (d.players.length !== 2) return; // il manque encore quelqu’un

  // 1. Qui commence ?  → l’hôte
  const host = d.players[0]; // fallback players[0]
  const guest = d.players.find((u) => u !== host)!;

  // 2. Distribution : on veut que "host" reçoive la main player1
  const fullDeck = generateShuffledDeck();
  const distrib = distributeCards(fullDeck); //  { hands: { player1, player2 }, drawPile, trumpCard }

  const hands: Record<string, string[]> = {
    [host]: distrib.hands.player1.map((card) => card.toString()),
    [guest]: distrib.hands.player2.map((card) => card.toString()),
  };

  // 3. Mise à jour Firestore
  tx.update(roomRef, {
    phase: "play",
    currentTurn: host, // 🏁 l’hôte joue en premier
    deck: distrib.drawPile.map((card) => card.toString()),
    trumpCard: distrib.trumpCard.toString(),
    trumpTaken: false,
    trumpSuit: distrib.trumpCard.toString().slice(-1) as Suit,
    hands,
    melds: {},
    trick: { cards: [], players: [] },
    drawQueue: [],
  });
}

/* ─── 7 ────────────────────────────────────────── */

async function confirmExchange() {
  showExchange.value = false;
  const ok = await tryExchangeSeven(myUid.value!);
  if (ok) exchangeDone.value = true; // signale la réussite
}

/* ─── Auto‑pioche ────────────────────────────────────────── */
const drawingNow = ref(false);

watchEffect(() => {
  const r = room.value;
  if (!r || !myUid.value) return;

  // Condition minimale pour piocher
  if (r.phase !== "draw") return;
  if (r.drawQueue?.[0] !== myUid.value) return;
  if (drawingNow.value) return; // déjà en cours

  // Ne pas bloquer sur showComboPopup : à ce stade elle est fermée
  if (showExchange.value || loading.value) return;

  drawingNow.value = true;
  drawCard()
    .catch(console.error)
    .finally(() => (drawingNow.value = false));
});

/* reset automatique à chaque début de pli (phase "play") */
watchEffect(() => {
  if (room.value?.phase === "play") {
    hasPromptedForThisTrick.value = false; // popup échange 7
  }
});

/* ─── Popup échange du 7 d'atout ───────────────────────── */
const hasPromptedForThisTrick = ref(false); // évite de rouvrir 2×

watchEffect(() => {
  const r = room.value;
  if (!r || !myUid.value) return;

  /* reset en début de pli seulement */
  if (r.phase === "play") {
    hasPromptedForThisTrick.value = false;
    showExchange.value = false;
    return;
  }

  /* si déjà affichée, on ne touche plus */
  if (showExchange.value || hasPromptedForThisTrick.value) return;

  /* conditions d’ouverture */
  const deckOk = (r.deck?.length ?? 0) > 0;
  const rankCur = r.trumpCard.slice(0, -1);
  const suit = r.trumpCard.slice(-1);
  const cardOk = ["A", "K", "Q", "J", "10"].includes(rankCur);
  const have7 = r.hands[myUid.value].includes("7" + suit);
  const iWin =
    (r.phase === "meld" && r.canMeld === myUid.value) ||
    (r.phase === "draw" && r.drawQueue?.[0] === myUid.value);

  if (deckOk && cardOk && have7 && iWin) {
    showExchange.value = true;
    hasPromptedForThisTrick.value = true;
  }
});

/* ─── Pioche vide : rapatriement des melds ─── */
watchEffect(async () => {
  const r = room.value;
  if (!r || r.deck.length > 0) return; // pioche encore active

  /* on ne l’exécute qu’une seule fois */
  if (r.phase === "finished") return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const d = snap.data() as RoomDoc;
    if (d.deck.length > 0) return; // autre client plus rapide ?

    /* pour chaque joueur, réintègre ses melds */
    const update: Record<string, any> = {};
    d.players.forEach((uid) => {
      const mergedHand = mergeMeldsIntoHand(d, uid);
      update[`hands.${uid}`] = mergedHand;
      update[`melds.${uid}`] = []; // melds vidés
    });

    /* passe la phase en 'play' s’il reste des cartes sinon 'end-mene' */
    update.phase = "play";
    tx.update(roomRef, update);
  });
});

/* ─── Fin de mène : pioche vide + mains vides ─── */
watchEffect(async () => {
  const r = room.value;
  if (!r) return;

  const allHandsEmpty = r.players.every((u) => (r.hands[u]?.length ?? 0) === 0);
  const deckEmpty = r.deck.length === 0;

  if (!deckEmpty || !allHandsEmpty || r.phase === "finished") return;

  await endMene(); // fonction ci‑dessous
});

/* finalisation de la mène et de la partie */
async function endMene() {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;

    /* 0. Qui a remporté le dernier pli ?  */
    const lastWinnerUid = d.currentTurn; // ← vainqueur du dernier pli

    /* 1. +10 pts pour ce dernier pli */
    const scores = { ...d.scores };
    scores[lastWinnerUid] = (scores[lastWinnerUid] ?? 0) + 10;

    /* 2. Fin de partie ? */
    const target = d.targetScore ?? 2000;
    const finale = Object.entries(scores).find(([, pts]) => pts >= target)?.[0];

    if (finale) {
      tx.update(roomRef, {
        phase: "finished",
        winnerUid: finale,
        scores, // <-- on enregistre le total mis à jour
      });
      return;
    }

    /* 3. Préparer la nouvelle mène (même logique qu’avant) -------- */
    const prevFirstRef = doc(
      db,
      "rooms",
      roomId,
      "menes",
      String(d.currentMeneIndex)
    );
    const prevFirstSnap = await tx.get(prevFirstRef);
    const prevStarter = prevFirstSnap.exists()
      ? (prevFirstSnap.data() as any).firstPlayerUid
      : d.players[0];

    const nextStarter = d.players.find((u) => u !== prevStarter)!;

    const nextMeneIndex = (d.currentMeneIndex ?? 0) + 1;
    const fullDeck = generateShuffledDeck();
    const distrib = distributeCards(fullDeck);

    const hands: Record<string, string[]> = {
      [nextStarter]: distrib.hands.player1,
      [d.players.find((u) => u !== nextStarter)!]: distrib.hands.player2,
    };

    /* 4. Update room */
    tx.update(roomRef, {
      phase: "play",
      currentMeneIndex: nextMeneIndex,
      currentTurn: nextStarter,
      nextTurnUid: nextStarter,

      deck: distrib.drawPile,
      trumpCard: distrib.trumpCard,
      trumpTaken: false,
      hands,
      melds: {},
      trick: { cards: [], players: [] },
      canMeld: null,
      drawQueue: [],
      scores, // <-- scores avec +10 pts
    });

    /* 5. Doc mene/{n} */
    tx.set(doc(db, "rooms", roomId, "menes", String(nextMeneIndex)), {
      firstPlayerUid: nextStarter,
      currentPliCards: [],
      plies: [],
      scores,
      targetScore: target,
    });
  });
}

/* ────────────── UI helpers ───────────────────────────── */
function deOuD(name: string): string {
  if (!name) return "de";
  const first = name.trim().charAt(0).toLowerCase();
  return "aeiouyhàâäéèêëïîôöùûüÿ".includes(first) ? "d’" : "de ";
}

function getCardColor(card: string) {
  const suit = card.slice(-1);
  switch (suit) {
    case "♠":
    case "♣":
      return "text-black";
    case "♥":
      return "text-red-600";
    case "♦":
      return "text-red-500";
    default:
      return "";
  }
}

/** Replace toutes les cartes des melds du joueur dans sa main. */
function mergeMeldsIntoHand(d: RoomDoc, uid: string): string[] {
  const hand = [...d.hands[uid]]; // main actuelle
  const melds = d.melds?.[uid] ?? [];
  melds.flatMap((m) => m.cards).forEach((c) => hand.push(cardToStr(c))); // ajout melds

  return normalizeHand(hand); // 🚩 limite 2
}

/*────────────────────────────────────────────────────────────────────*/

/** Échange (facultatif) du 7 d’atout contre la trump exposée. */
/**
 * Tente d’échanger le 7 d’atout du joueur contre la trumpCard exposée.
 * - Réussit uniquement si la trumpCard est A, K, Q, J ou 10.
 * - Ne fait rien (retourne false) si l’échange n’est pas autorisé.
 * - return true si un échange a bien été effectué, false sinon.
 */
/** Échange le 7 d’atout contre la carte exposée.
 *  Retourne true si l’échange a été effectué, sinon false. */
async function tryExchangeSeven(playerUid: string): Promise<boolean> {
  let exchanged = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room introuvable";
    const d = snap.data() as RoomDoc;

    /* 0. Phase autorisée : le joueur doit avoir la main (meld ou draw) */
    const isMyTurn =
      (d.phase === "meld" && d.canMeld === playerUid) ||
      (d.phase === "draw" && d.drawQueue?.[0] === playerUid);
    if (!isMyTurn) return;

    /* 1. Encore des cartes dans le talon ? */
    if ((d.deck?.length ?? 0) === 0) return;

    const trumpCardCur = d.trumpCard; // ex: 'A♥'
    if (!trumpCardCur) return; // aucune carte exposée
    const allowed = ["A", "K", "Q", "J", "10"];

    /* 2. La carte exposée est-elle échangeable ? */
    const rankCur = trumpCardCur.slice(0, -1);
    if (!allowed.includes(rankCur)) return;

    /* 3. Le joueur possède‑t‑il le 7 d’atout ? */
    const sevenTrump = "7" + trumpCardCur.slice(-1); // ex: '7♥'
    const hand = [...d.hands[playerUid]];
    const idxSeven = hand.indexOf(sevenTrump);
    if (idxSeven === -1) return;

    /* 4. Construire la nouvelle main : swap 7 ↔ carte exposée */
    hand.splice(idxSeven, 1); // retire le 7
    hand.push(trumpCardCur); // ajoute la carte visible

    /* 5. Vérif globale main + melds : double‑paquet + total ≤ 9 */
    const melds = d.melds?.[playerUid] ?? [];
    checkHandAndMeld(hand, melds); // lance une exception si règle violée

    /* 6. Mise à jour Firestore */
    tx.update(roomRef, {
      [`hands.${playerUid}`]: hand,
      trumpCard: sevenTrump, // on expose maintenant le 7
      trumpSuit: sevenTrump.slice(-1) as Suit, // la couleur d’atout reste la même
    });

    exchanged = true;
  });

  return exchanged;
}

/** Joue une carte de la main (clic normal) */
async function playCardFromHand(cardStr: string) {
  if (!myUid.value || !roomReady.value) return;

  await runTransaction(db, async (tx) => {
    const d = (await tx.get(roomRef)).data() as RoomDoc;

    if (d.phase !== "play" || d.currentTurn !== myUid.value)
      throw "Pas votre tour";

    const hand = [...d.hands[myUid.value]];
    const idx = hand.indexOf(cardStr);
    if (idx === -1) throw "Carte absente dans la main";

    hand.splice(idx, 1); // retire

    pushCardToTrick(tx, d, cardStr, hand); // helper commun
  });
}

/** Joue une carte déjà posée dans un meld */
async function playCardFromMeld(card: Card) {
  if (!myUid.value || !roomReady.value) return;

  await runTransaction(db, async (tx) => {
    const d = (await tx.get(roomRef)).data() as RoomDoc;

    if (d.phase !== "play" || d.currentTurn !== myUid.value)
      throw "Pas votre tour";

    const cardStr = cardToStr(card);
    const melds = (d.melds?.[myUid.value] ?? []).map((m) => ({
      ...m,
      cards: [...m.cards], // copie défensive
    }));

    let found = false;
    melds.forEach((m) => {
      const i = m.cards.findIndex((c) => cardToStr(c) === cardStr);
      if (i !== -1) {
        m.cards.splice(i, 1);
        found = true;
      }
    });
    if (!found) throw "Carte absente dans vos combinaisons";

    // on retire les melds vides
    const filtered = melds.filter((m) => m.cards.length);

    pushCardToTrick(tx, d, cardStr, d.hands[myUid.value], filtered);
  });
}

/* Helper commun : pousse la carte dans le pli, met à jour hand+melds */
function pushCardToTrick(
  tx: Transaction,
  d: RoomDoc,
  cardStr: string,
  newHand: string[],
  newMelds: Combination[] = d.melds?.[myUid.value] ?? []
) {
  const trick = { ...d.trick };
  trick.cards.push(cardStr);
  trick.players.push(myUid.value!);

  const update: Record<string, any> = {
    [`hands.${myUid.value}`]: newHand,
    [`melds.${myUid.value}`]: newMelds,
    trick,
  };
  checkHandAndMeld(newHand, newMelds); // lance une exception si règle violée

  if (trick.cards.length === 1) {
    update.currentTurn = d.players.find((u) => u !== myUid.value);
  }
  tx.update(roomRef, update);
}

async function onHandReorder() {
  if (!myUid.value) return;
  await updateDoc(roomRef, { [`hands.${myUid.value}`]: localHand.value });
}

const saveName = async () => {
  const trimmedName = nameInput.value.trim();
  if (!trimmedName) return;

  if (!myUid.value || !room.value) return;

  // Met à jour dans Firestore
  const playerNames = { ...room.value.playerNames, [myUid.value]: trimmedName };
  await updateDoc(roomRef, { playerNames });

  showNameModal.value = false;
};

async function choose(combo: Combination) {
  // 1) On la retire tout de suite de la liste locale
  const key = (c: Combination) => c.cards.map(cardToStr).sort().join("-");
  validCombosFiltered.value = validCombosFiltered.value.filter(
    (c) => key(c) !== key(combo)
  );

  showComboPopup.value = false; // ferme visuellement la popup

  try {
    await playCombo(combo); // transaction Firestore
    combosDecisionTaken.value = true; // succès => on ne rouvre pas
  } catch (e) {
    console.error("Échec playCombo : ", e);
    alert(e);

    // 2) En cas d’erreur, on remet la combinaison dans la liste…
    validCombosFiltered.value.push(combo);
    showComboPopup.value = true; // …et on ré‑affiche la popup
  }
}

let endTrickInProgress = false;
async function tryEndTrick() {
  if (endTrickInProgress) return;
  if (room.value?.phase !== "play") return;
  if ((room.value.trick?.cards.length ?? 0) !== 2) return;

  endTrickInProgress = true;
  try {
    await endTrick();
  } catch (e) {
    if (e !== "Phase play requise") console.error(e);
  } finally {
    endTrickInProgress = false;
  }
}

/* ────────────── endTrick ───────────── */

async function endTrick() {
  if (!myUid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const d = snap.data() as RoomDoc;

    if (d.phase !== "play") throw "Phase play requise";
    if (d.trick.cards.length !== 2) throw "Pli incomplet";

    const [c1, c2] = d.trick.cards;
    const [p1, p2] = d.trick.players;
    const winnerUid = resolveTrick(c1, c2, p1, p2, d.trumpCard);
    const loserUid = winnerUid === p1 ? p2 : p1;

    /* ─── 1.  SCORING 10 / As ────────────────────────── */
    const scores = { ...(d.scores ?? {}) };
    const trickHas10orA = d.trick.cards.some(
      (c) => c.startsWith("10") || c.startsWith("A")
    );

    if (trickHas10orA) {
      scores[winnerUid] = (scores[winnerUid] ?? 0) + 10;
    }

    /* ─── 2.  Préparer l’update Firestore ─────────────── */
    const update: Partial<RoomDoc> & Record<string, any> = {
      phase: "meld", // vainqueur peut poser ses combos
      canMeld: winnerUid,
      currentTurn: winnerUid,
      drawQueue: [winnerUid, loserUid],
      scores, // ⬅️  nouveau total écrit ici
    };

    tx.update(roomRef, update);
  });
}

/* ────────────── forceEndMeldPhase ───────────── */

async function forceEndMeldPhase() {
  if (!myUid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const d = snap.data() as RoomDoc;

    // 1. On ne fait rien si on n’est plus en phase meld
    if (d.phase !== "meld") return;

    /* ------------------------------------------------------------------
       On détermine un vainqueur FIABLE : soit drawQueue[0], soit le
       currentTurn déjà présent dans le document (cas où drawQueue serait
       vide ou mal rempli).
    ------------------------------------------------------------------ */
    const queue = (d.drawQueue?.length ? d.drawQueue : []) as string[];
    const safeWinner = queue[0] ?? d.currentTurn;
    const safeLoser = d.players.find((u) => u !== safeWinner)!;

    /* ------------------------------------------------------------------
       Si la queue est vide, on la reconstitue ⇒ [vainqueur, perdant]
    ------------------------------------------------------------------ */
    const newQueue = queue.length ? queue : [safeWinner, safeLoser];

    /* ------------------------------------------------------------------
       Passage en phase draw + remise à zéro de la zone d’échange
    ------------------------------------------------------------------ */
    tx.update(roomRef, {
      phase: "draw",
      currentTurn: safeWinner, // ← la main reste au vainqueur
      drawQueue: newQueue,
      canMeld: null,
      trick: { cards: [], players: [] },
    });
  });
}

/* ────────────── resolveTrick (identique) ───────────── */
function resolveTrick(
  firstCard: string,
  secondCard: string,
  firstPlayerUid: string,
  secondPlayerUid: string,
  trumpCard: string
): string {
  const valueOf = (c: string) => {
    const v = c.slice(0, -1);
    return v === "A"
      ? 14
      : v === "K"
      ? 13
      : v === "Q"
      ? 12
      : v === "J"
      ? 11
      : v === "10"
      ? 10
      : parseInt(v);
  };
  const suitOf = (c: string) => c.slice(-1);
  const [s1, s2] = [suitOf(firstCard), suitOf(secondCard)];
  const [v1, v2] = [valueOf(firstCard), valueOf(secondCard)];
  const trump = suitOf(trumpCard);

  if (s1 === s2) return v2 > v1 ? secondPlayerUid : firstPlayerUid;
  if (s1 !== trump && s2 !== trump) return firstPlayerUid;
  if (s1 === trump && s2 !== trump) return firstPlayerUid;
  if (s1 !== trump && s2 === trump) return secondPlayerUid;
  return v2 > v1 ? secondPlayerUid : firstPlayerUid;
}

/* ──────── fonctions « jeu » ───────────────────────────────────────── */
/* appelé quand l’utilisateur valide une combinaison dans la popup */
async function handleComboPlayed(combo: Combination) {
  try {
    await playCombo(combo); // combo est bien défini ici
  } catch (e) {
    alert(e);
  }
}

/** Ne garde jamais plus de 2 exemplaires d’une même carte. */
function normalizeHand(cards: string[]): string[] {
  const res: string[] = [];
  const count: Record<string, number> = {};

  for (const c of cards) {
    count[c] = (count[c] ?? 0) + 1;
    if (count[c] <= 2) res.push(c); // max 2
  }
  return res;
}

async function drawCard() {
  if (!myUid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const d = snap.data() as RoomDoc;

    if (d.phase !== "draw" || d.drawQueue[0] !== myUid.value)
      throw "Pas votre tour de piocher";

    const deck = [...d.deck];
    const card = deck.shift()!;
    const queue = d.drawQueue.slice(1);

    let hand = [...d.hands[myUid.value], card];

    // Ramassage de la carte d’atout si c’est la dernière
    let trumpCardTaken = false;
    if (deck.length === 0 && d.trumpCard && !d.trumpTaken) {
      hand.push(d.trumpCard);
      trumpCardTaken = true;
    }

    const melds = d.melds?.[myUid.value] ?? [];

    // 🔐 Vérification complète sécurité
    checkHandAndMeld(hand, melds);

    const update: Record<string, any> = {
      deck,
      [`hands.${myUid.value}`]: hand,
      drawQueue: queue,
    };

    if (trumpCardTaken) {
      update.trumpTaken = true;
      update.trumpCard = "";
    }

    if (queue.length === 0) {
      update.phase = "play";
      update.trick = { cards: [], players: [] };
    }

    tx.update(roomRef, update);
  });
}

/** Ajoute `combo` ; si un meld contenant exactement les mêmes cartes existe
 *  déjà, on le remplace (évite le double comptage). */
function addOrReplaceMeld(
  melds: Combination[],
  combo: Combination
): Combination[] {
  const comboKey = combo.cards.map(cardToStr).sort().join(",");

  const filtered = melds.filter((m) => {
    const mKey = m.cards.map(cardToStr).sort().join(",");
    return mKey !== comboKey; // on garde tout sauf l’identique
  });

  return [...filtered, combo]; // ajoute (ou remplace) le meld
}

/** Ajoute `combo` ; si un meld composé
 *  *exactement* des mêmes cartes existe déjà, on le remplace. */
function mergeNewCombination(
  melds: Combination[],
  combo: Combination
): Combination[] {
  const key = (cards: Card[]) => cards.map(cardToStr).sort().join(",");

  const comboKey = key(combo.cards);

  // Conserve uniquement les melds « différents »
  const kept = melds.filter((m) => key(m.cards) !== comboKey);

  return [...kept, combo];
}

/** Contrôle les deux règles :
 *  1) jamais plus de 2 exemplaires identiques ;
 *  2) main + toutes les cartes (y compris doublons) posées ≤ 9. */
function checkHandAndMeld(hand: string[], melds: Combination[]) {
  const count: Record<string, number> = {};
  let total = hand.length; // cartes en main

  // main
  hand.forEach((s) => {
    count[s] = (count[s] ?? 0) + 1;
    if (count[s] > 2)
      throw "Règle : jamais plus de deux exemplaires identiques.";
  });

  // melds (chaque occurrence compte)
  melds.forEach((m) =>
    m.cards.forEach((c) => {
      const s = cardToStr(c);
      count[s] = (count[s] ?? 0) + 1;
      if (count[s] > 2)
        throw "Règle : jamais plus de deux exemplaires identiques.";
      total += 1;
    })
  );

  if (total > 9)
    throw "Règle : vous ne pouvez pas posséder plus de 9 cartes au total.";
}

function addCombination(
  melds: Combination[],
  combo: Combination
): Combination[] {
  return [...melds, combo]; // on empile simplement
}

/**
 * Ajoute une combinaison au meld du joueur.
 * - Retire les cartes de la main
 * - Ajoute le meld
 * - Met à jour le score
 * - Maintient canMeld tant qu’il reste ≥ 1 combo possible
 */
/* ───────── 1. playCombo (pose d’une combinaison) ───────── */
async function playCombo(combo: Combination) {
  const uid = myUid.value;
  if (!uid) return;

  await runTransaction(db, async (tx) => {
    const d = (await tx.get(roomRef)).data() as RoomDoc;
    if (d.canMeld !== uid) throw "Pas votre tour de meld";

    /* 1. Retirer de la main seulement les cartes qui y sont encore */
    const hand = [...d.hands[uid]];
    const meldCards = new Set(
      (d.melds?.[uid] ?? []).flatMap((m) => m.cards.map(cardToStr))
    );

    for (const c of combo.cards) {
      const s = cardToStr(c);
      if (hand.includes(s)) {
        hand.splice(hand.indexOf(s), 1);
      } else if (!meldCards.has(s)) {
        throw "Carte manquante : incohérence.";
      }
    }

    /* 2. Ajouter la nouvelle combinaison sans suppression */
    const melds = addCombination(d.melds?.[uid] ?? [], combo);

    /* 3. Vérifications globales */
    checkHandAndMeld(hand, melds);

    /* 4. Score : on AJOUTE toujours les points de la nouvelle combo */
    const newScore = (d.scores?.[uid] ?? 0) + combo.points;

    /* 5. Transition → draw */
    const opponent = d.players.find((u) => u !== uid)!;
    tx.update(roomRef, {
      [`hands.${uid}`]: hand,
      [`melds.${uid}`]: melds,
      [`scores.${uid}`]: newScore,
      phase: "draw",
      drawQueue: [uid, opponent],
      currentTurn: uid,
      canMeld: null,
      trick: { cards: [], players: [] },
    });
  });
}

/** Renvoie faux si main+meld dépassent 2 ex. d'une même carte. */
function checkDoubleDeckLimit(hand: string[], melds: Combination[]): boolean {
  const counts: Record<string, number> = {};

  // main
  hand.forEach((c) => {
    counts[c] = (counts[c] ?? 0) + 1;
  });

  // cartes déjà posées
  melds
    .flatMap((m) => m.cards.map(cardToStr))
    .forEach((c) => {
      counts[c] = (counts[c] ?? 0) + 1;
    });

  // on tolère max 2 (deux jeux)
  return Object.values(counts).every((n) => n <= 2);
}

export interface Card {
  rank: Rank;
  suit: Suit;
}
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

const order: Rank[] = ["7", "8", "9", "J", "Q", "K", "10", "A"];
const allSuits: Suit[] = ["♠", "♥", "♦", "♣"];

const isTrump = (card: Card, trump: Suit) => card.suit === trump;

function detectCombinations(
  hand: Card[],
  meld: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  const combos: Combination[] = [];

  // Toutes les cartes "connues" (main + meld)
  const all = [...hand, ...meld];

  // Map par rang, main seule et meld seule
  const byRankAll: Record<Rank, Card[]> = {
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    J: [],
    Q: [],
    K: [],
    A: [],
  };
  const byRankHand: Record<Rank, Card[]> = {
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    J: [],
    Q: [],
    K: [],
    A: [],
  };
  const byRankMeld: Record<Rank, Card[]> = {
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    J: [],
    Q: [],
    K: [],
    A: [],
  };
  console.log("Toutes les cartes reçues dans detectCombinations :", all);
  console.log("Toutes les cartes reçues dans detectCombinations :", hand);
  console.log("Toutes les cartes reçues dans detectCombinations :", meld);

  all.forEach((c) => byRankAll[c.rank].push(c));
  hand.forEach((c) => byRankHand[c.rank].push(c));
  meld.forEach((c) => byRankMeld[c.rank].push(c));

  // Map par couleur dans main et meld (utile pour mariage / suite)
  const bySuitHand: Record<Suit, Card[]> = {
    "♠": [],
    "♥": [],
    "♦": [],
    "♣": [],
  };
  const bySuitMeld: Record<Suit, Card[]> = {
    "♠": [],
    "♥": [],
    "♦": [],
    "♣": [],
  };
  hand.forEach((c) => bySuitHand[c.suit].push(c));
  meld.forEach((c) => bySuitMeld[c.suit].push(c));

  // Pour éviter doublons
  const toKey = (cs: Card[]) =>
    cs
      .map((c) => `${c.rank}${c.suit}`)
      .sort()
      .join("-");
  const already = new Set(existing.map((c) => toKey(c.cards)));
  const pushIfNew = (c: Combination) => {
    if (!already.has(toKey(c.cards))) combos.push(c);
  };

  /* -------- CARRES -------- */
  const fourMap = { A: 100, K: 80, Q: 60, J: 40 } as const;
  (["A", "K", "Q", "J"] as Rank[]).forEach((r) => {
    const totalCount = byRankAll[r].length; // cartes dans main + meld
    if (totalCount >= 4) {
      // On veut proposer le carré si on peut au moins en poser un nouveau avec la main

      // au moins 1 carte du rang dans meld
      const meldCount = byRankMeld[r].length;
      // au moins une carte dans la main pour compléter (différence au total)
      const handCount = byRankHand[r].length;

      // on ne propose que si la main apporte au moins une carte et il y a au moins une carte dans meld
      if (meldCount >= 1 && handCount >= 1) {
        // Construire le carré avec toutes cartes de la main + meld de ce rang (max 4)
        const cardsInCombo = [...byRankMeld[r], ...byRankHand[r]].slice(0, 4);
        pushIfNew({
          name: `4 ${r}`,
          points: fourMap[r],
          cards: cardsInCombo,
        });
      }
      // Sinon, si tout le carré est en main (pas posé avant), proposer aussi
      else if (meldCount === 0 && handCount >= 4) {
        const cardsInCombo = byRankHand[r].slice(0, 4);
        pushIfNew({
          name: `4 ${r}`,
          points: fourMap[r],
          cards: cardsInCombo,
        });
      }
    }
  });

  /* -------- MARIAGES -------- */
  allSuits.forEach((s) => {
    // Combinaisons déjà posées dans meld avec roi+reine ?
    const meldKing = bySuitMeld[s].find((c) => c.rank === "K");
    const meldQueen = bySuitMeld[s].find((c) => c.rank === "Q");

    // Pour savoir si mariage déjà posé dans meld
    const mariagePosed = meldKing && meldQueen;

    // Cherche roi et reine dans main (hors meld)
    const handKing = bySuitHand[s].find((c) => c.rank === "K");
    const handQueen = bySuitHand[s].find((c) => c.rank === "Q");

    // Mariage déjà posé ? Si non, on peut proposer mariage en main (ou main+meld)
    if (!mariagePosed) {
      // mariage complet dans main uniquement
      if (handKing && handQueen) {
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Mariage ${s}${atout}`,
          points: s === trump ? 40 : 20,
          cards: [handKing, handQueen],
        });
      }
      // mariage avec roi dans meld + reine dans main
      else if (meldKing && handQueen) {
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Mariage ${s}${atout}`,
          points: s === trump ? 40 : 20,
          cards: [meldKing, handQueen],
        });
      }
      // mariage avec reine dans meld + roi dans main
      else if (meldQueen && handKing) {
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Mariage ${s}${atout}`,
          points: s === trump ? 40 : 20,
          cards: [meldQueen, handKing],
        });
      }
    }
    // Si mariage posé dans meld, on peut proposer la suite si main contient les cartes suivantes
    if (mariagePosed) {
      // Suite = J, Q, K, 10, A (mais roi et reine déjà posés)
      // On vérifie si on a J, 10, A dans la main de la même couleur
      const neededRanks: Rank[] = ["J", "10", "A"];
      const hasNeeded = neededRanks.every((r) =>
        bySuitHand[s].some((c) => c.rank === r)
      );
      if (hasNeeded) {
        // On prend les cartes roi+reine du meld + les cartes J,10,A de la main
        const cardsSuite = [
          meldQueen!,
          meldKing!,
          ...neededRanks.map((r) => bySuitHand[s].find((c) => c.rank === r)!),
        ];
        const atout = s === trump ? " d’atout" : "";
        pushIfNew({
          name: `Suite ${s}${atout}`,
          points: s === trump ? 250 : 150,
          cards: cardsSuite,
        });
      }
    }
  });

  /* -------- DAME♠ + VALET♦ -------- */
  const qs = all.filter((c) => c.rank === "Q" && c.suit === "♠");
  const jd = all.filter((c) => c.rank === "J" && c.suit === "♦");
  const pairs = Math.min(qs.length, jd.length);
  if (pairs >= 1)
    pushIfNew({ name: "Dame♠+Valet♦", points: 40, cards: [qs[0], jd[0]] });
  if (pairs >= 2)
    pushIfNew({
      name: "2×(Dame♠+Valet♦)",
      points: 500,
      cards: [qs[0], jd[0], qs[1], jd[1]],
    });

  return combos;
}

/* ──────── helpers ──────────────────────────────────────────────── */

const strToCard = (s: string): Card => ({
  rank: s.slice(0, -1) as Rank,
  suit: s.slice(-1) as Suit,
});
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
