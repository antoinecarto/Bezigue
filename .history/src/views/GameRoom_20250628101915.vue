<template>
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
      <div
        class="scoreboard flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48"
      >
        <h3 class="text-lg font-semibold mb-4">Partie</h3>
        <div class="text-xl font-bold text-green-700 mb-2">
          Vainqueur : Odile
        </div>
        <div class="text-xl font-bold text-red-700">Partie en : 2000 pts</div>
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
              @click="playCardFromMeldWrapper(c)"
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
              class="card border px-3 py-2 rounded shadow text-xl cursor-pointer"
              :class="getCardColor(card)"
              @click="handleCardClick(card)"
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
      v-if="show"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="$emit('close')"
      role="dialog"
      aria-modal="true"
    >
      <div class="bg-white p-6 rounded-2xl w-72">
        <h2 class="text-lg font-semibold mb-4 text-center">
          Échanger le 7 d’atout ?
        </h2>

        <p class="text-center mb-4">
          Vous pouvez prendre <strong>{{ trumpCard }}</strong> et placer votre
          <strong>7{{ suit }}</strong> face visible.
        </p>

        <div class="flex gap-3">
          <button class="flex-1 btn" @click="$emit('confirm')">Oui</button>
          <button class="flex-1 btn" @click="$emit('close')">Non</button>
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
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import Draggable from "vuedraggable";

import { db } from "@/firebase";

/* ────────────── Types ───────────────────────────────── */
export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export interface Card {
  rank: Rank;
  suit: Suit;
}
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

interface RoomDoc {
  players: string[];
  playerNames: Record<string, string>;
  phase: "play" | "draw" | "meld";
  currentTurn: string;
  drawQueue: string[];
  trumpCard: string;
  deck: string[];
  hands: Record<string, string[]>;
  melds: Record<string, Combination[]>;
  canMeld: string | null;
  trick: { cards: string[]; players: string[] };
  scores: Record<string, number>;
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
const showComboPopup = ref(false);
const validCombosFiltered = ref<Combination[]>([]);
const showTurnAlert = ref(false);
/* ─── ID du timer qui déclenchera la résolution du pli ─── */
let trickResolutionTimeout: ReturnType<typeof setTimeout> | null = null;
/* ────────────── Computed Shortcuts ───────────────────── */
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

/* ────────────── Firestore subscription ─────────────── */
function subscribeRoom() {
  return onSnapshot(roomRef, (snap) => {
    loading.value = false;
    if (!snap.exists()) {
      room.value = null;
      return;
    }

    room.value = snap.data() as RoomDoc;
    if (myUid.value) localHand.value = room.value.hands?.[myUid.value] ?? [];

    /* Popup nom (inchangé) */
    showNameModal.value =
      !!myUid.value && !room.value.playerNames?.[myUid.value];

    /* ─── Pli complet ? ─── */
    if (room.value.phase === "play" && room.value.trick.cards.length === 2) {
      // Si on n’a pas déjà programmé la résolution, on lance un timer
      if (!trickResolutionTimeout) {
        trickResolutionTimeout = setTimeout(async () => {
          try {
            await endTrick();
          } finally {
            trickResolutionTimeout = null;
          }
        }, 1000); // 1000 ms ≈ 1 seconde de pause visuelle
      }
    } else {
      // Le pli est redevenu incomplet avant la fin du timer ─> on annule
      if (trickResolutionTimeout) {
        clearTimeout(trickResolutionTimeout);
        trickResolutionTimeout = null;
      }
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
    if (trickResolutionTimeout) {
      clearTimeout(trickResolutionTimeout);
      trickResolutionTimeout = null;
    }
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

/* ─── Auto‑pioche ────────────────────────────────────────── */
const drawingNow = ref(false); // évite les appels concurrents

watchEffect(() => {
  const r = room.value;
  if (
    r &&
    r.phase === "draw" && // on est bien en phase pioche
    r.drawQueue?.[0] === myUid.value // c'est MON tour de piocher
  ) {
    // On attend un mini‑délai pour laisser l’UI respirer
    if (!drawingNow.value) {
      drawingNow.value = true;
      setTimeout(() => {
        drawCard()
          .catch(console.error)
          .finally(() => {
            drawingNow.value = false;
          });
      }, 80); // 80 ms ≈ le temps d’un tick de rendu
    }
  }
  loading.value === false;
});

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
/* ────────────── Wrapper clic carte ────────────── */
async function handleCardClick(card: string) {
  try {
    await playCard(card); // ← transaction Firestore
  } catch (e) {
    // selon ton backend la chaîne peut contenir un espace/point/etc.
    // adapte au besoin (startsWith, includes, etc.)
    if (e === "Pas votre tour") {
      showTurnAlert.value = true; // ouvre la pop‑up
    } else {
      console.error(e);
      alert(e); // autre erreur inattendue
    }
  }
}

//* ────────────── Game Actions (simplifiées) ─────────── */
async function playCard(card: string) {
  if (!myUid.value) return;

  await runTransaction(db, async (tx) => {
    /* 0. Lecture du snapshot */
    const snap = await tx.get(roomRef);
    const d = snap.data() as RoomDoc;

    /* 1. Vérifications */
    if (d.phase !== "play") throw "Ce n'est pas votre tour ! ";
    if (d.currentTurn !== myUid.value) throw "Pas votre tour";
    if (d.trick.cards.length >= 2) throw "Pli déjà complet";

    /* 2. Retirer la carte de la main */
    const hand = [...d.hands[myUid.value]];
    const idx = hand.indexOf(card);
    if (idx === -1) throw "Carte absente";
    hand.splice(idx, 1);

    /* 3. Ajouter la carte au pli */
    const trick = { ...d.trick };
    trick.cards.push(card);
    trick.players.push(myUid.value);

    /* 4. Préparer la mise à jour Firestore */
    const update: Partial<RoomDoc> & Record<string, any> = {
      [`hands.${myUid.value}`]: hand,
      trick,
    };

    /* 5. S'il n'y a qu'UNE seule carte, on passe le tour à l'adversaire */
    if (trick.cards.length === 1) {
      const next = d.players.find((u) => u !== myUid.value);
      if (next) update.currentTurn = next;
    }

    /* 6. Écriture atomique */
    tx.update(roomRef, update);
  });
}

function playCardFromMeldWrapper(c: Card) {
  playCard(cardToStr(c));
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

function choose(combo: Combination) {
  // Placeholder : fermer la popup pour l'instant
  showComboPopup.value = false;
}

/* ────────────── startMeldTimeout ───────────── */

async function endTrick() {
  if (!myUid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const d = snap.data() as RoomDoc;

    if (d.phase !== "play") throw "Phase play requise";
    if (d.trick.cards.length !== 2) throw "Pli incomplet";

    const [c1, c2] = d.trick.cards;
    const [p1, p2] = d.trick.players;
    const winner = resolveTrick(c1, c2, p1, p2, d.trumpCard);
    const loser = winner === p1 ? p2 : p1;

    // PAS direct à draw, mais à meld pour que vainqueur pose ses combinaisons
    const update: Partial<RoomDoc> & Record<string, any> = {
      phase: "meld",
      canMeld: winner,
      currentTurn: winner,
      trick: { cards: [], players: [] },
      // conserve le drawQueue pour la suite, ou initialiser si besoin
      drawQueue: [winner, loser],
    };

    tx.update(roomRef, update);
  });

  // Démarre un timeout côté client qui forcera la fin de la phase meld
  startMeldTimeout();
}

let meldTimeout: ReturnType<typeof setTimeout> | null = null;

/* ────────────── startMeldTimeout ───────────── */

function startMeldTimeout() {
  if (meldTimeout) clearTimeout(meldTimeout);
  meldTimeout = setTimeout(() => {
    forceEndMeldPhase();
  }, 10000); // 10 secondes par exemple
}

async function forceEndMeldPhase() {
  if (!myUid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const d = snap.data() as RoomDoc;

    if (d.phase !== "meld") return; // plus en phase meld, on fait rien

    // On passe à la phase draw
    const [winner, loser] = d.drawQueue;
    const update: Partial<RoomDoc> = {
      phase: "draw",
      currentTurn: winner,
      canMeld: null,
      // drawQueue pourrait rester identique ou être réinitialisée après la pioche
    };

    tx.update(roomRef, update);
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
/* appelé quand on pioche */

async function drawCard() {
  if (!myUid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const d = snap.data() as RoomDoc;
    if (d.phase !== "draw" || d.drawQueue[0] !== myUid.value)
      throw "Pas votre tour de piocher";

    const deck = [...d.deck];
    if (!deck.length) return;
    const card = deck.shift()!;

    const hand = [...d.hands[myUid.value], card];
    const queue = d.drawQueue.slice(1);

    const update: Partial<RoomDoc> & Record<string, any> = {
      deck,
      [`hands.${myUid.value}`]: hand,
      drawQueue: queue,
    };

    if (queue.length === 0) {
      update.phase = "play";
      update.canMeld = d.drawQueue[0]; // le vainqueur reprend la main
      update.trick = { cards: [], players: [] };
    }

    tx.update(roomRef, update);
  });
}

/**
 * Ajoute une combinaison au meld du joueur.
 * - Retire les cartes de la main
 * - Ajoute le meld
 * - Met à jour le score
 * - Maintient canMeld tant qu’il reste ≥ 1 combo possible
 */
async function playCombo(combo: Combination) {
  if (!myUid.value) return;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room inexistante";
    const d = snap.data() as any;

    if (d.canMeld !== myUid.value) throw "Pas votre tour de meld";

    /* 1. Retirer cartes de la main */
    const hand = [...d.hands[myUid.value]];
    for (const c of combo.cards) {
      const i = hand.indexOf(cardToStr(c));
      if (i === -1) throw "Carte manquante";
      hand.splice(i, 1);
    }

    /* 2. Ajouter la combinaison */
    const melds = [...(d.melds?.[myUid.value] ?? []), combo];

    /* 3. Mise à jour du score, etc. (optionnel) */

    /* 4. Reste-t-il des combinaisons après ce meld ? */
    const stillCombos =
      detectCombinations(
        [...hand.map(strToCard), ...melds.flatMap((m) => m.cards)],
        d.trump.slice(-1) as Suit,
        melds
      ).length > 0;

    /* 5. Préparer update */
    const update: any = {
      [`hands.${myUid.value}`]: hand,
      [`melds.${myUid.value}`]: melds,
      canMeld: stillCombos ? myUid.value : null, // 👈 clé !
    };
    /* 6. Si plus de combos possibles → retour en phase play */
    if (!stillCombos) {
      if (!stillCombos) {
        update.phase = "draw";
        update.drawQueue = [myUid.value, opponentUid.value];
        update.currentTurn = myUid.value;
      }

      // le vainqueur du pli garde la main (déjà dans currentTurn)
    }

    tx.update(roomRef, update);
  });
}

/*---------------------------------DETECTION----------------------------*/
/* -------- types -------- */
export interface Card {
  rank: Rank;
  suit: Suit;
}
export interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/* -------- aide -------- */
const order: Rank[] = ["7", "8", "9", "J", "Q", "K", "10", "A"];
const isTrump = (card: Card, trump: Suit) => card.suit === trump;

/* -------- détection -------- */
function detectCombinations(
  all: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  const combos: Combination[] = [];
  const byRank: Record<Rank, Card[]> = {
    "7": [],
    "8": [],
    "9": [],
    "10": [],
    J: [],
    Q: [],
    K: [],
    A: [],
  };
  all.forEach((c) => byRank[c.rank].push(c));

  const toKey = (cs: Card[]) =>
    cs
      .map((c) => `${c.rank}${c.suit}`)
      .sort()
      .join("-");
  const already = new Set(existing.map((c) => toKey(c.cards)));
  const pushIfNew = (c: Combination) => {
    if (!already.has(toKey(c.cards))) combos.push(c);
  };

  /* 4-as / 4-rois / … */
  const fourMap = { A: 100, K: 80, Q: 60, J: 40 } as const;
  (["A", "K", "Q", "J"] as Rank[]).forEach((r) => {
    if (byRank[r].length >= 4)
      pushIfNew({
        name: `4 ${r}`,
        points: fourMap[r],
        cards: byRank[r].slice(0, 4),
      });
  });

  /* mariages */
  ["♠", "♥", "♦", "♣"].forEach((s) => {
    const king = all.find((c) => c.rank === "K" && c.suit === s);
    const queen = all.find((c) => c.rank === "Q" && c.suit === s);
    if (king && queen) {
      const atout = s === trump ? " d’atout" : "";
      pushIfNew({
        name: `Mariage ${s}${atout}`,
        points: s === trump ? 40 : 20,
        cards: [king, queen],
      });
    }
  });

  /* suites */
  ["♠", "♥", "♦", "♣"].forEach((s) => {
    const suite = ["J", "Q", "K", "10", "A"].map((r) =>
      all.find((c) => c.rank === r && c.suit === s)
    );
    if (suite.every(Boolean)) {
      const atout = s === trump ? " d’atout" : "";
      pushIfNew({
        name: `Suite ${s}${atout}`,
        points: s === trump ? 250 : 150,
        cards: suite as Card[],
      });
    }
  });

  /* Dame♠ + Valet♦ */
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
