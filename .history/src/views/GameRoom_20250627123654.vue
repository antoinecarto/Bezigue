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

    <div v-else-if="!roomData">Partie introuvable ou supprimée.</div>

    <!-- MAIN DE L’ADVERSAIRE (retournée) -->
    <div v-if="opponentHand.length" class="player-hand mt-6">
      <h3
        class="text-xl font-semibold mb-2"
        :class="{ 'text-green-600': currentTurn === opponentUid }"
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
          item-key="element"
        >
          <template #item="{ element: card }">
            <div
              class="card border px-3 py-2 rounded shadow text-xl cursor-pointer"
              :class="getCardColor(card)"
              @click="playCard(card)"
            >
              {{ card }}
            </div>
          </template>
        </draggable>
      </div>
      <h3
        class="text-xl font-semibold mb-2"
        :class="{ 'text-green-600': currentTurn === uid }"
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
          @click="$emit('combo-played', c)"
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
</template>

///
<script setup lang="ts">
/* ──────── imports ───────────────────────────────────────────────── */
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import draggable from "vuedraggable";

import { db } from "@/firebase";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

/* ──────── types ────────────────────────────────────────────────── */
type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
interface Card {
  rank: Rank;
  suit: Suit;
}
interface Combination {
  name: string;
  points: number;
  cards: Card[];
}

/* ──────── helpers ──────────────────────────────────────────────── */
const cardToStr = (c: Card | string) =>
  typeof c === "string" ? c : `${c.rank}${c.suit}`;
const strToCard = (s: string): Card => ({
  rank: s.slice(0, -1) as Rank,
  suit: s.slice(-1) as Suit,
});

/* (règles du pli, détection de combinaisons, échange de 7, etc.)  */
/*  👉 inchangées : je les garde telles quelles sous le pli pour alléger */
/*  ------------------------------------------------------------------ */

/* ──────── réactifs globaux ──────────────────────────────────────── */
const route = useRoute();
const roomId = route.params.roomId as string;
const roomRef = doc(db, "rooms", roomId);

const roomData = ref<any>(null);
const loading = ref(true);
const uid = ref<string | null>(null);

const showComboPopup = ref(false);
const validCombos = ref<Combination[]>([]); // toutes les combos trouvées
const localHand = ref<string[]>([]); // copie locale modifiable

const battleZoneCards = ref<string[]>([]); // cartes du pli (affichage)
let unsubscribeMene: (() => void) | null = null;

const showNameModal = ref(false);
const nameInput = ref("");

/* noms courants --------------------------------------------- */
const playerName = computed(
  () => roomData.value?.playerNames?.[uid.value ?? ""] || "Joueur"
);

const opponentName = computed(() =>
  opponentUid.value
    ? roomData.value?.playerNames?.[opponentUid.value] || "Adversaire"
    : "Adversaire"
);
/*---------------- Popup pour échanger le 7 d'atout------------*/
defineProps<{ show: boolean; trumpCard: string }>();

/* 2. S’en servir correctement */
const rank = computed(() => trumpCard.value.slice(0, -1)); // 'A', 'K', …
const suit = computed(() => trumpCard.value.slice(-1) as Suit);

/* ──────── dérivés ──────────────────────────────────────────────── */
const currentMeneId = computed(() => roomData.value?.currentMeneId ?? 0);
const opponentUid = computed(() =>
  roomData.value?.hands
    ? Object.keys(roomData.value.hands).find((k) => k !== uid.value)
    : null
);

const playerMelds = computed<Combination[]>(
  () => roomData.value?.melds?.[uid.value ?? ""] ?? []
);
const playerMeldCards = computed<Card[]>(() =>
  playerMelds.value.flatMap((c) => c.cards)
);
const opponentMelds = computed<Combination[]>(() =>
  opponentUid.value ? roomData.value?.melds?.[opponentUid.value] ?? [] : []
);

const currentTurn = computed<string | null>(
  () => roomData.value?.currentTurn ?? null
);
const trumpCard = computed(() => roomData.value?.trumpCard ?? "—");
const canMeld = computed(() => roomData.value?.canMeld ?? null);

const deckCards = computed(() => roomData.value?.deck ?? []);
const playerScore = computed(
  () => roomData.value?.scores?.[uid.value ?? ""] ?? 0
);
const opponentScore = computed(() =>
  opponentUid.value ? roomData.value?.scores?.[opponentUid.value] ?? 0 : 0
);
const opponentHand = computed<string[]>(() =>
  opponentUid.value ? roomData.value?.hands?.[opponentUid.value] ?? [] : []
);

/* Props : un tableau de combinaisons */
defineProps<{ combos: Combination[] }>();

/* Événements que le composant émet */
const emit = defineEmits<{
  (e: "combo-played", combo: Combination): void;
  (e: "close"): void;
}>();

/* Fonction appelée quand l'utilisateur clique sur une combinaison */
function choose(combo: Combination) {
  emit("combo-played", combo); // envoie l'objet combo au parent
}

/* combos encore disponibles (pas déjà posées) */
const validCombosFiltered = computed(() => {
  const played = playerMelds.value.map((c) => c.name);
  return validCombos.value.filter((c) => !played.includes(c.name));
});

const tableIsClear = computed(
  () => battleZoneCards.value.length === 0 // côté front
  // ou currentPliCards.value.length === 0          // si tu relies au doc mene
);

/* ──────── abonnement Firestore & auth ──────────────────────────── */
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

function subscribeRoom() {
  return onSnapshot(roomRef, (snap) => {
    roomData.value = snap.exists() ? snap.data() : null;
    loading.value = false;
  });
}

onMounted(() => {
  onAuthStateChanged(getAuth(), (user) => {
    uid.value = user?.uid ?? null;
    if (uid.value) subscribeRoom();
    else loading.value = false;
  });
  /*ouvre la popup de demande de nom si vide */
  watch(
    () => roomData.value?.playerNames,
    () => {
      if (uid.value && roomData.value) {
        const current = roomData.value.playerNames?.[uid.value] ?? "";
        if (!current) {
          // nom encore vide
          nameInput.value = "";
          showNameModal.value = true;
        }
      }
    },
    { immediate: true }
  );

  /* (re)abonnement à la mène courante */
  watch(
    currentMeneId,
    (id) => {
      if (unsubscribeMene) {
        unsubscribeMene();
        unsubscribeMene = null;
      }
      if (id != null) unsubscribeMene = subscribeMene(roomId, id);
      else battleZoneCards.value = [];
    },
    { immediate: true }
  );

  /* maintien de localHand en phase avec Firestore */
  watch(
    () => roomData.value?.hands?.[uid.value] ?? [],
    (h) => {
      localHand.value = [...h];
    },
    { immediate: true }
  );

  /* watcher maître : popup, combos, pioche */
  watch(
    () => ({
      right: canMeld.value,
      clear: tableIsClear.value,
      trump: trumpCard.value,
    }),
    ({ right, clear, trump }) => {
      // 1. Fermer si je perds le droit de meld
      if (right !== uid.value) {
        showComboPopup.value = false;
        return;
      }
      const rank = trump.slice(0, -1); // trump est déjà une string
      const seven = "7" + trump.slice(-1);

      // 2. Ouvrir seulement si la table est vide
      if (right === uid.value && clear) {
        const all = [
          ...localHand.value.map(strToCard),
          ...playerMeldCards.value,
        ];
        validCombos.value = detectCombinations(
          all,
          trumpCard.value.slice(-1) as Suit,
          playerMelds.value
        );
        showComboPopup.value = validCombosFiltered.value.length > 0;
      }
    },
    { immediate: true }
  );
});

onUnmounted(() => {
  if (unsubscribeMene) unsubscribeMene();
});

/* ──────── drag : mise à jour Firestore après réordonnancement ──── */
async function onHandReorder() {
  if (uid.value)
    await updateDoc(roomRef, { [`hands.${uid.value}`]: localHand.value });
}
/* ──────── demande de nom de joueur ──── */

async function saveName() {
  if (!uid.value || !nameInput.value.trim()) return;
  await updateDoc(roomRef, {
    [`playerNames.${uid.value}`]: nameInput.value.trim(),
  });
  showNameModal.value = false;
}
/* ──────── si le nom du joueur commence par une voyelle ──── */

function deOuD(name: string): string {
  if (!name) return "de"; // fallback
  const first = name.trim().charAt(0).toLowerCase();
  return "aeiouyhàâäéèêëïîôöùûüÿ".includes(first) ? "d’" : "de ";
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

/**
 * Ajoute une combinaison au meld du joueur.
 * - Retire les cartes de la main
 * - Ajoute le meld
 * - Met à jour le score
 * - Maintient canMeld tant qu’il reste ≥ 1 combo possible
 */
async function playCombo(combo: Combination) {
  if (!uid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room inexistante";
    const d = snap.data() as any;

    if (d.canMeld !== uid.value) throw "Pas votre tour de meld";

    /* 1. Retirer cartes de la main */
    const hand = [...d.hands[uid.value]];
    for (const c of combo.cards) {
      const i = hand.indexOf(cardToStr(c));
      if (i === -1) throw "Carte manquante";
      hand.splice(i, 1);
    }

    /* 2. Ajouter la combinaison */
    const melds = [...(d.melds?.[uid.value] ?? []), combo];

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
      [`hands.${uid.value}`]: hand,
      [`melds.${uid.value}`]: melds,
      canMeld: stillCombos ? uid.value : null, // 👈 clé !
    };

    tx.update(roomRef, update);
  });
}

/**
 * Joue une carte de la main (clic normal).
 * – vérifie le tour ;
 * – ajoute la carte au pli ;
 * – détermine le vainqueur si le pli est complet ;
 * – donne le droit de poser des combinaisons (canMeld = winnerUid) ;
 * – aucune pioche ici : elle part quand canMeld repasse à null
 */
async function playCard(card: string) {
  if (!uid.value || !roomData.value) return;

  /* ── sécurités de base ─────────────────── */
  if (currentTurn.value !== uid.value) {
    alert("Ce n’est pas votre tour");
    return;
  }
  if (!roomData.value.hands[uid.value].includes(card)) {
    alert("Vous ne possédez pas cette carte");
    return;
  }

  /* ── transaction Firestore ─────────────── */
  const pliComplet = await runTransaction(db, async (tx) => {
    let isComplete = false; // ← sera renvoyé

    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room inexistante";
    const d = snap.data() as any;

    if (d.currentTurn !== uid.value) throw "Tour obsolète";

    /* 1. MAJ main locale */
    const newHand = d.hands[uid.value].filter((c: string) => c !== card);

    /* 2. MAJ pli */
    const trick = d.trick ?? { cards: [], players: [] };
    if (trick.cards.length >= 2) throw "Le pli n’est pas vidé";
    trick.cards.push(card);
    trick.players.push(uid.value);

    /* 3. MAJ mene (affichage) */
    const meneRef = doc(
      db,
      "rooms",
      roomId,
      "menes",
      String(currentMeneId.value)
    );
    const meneSnap = await tx.get(meneRef);
    const meneData = meneSnap.exists() ? meneSnap.data() : {};
    tx.set(
      meneRef,
      { currentPliCards: [...(meneData.currentPliCards ?? []), card] },
      { merge: true }
    );

    /* 4. Préparer update principal */
    const update: any = {
      [`hands.${uid.value}`]: newHand,
      trick,
    };

    /* 5. Pli complet ? */
    if (trick.cards.length === 2) {
      const deck = d.deck ?? [];
      const hands = d.hands;
      const winnerUid = resolveTrick(
        trick.cards[0],
        trick.cards[1],
        trick.players[0],
        trick.players[1],
        d.trumpCard
      );
      /* compte main + meld du gagnant et du perdant */
      const winnerTot =
        hands[winnerUid].length + meldSize(d.melds?.[winnerUid]);
      const loserUid = winnerUid === uid.value ? opponentUid.value! : uid.value;
      const loserTot = hands[loserUid].length + meldSize(d.melds?.[loserUid]);

      // /* — 1ʳᵉ carte pour le gagnant — */
      // if (deck.length && winnerTot < 9) hands[winnerUid].push(deck.shift()!);

      // /* — 2ᵉ carte pour le perdant — */
      // if (deck.length && loserTot < 9) hands[loserUid].push(deck.shift()!);

      update.deck = deck;
      update[`hands.${winnerUid}`] = hands[winnerUid];
      update[`hands.${loserUid}`] = hands[loserUid];

      /* +10 pts si 10 ou As */
      const scores = d.scores ?? {};
      if (trick.cards.some((c) => c.startsWith("10") || c.startsWith("A")))
        scores[winnerUid] = (scores[winnerUid] ?? 0) + 10;

      update.trick = { cards: [], players: [] };
      update.currentTurn = winnerUid;
      update.canMeld = winnerUid;
      update.scores = scores;

      isComplete = true; // ← on signale pli terminé
    } else {
      update.currentTurn = opponentUid.value;
    }

    tx.update(roomRef, update);
    return isComplete; // ← valeur pour pliComplet
  });

  /* ── vider la zone d’échange 2 s après si pli terminé ─────────── */
  if (pliComplet) {
    setTimeout(async () => {
      const meneRef = doc(
        db,
        "rooms",
        roomId,
        "menes",
        String(currentMeneId.value)
      );
      await updateDoc(meneRef, { currentPliCards: [] });
    }, 2000);
  }
}

/*────────────────────────────────────────────────────────────────────*/

/**
 * Joue une carte depuis un meld existant (clic sur une carte posée).
 * Garde la logique d’origine : si le pli devient complet, on résout,
 * on pioche immédiatement (car on n’est plus en phase de meld).
 * → pas de changement par rapport à ton code initial.
 */
/** Joue (depuis un meld) une carte déjà posée par le joueur */
async function playCardFromMeld(card: Card) {
  if (!uid.value || !roomData.value) return;
  if (currentTurn.value !== uid.value) return; // sécurité tour

  const cardStr = cardToStr(card);

  /* ───── transaction Firestore ───── */
  const pliComplet = await runTransaction(db, async (tx) => {
    let isComplete = false; // ← flag local

    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room inexistante";
    const d = snap.data() as any;

    if (d.currentTurn !== uid.value) throw "Pas votre tour";
    if (d.canMeld === uid.value) throw "Piochez avant de rejouer";

    /* 1. retirer la carte du meld */
    const melds: Combination[] = d.melds?.[uid.value] ?? [];
    let removed = false;
    const newMelds = melds
      .map((m) => {
        if (removed) return m;
        const i = m.cards.findIndex(
          (c) => c.rank === card.rank && c.suit === card.suit
        );
        if (i !== -1) {
          const cs = [...m.cards];
          cs.splice(i, 1);
          removed = true;
          return { ...m, cards: cs };
        }
        return m;
      })
      .filter((m) => m.cards.length);
    if (!removed) throw "Carte non trouvée dans vos melds";

    /* 2. ajouter la carte au pli */
    const trick = d.trick ?? { cards: [], players: [] };
    if (trick.cards.length >= 2) throw "Le pli n’est pas vidé";
    trick.cards.push(cardStr);
    trick.players.push(uid.value);

    /* 3. MAJ mene (affichage) */
    const meneRef = doc(
      db,
      "rooms",
      roomId,
      "menes",
      String(currentMeneId.value)
    );
    const meneSnap = await tx.get(meneRef);
    const meneData = meneSnap.exists() ? meneSnap.data() : {};
    tx.set(
      meneRef,
      { currentPliCards: [...(meneData.currentPliCards ?? []), cardStr] },
      { merge: true }
    );

    /* 4. préparation update */
    const update: any = {
      [`melds.${uid.value}`]: newMelds,
      trick,
    };

    /* 5. pli complet ? */
    if (trick.cards.length === 2) {
      const winnerUid = resolveTrick(
        trick.cards[0],
        trick.cards[1],
        trick.players[0],
        trick.players[1],
        d.trumpCard
      );

      /* compte main + meld du gagnant et du perdant */

      const deck = d.deck ?? [];
      const hands = d.hands;
      const winnerTot =
        hands[winnerUid].length + meldSize(d.melds?.[winnerUid]);
      const loserUid = winnerUid === uid.value ? opponentUid.value! : uid.value;
      const loserTot = hands[loserUid].length + meldSize(d.melds?.[loserUid]);

      /* — 1ʳᵉ carte pour le gagnant — */
      if (deck.length && winnerTot < 9) hands[winnerUid].push(deck.shift()!);

      /* — 2ᵉ carte pour le perdant — */
      if (deck.length && loserTot < 9) hands[loserUid].push(deck.shift()!);

      update.deck = deck;
      update[`hands.${winnerUid}`] = hands[winnerUid];
      update[`hands.${loserUid}`] = hands[loserUid];

      /* scoring 10 / As */
      const scores = d.scores ?? {};
      if (trick.cards.some((c) => c.startsWith("10") || c.startsWith("A")))
        scores[winnerUid] = (scores[winnerUid] ?? 0) + 10;

      update.trick = { cards: [], players: [] };
      update.currentTurn = winnerUid;
      update.canMeld = winnerUid; // droit de meld
      update.deck = deck;
      update[`hands.${winnerUid}`] = hands[winnerUid];
      update[`hands.${loserUid}`] = hands[loserUid];
      update.scores = scores;

      isComplete = true; // ← on signale que c’était la 2ᵉ carte
    } else {
      update.currentTurn = opponentUid.value;
    }

    tx.update(roomRef, update);
    return isComplete; // ← valeur transmise hors transaction
  });

  /* ── vider la zone d’échange 2 s après, si pli terminé ── */
  if (pliComplet) {
    setTimeout(async () => {
      const meneRef = doc(
        db,
        "rooms",
        roomId,
        "menes",
        String(currentMeneId.value)
      );
      await updateDoc(meneRef, { currentPliCards: [] });
    }, 2000);
  }
}

/*────────────────────────────────────────────────────────────────────*/

/**
 * Pose une combinaison choisie dans la popup.
 * – ajoute la combo au meld ; retire les cartes de la main ;
 * – score et remet canMeld à null pour déclencher la pioche.
 */
async function playCombination(combo: Combination) {
  if (!uid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    const d = snap.data() as any;
    if (!d) throw "Room introuvable";

    /* 1️⃣ vérifs habituelles */
    if (d.canMeld !== uid.value)
      throw "Vous ne pouvez plus poser de combinaison";
    const okCards = combo.cards.every(
      (c) =>
        d.hands[uid.value].includes(cardToStr(c)) ||
        (d.melds?.[uid.value] ?? [])
          .flatMap((m: any) => m.cards)
          .some((cc: Card) => cc.rank === c.rank && cc.suit === c.suit)
    );
    if (!okCards) throw "Cartes manquantes";

    /* 2️⃣ retirer de la main */
    const newHand = d.hands[uid.value].filter(
      (s: string) => !combo.cards.some((c) => s === cardToStr(c))
    );

    /* 3️⃣ ajouter dans melds */
    const melds = { ...(d.melds ?? {}) };
    melds[uid.value] = [...(melds[uid.value] ?? []), combo];

    /* 4️⃣ scorer */
    const scores = { ...(d.scores ?? {}) };
    scores[uid.value] = (scores[uid.value] ?? 0) + combo.points;

    /* 5️⃣ canMeld = null pour bloquer d’autres poses */
    tx.update(roomRef, {
      [`hands.${uid.value}`]: newHand,
      [`melds.${uid.value}`]: melds[uid.value],
      scores,
      canMeld: null, // ← fin de la phase meld
    });
  });
}

/*────────────────────────────────────────────────────────────────────*/

/** Échange (facultatif) du 7 d’atout contre la trump exposée. */
/**
 * Tente d’échanger le 7 d’atout du joueur contre la trumpCard exposée.
 * - Réussit uniquement si la trumpCard est A, K, Q, J ou 10.
 * - Ne fait rien (retourne false) si l’échange n’est pas autorisé.
 * - return true si un échange a bien été effectué, false sinon.
 */
async function tryExchangeSeven(playerUid: string): Promise<boolean> {
  let exchanged = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room introuvable";
    const d = snap.data() as any;

    // 1. Pré-requis : encore des cartes dans la pioche
    if ((d.deck?.length ?? 0) === 0) return;

    const trumpSuit = d.trump as Suit; // ex. 'H'
    const trumpCardCur = d.trumpCard as string; // ex. 'A♥'
    const allowed = ["A", "K", "Q", "J", "10"];

    // 2. La trumpCard doit être échangeable
    const rankCur = trumpCardCur.slice(0, -1); // 'A', 'K', …
    if (!allowed.includes(rankCur)) return;

    // 3. Le joueur possède-t-il le 7 d’atout ?
    const sevenTrump = "7" + trumpCardCur.slice(-1); // '7♥' si atout ♥
    const hand = [...d.hands[playerUid]];
    const i = hand.indexOf(sevenTrump);
    if (i === -1) return;

    // 4. Échange : retirer le 7, ajouter trumpCard
    hand.splice(i, 1);
    hand.push(trumpCardCur);

    tx.update(roomRef, {
      [`hands.${playerUid}`]: hand,
      trumpCard: sevenTrump,
    });

    exchanged = true;
  });

  return exchanged;
}

/*----------------------------------------*/
/** Retourne le nombre total de cartes dans un tableau de melds */
function meldSize(melds: Combination[] | undefined): number {
  if (!melds || !melds.length) return 0;
  return melds.reduce((n, m) => n + m.cards.length, 0);
}

/** Pioche 1 carte vainqueur, 1 carte perdant dès la fin de la phase meld */
async function drawCardsAfterMeld() {
  if (!uid.value) return; // sécurité

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room supprimée";
    const d = snap.data() as any;

    /* on ne pioche que si la phase meld est terminée */
    if (d.canMeld !== null) return;

    const deck = d.deck ?? [];
    if (deck.length === 0) return; // pioche vide

    const winnerUid = d.currentTurn; // vainqueur actuel (doit rejouer)
    const loserUid = winnerUid === uid.value ? opponentUid.value! : uid.value;

    const hands = d.hands;
    const winnerTot = hands[winnerUid].length + meldSize(d.melds?.[winnerUid]);
    const loserTot = hands[loserUid].length + meldSize(d.melds?.[loserUid]);

    /* 1ʳᵉ carte pour le vainqueur */
    if (deck.length && winnerTot < 9) hands[winnerUid].push(deck.shift()!);

    /* 2ᵉ carte pour le perdant (s’il en reste) */
    if (deck.length && loserTot < 9) hands[loserUid].push(deck.shift()!);

    /* commit MAJ */
    tx.update(roomRef, {
      deck,
      [`hands.${winnerUid}`]: hands[winnerUid],
      [`hands.${loserUid}`]: hands[loserUid],
    });
  });
}
//
async function playCardFromMeldWrapper(card: Card) {
  await drawCardIfNeeded();
  return playCardFromMeld(card);
}

async function drawCardIfNeeded() {
  if (!uid.value) return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "Room supprimée";
    const d = snap.data() as any;

    // Ici, on pioche uniquement si canMeld === uid.value (pioche obligatoire avant de rejouer)
    if (d.canMeld !== uid.value) return;

    const deck = d.deck ?? [];
    if (deck.length === 0) return; // deck vide

    const hands = { ...d.hands };
    hands[uid.value] = [...(hands[uid.value] || [])];

    // Pioche 1 carte pour le joueur qui doit piquer
    hands[uid.value].push(deck.shift()!);

    // Mise à jour : canMeld à null pour signaler que pioche faite
    tx.update(roomRef, {
      deck,
      [`hands.${uid.value}`]: hands[uid.value],
      canMeld: null,
    });
  });
}

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
  if (firstSuit === trumpSuit && secondSuit !== trumpSuit)
    return firstPlayerUid;
  if (firstSuit !== trumpSuit && secondSuit === trumpSuit)
    return secondPlayerUid;

  // Les deux sont atout, plus forte valeur gagne
  if (firstSuit === trumpSuit && secondSuit === trumpSuit) {
    if (secondValue > firstValue) return secondPlayerUid;
    else return firstPlayerUid;
  }

  // Cas par défaut, premier joueur gagne
  return firstPlayerUid;
}

/*---------------------------------DETECTION----------------------------*/
/* -------- types -------- */
interface Card {
  rank: Rank;
  suit: Suit;
}
interface Combination {
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

// const hand = ref<string[]>([]);
// const trump = ref<Suit | undefined>(undefined);
// const showTrumpExchangePopup = ref(false);

/* détection – seulement dans la main */
// const canExchangeTrump = computed(() => {
//   const seven = `7${trump.value}`;
//   const eligibleRanks = ["J", "Q", "K", "10", "A"];
//   return (
//     hand.value.includes(seven) && eligibleRanks.includes(trumpCard.value.rank)
//   );
// });

// /* ouverture automatique : dès que les conditions deviennent vraies */
// watch(canExchangeTrump, (ok) => {
//   if (ok) showTrumpExchangePopup.value = true;
// });

// async function acceptExchange() {
//   try {
//     await tryExchangeSeven(uid.value); // déclenche la transaction
//   } catch (e) {
//     console.error(e); // à remplacer par un toast d'erreur éventuel
//   }
//   showTrumpExchangePopup.value = false;
// }

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
/* ──────────  permet de gérer la donne de la pioche après avoir posé, le cas échéant ────────── */

function closeComboPopup() {
  showComboPopup.value = false;

  // Je suis le vainqueur ET les melds sont terminées
  if (roomData.value?.canMeld === uid.value) {
    updateDoc(roomRef, { canMeld: null }) // met fin à la phase meld
      .then(() =>
        setTimeout(
          () =>
            // → pioche 1 s après
            drawCardsAfterMeld().catch(console.error),
          1000
        )
      );
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
