<template>
  <!-- ---------------- PHASE D'ATTENTE ------------------ -->
  <div v-if="room?.phase === 'waiting'" class="text-center mt-8">
    <p class="text-xl">En attente dʼun adversaire…</p>
  </div>

  <!-- ---------------- MODAL COMBINAISONS ------------------ -->
  <!-- <teleport to="body">
    <ComboModal
      v-if="showComboPopup"
      :combos="validCombosFiltered"
      @combo-played="handleComboPlayed"
      @close="showComboPopup = false"
    />
  </teleport> -->

  <div class="game-room text-center p-4">
    <div v-if="loading">Chargement de la partie...</div>
    <div v-else-if="!room">Partie introuvable ou supprimée.</div>

    <!-- ================= MAIN ADVERSE ================= -->
    <div v-if="opponentHand.length" class="player-hand mt-6">
      <h3
        class="text-xl font-semibold mb-2"
        :class="{ 'text-green-600': room?.currentTurn === opponentUid }"
      >
        Main {{ deOuD(opponentName) }} {{ opponentName }}
      </h3>

      <!-- Affichage des dos de cartes -->
      <div class="cards flex gap-2 justify-center flex-wrap">
        <PlayingCard
          v-for="c in opponentHand"
          key="'opp' + c.rank + c.suit"
          code="back"
          :width="60"
          :height="90"
        />
      </div>

      <!-- ------------ COMBINAISONS ADVERSES ------------- -->
      <div class="drop-zone mt-4">
        <p class="text-xs font-semibold mb-1">Combinaisons adverses</p>
        <div
          v-if="opponentMelds.length"
          class="flex flex-wrap gap-2 justify-center"
        >
          <template v-for="(meld, i) in opponentMelds" :key="'oppmeld-' + i">
            <PlayingCard
              v-for="c in meld.cards"
              :key="'opp' + c.rank + c.suit"
              :code="cardToStr(c)"
              :width="60"
              :height="90"
            />
          </template>
        </div>
        <span v-else class="text-[10px] italic text-gray-400">Aucune</span>
      </div>
    </div>

    <!-- ================= TABLEAU DE BORD ================= -->
    <div class="mt-12 flex justify-center gap-8">
      <!-- Partie -->
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

      <!-- Score -->
      <div
        class="scoreboard flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48"
      >
        <h3 class="text-lg font-semibold mb-4">Score</h3>
        <div
          class="text-xl font-bold"
          v-text="playerName + ' : ' + playerScore"
        />
        <div
          class="text-xl font-bold"
          v-text="opponentName + ' : ' + opponentScore"
        />
      </div>

      <!-- ----------- ZONE D'ÉCHANGE & ATOUT ------------- -->
      <div
        class="flex gap-8 bg-green-100 border-4 border-green-600 rounded-xl p-6 shadow-lg w-full max-w-4xl"
      >
        <!-- Zone d'échange -->
        <div class="flex-grow">
          <h3 class="text-lg font-semibold text-green-800 mb-2 text-center">
            Zone d'échange
          </h3>
          <div
            class="battle-drop-zone h-32 border-2 border-dashed border-green-400 rounded bg-green-50 p-4 flex items-center gap-4 overflow-x-auto"
          >
            <PlayingCard
              v-for="(c, i) in battleZoneCards"
              :key="'battle-' + i"
              :code="c"
              :width="60"
              :height="90"
            />
          </div>
        </div>

        <!-- Atout + pioche -->
        <div class="flex flex-col items-center">
          <div class="text-sm text-gray-600 mb-1">Atout</div>
          <PlayingCard
            :code="trumpCard"
            :width="60"
            :height="90"
            class="border-2 border-green-700 rounded shadow mb-2"
          />
          <div class="text-gray-700 text-sm italic text-center">
            {{ deckCards.length }} carte<span v-if="deckCards.length > 1"
              >s</span
            >
            restantes
          </div>
        </div>
      </div>
    </div>

    <!-- ================ MAIN DU JOUEUR ================= -->
    <div v-if="localHand.length" class="player-hand mt-8">
      <!-- Combinaisons du joueur -->
      <div
        class="drop-zone mt-4 p-4 border-2 border-dashed border-gray-400 rounded bg-gray-50"
      >
        <p class="text-xs font-semibold mb-1">Vos combinaisons</p>
        <div
          v-if="playerMelds.length"
          class="flex flex-wrap gap-2 justify-center"
        >
          <template
            v-for="(meld, mIndex) in playerMelds"
            :key="'meld-' + mIndex"
          >
            <PlayingCard
              v-for="c in meld.cards.filter(
                (c) => c !== undefined && c !== null
              )"
              :key="'opp' + c.rank + c.suit"
              :code="cardToStr(c)"
              :width="60"
              :height="90"
            />
          </template>
        </div>
        <span v-else class="text-[10px] italic text-gray-400">Aucune</span>
      </div>

      <!-- Main du joueur -->
      <div class="mt-4">
        <draggable
          v-model="localHand"
          @end="onHandReorder"
          class="cards flex gap-2 justify-center flex-wrap"
          :item-key="cardToStr"
        >
          <template #item="{ element: card }">
            <PlayingCard
              :code="card"
              :key="cardToStr(card)"
              :width="60"
              :height="90"
              @click="playCardFromHand(card)"
            />
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
  <!-- CHAT -->
  <div
    class="chat-container mt-8 max-w-2xl mx-auto text-left p-4 border rounded shadow bg-white"
  >
    <h3 class="text-lg font-semibold mb-2">Discussion</h3>

    <div
      class="messages max-h-64 overflow-y-auto border p-2 rounded mb-4"
      style="background: #f9f9f9"
    >
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="mb-2"
        :class="{ 'text-right': msg.senderId === myUid }"
      >
        <div
          class="inline-block p-2 rounded"
          :class="msg.senderId === myUid ? 'bg-green-200' : 'bg-gray-200'"
        >
          <strong>{{ msg.playerName || msg.senderId || "Anonyme" }} :</strong>
          <span>{{ msg.text }}</span
          ><br />
          <small class="text-xs text-gray-500">
            {{ msg.createdAt ? formatDate(msg.createdAt) : "" }}
          </small>
        </div>
      </div>
    </div>

    <div class="flex gap-2">
      <input
        v-model="newMessage"
        type="text"
        placeholder="Écrire un message..."
        class="flex-grow border rounded px-3 py-2"
        @keyup.enter="sendMessage"
      />
      <button
        @click="sendMessage"
        class="btn btn-primary px-4 py-2 rounded"
        :disabled="newMessage.trim() === ''"
      >
        Envoyer
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
/* ────────────── Imports ─────────────────────────────── */
import { ref, computed, watch, onMounted, onUnmounted, watchEffect } from "vue";
import { useRoute } from "vue-router";
import type {
  Timestamp,
  DocumentData,
  Unsubscribe,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
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
import draggable from "vuedraggable";
import type { Suit } from "@/game/types/Card";
import { Card, serializeMelds } from "@/game/types/Card";
import PlayingCard from "@/components/PlayingCard.vue";
import { detectCombinations } from "@/game/types/detectCombinations";
import type { Combination } from "@/game/types/detectCombinations";
import {
  QuerySnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
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
const cardToStr = (c: Card | string | undefined | null) => {
  if (!c) return ""; // retourne chaîne vide si c est null/undefined
  return typeof c === "string" ? c : `${c.rank}${c.suit}`;
};
/* ────────────── Reactive State ───────────────────────── */
const route = useRoute();
const roomId = route.params.roomId as string;
const roomRef = doc(db, "rooms", roomId);

const myUid = ref<string | null>(null);
const room = ref<RoomDoc | null>(null);
const loading = ref(true);
const localHand = ref<string[]>([]);

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

///CCHAT §§§§§

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp | null; // le timestamp Firestore peut être null au début
}

const auth = getAuth();

let unsubscribe: (() => void) | null = null; // stocke la fonction d'arrêt d'écoute
// Valeurs réactives
const messages = ref<
  Array<{ id: string; text: string; senderId: string; createdAt: any }>
>([]);
const newMessage = ref("");

// Récupère le roomId de façon réactive via un getter
const getRoomId = () => route.params.roomId as string;

// Ecoute les changements de roomId

watch(
  getRoomId,
  (roomId) => {
    // Si une écoute précédente existe, on la stoppe
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    if (!roomId) {
      messages.value = [];
      return;
    }

    const messagesRef = collection(db, "rooms", roomId, "messages");
    const q = query(messagesRef, orderBy("createdAt"));

    // Nouvelle écoute Firestore
    unsubscribe = onSnapshot(q, (snapshot) => {
      messages.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
    });
  },
  { immediate: true }
);
const messagesCollection = collection(db, "rooms", roomId, "messages");

// Définition explicite du type de la query
const q = query(messagesCollection, orderBy("createdAt", "asc"));

async function sendMessage() {
  const roomId = getRoomId();
  if (!roomId || !newMessage.value.trim()) return;

  const messagesRef = collection(db, "rooms", roomId, "messages");

  await addDoc(messagesRef, {
    text: newMessage.value.trim(),
    senderId: myUid.value, // ✅ CORRIGÉ ICI
    createdAt: serverTimestamp(),
  });

  newMessage.value = "";
}

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

// Formatter date lisible
function formatDate(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
  messages.value = snapshot.docs.map(
    (doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text as string,
        senderId: data.senderId as string,
        createdAt: data.createdAt ? (data.createdAt as Timestamp) : null,
      };
    }
  );
});

///

/* ────────────── Watchers ─────────────────────────────── */
watchEffect(() => console.log("localHand : ", localHand.value));
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
/* ───────── WATCHER popup Combinaisons ───────── */

watchEffect(() => {
  const r = room.value;
  const uid = myUid.value;

  /* 0. sécurité */
  if (!r || !uid) return;

  /* 1. situations où l’on NE doit PAS rouvrir la popup --------- */
  if (
    showComboPopup.value || // déjà ouverte
    askedCombiThisTrick.value || // déjà calculé ce pli
    showExchange.value || // popup « 7 » prioritaire
    (asked7ThisTrick.value && !exchangeDone.value)
  ) {
    return;
  }

  /* 2. phase + droit de meld */
  if (r.phase !== "meld" || r.canMeld !== uid) return;

  /* 3. conversion main (string[] ➜ Card[]) + cartes déjà posées */
  const handCards: Card[] = r.hands[uid].map((code) => Card.fromCode(code));

  const meldCards: Card[] = (r.melds?.[uid] ?? []).flatMap((m) => m.cards);

  /* 4. détection des combinaisons */
  const combos = detectCombinations(handCards, meldCards, r.trumpSuit);

  /* 5. résultat */
  if (combos.length) {
    validCombosFiltered.value = combos;
    showComboPopup.value = true; // on attend le choix utilisateur
  } else {
    // aucune combinaison possible ➜ on force la fin de la phase meld
    forceEndMeldPhase().catch(console.error);
  }

  /* 6. flag pour ne pas recalculer pendant ce pli */
  askedCombiThisTrick.value = true;
});

/*------------------------------------------------------------------------------------------------------*/
/*----------------------------------------- Démarrage du jeu -------------------------------------------*/
/*------------------------------------------------------------------------------------------------------*/

function maybeStartGame(tx: Transaction, d: RoomDoc) {
  if (d.phase !== "waiting") return;
  if (d.players.length !== 2) return;

  const host = d.players[0];
  const guest = d.players.find((u) => u !== host)!;

  const fullDeck = generateShuffledDeck();
  const distrib = distributeCards(fullDeck);

  // Validation de distrib.trumpCard
  if (!distrib.trumpCard) {
    throw new Error("distrib.trumpCard is undefined");
  }

  const hands: Record<string, string[]> = {
    [host]: distrib.hands.player1.map((card) => card.toString()),
    [guest]: distrib.hands.player2.map((card) => card.toString()),
  };

  // Debug console
  console.log("Starting game with hands:", hands);
  console.log("Trump card:", distrib.trumpCard.toString());

  tx.set(
    roomRef,
    {
      phase: "play",
      currentTurn: host,
      deck: distrib.drawPile.map((card) => card.toString()),
      trumpCard: distrib.trumpCard.toString(),
      trumpTaken: false,
      trumpSuit: distrib.trumpCard.toString().slice(-1) as Suit,
      hands,
      melds: {},
      trick: { cards: [], players: [] },
      drawQueue: [],
    },
    { merge: true }
  );
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

/* Helper commun : pousse la carte dans le pli, met à jour hand+melds */
function pushCardToTrick(
  tx: Transaction,
  d: RoomDoc,
  cardStr: string,
  newHand: string[],
  newMelds: Combination[] = d.melds?.[myUid.value] ?? []
) {
  const uid = String(myUid.value);
  const trick = { ...d.trick };
  trick.cards.push(cardStr);
  trick.players.push(myUid.value!);

  const update: Record<string, any> = {
    [`hands.${uid}`]: newHand,
    [`melds.${uid}`]: serializeMelds(newMelds),
    trick,
  };

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
  c1: string,
  c2: string,
  p1: string,
  p2: string,
  trumpCard: string
): string {
  const rankValue = (s: string) => {
    const r = s.slice(0, -1);
    return r === "A"
      ? 14
      : r === "K"
      ? 13
      : r === "Q"
      ? 12
      : r === "J"
      ? 11
      : r === "10"
      ? 10
      : parseInt(r);
  };

  const suit = (s: string) => s.slice(-1);
  const [s1, s2] = [suit(c1), suit(c2)];
  const [v1, v2] = [rankValue(c1), rankValue(c2)];
  const trump = suit(trumpCard);

  /* 1. Couleur identique (y compris double atout) */
  if (s1 === s2) {
    if (v2 > v1) return p2;
    if (v2 < v1) return p1;
    /* égalité → la carte posée **en premier** gagne */
    return p1;
  }

  /* 2. Aucune carte atout ─► couleur demandée gagne (premier joueur)  */
  if (s1 !== trump && s2 !== trump) return p1;

  /* 3. Première carte atout → première gagne  */
  if (s1 === trump && s2 !== trump) return p1;

  /* 4. Seconde carte atout → seconde gagne  */
  if (s1 !== trump && s2 === trump) return p2;

  /* 5. Dernier filet de sécurité (ne devrait plus arriver) */
  return p1;
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
    /* 4. Score : on AJOUTE toujours les points de la nouvelle combo */
    const newScore = (d.scores?.[uid] ?? 0) + combo.points;

    /* 5. Transition → draw */
    const opponent = d.players.find((u) => u !== uid)!;
    tx.update(roomRef, {
      [`hands.${uid}`]: hand,
      [`melds.${uid}`]: serializeMelds(melds), // ✅ string[]
      [`scores.${uid}`]: newScore,
      phase: "draw",
      drawQueue: [uid, opponent],
      currentTurn: uid,
      canMeld: null,
      trick: { cards: [], players: [] },
    });
  });
}

/* ──────── helpers ──────────────────────────────────────────────── */
const strToCard = (s: string): Card => Card.fromCode(s);
</script>

<style scoped>
.card {
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  user-select: none;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  display: block;
  max-width: none; /* important */
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
  min-width: 60px; /* ou une valeur adaptée */
  min-height: 80px; /* au moins la hauteur d’une carte */
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  overflow-x: auto; /* si tu veux un scroll horizontal */
}
</style>
