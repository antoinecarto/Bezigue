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
      <div class="drop-zone …">
        <p class="text-xs font-semibold mb-1">Combinaisons adverses</p>

        <div v-if="opponentMelds.length" class="flex flex-wrap gap-2 justify-center">
          <template v-for="(meld, i) in opponentMelds" :key="'oppmeld-'+i">
            <div
              v-for="c in meld.cards"
              :key="'opp'+c.rank+c.suit"
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
    <div class="text-xl font-bold text-red-700">
      Partie en : 2000 pts
    </div>
  </div>

  <!-- Deuxième scoreboard -->
  <div
    class="scoreboard flex flex-col items-center gap-2 p-4 border-2 border-gray-300 rounded-lg shadow-md w-48"
  >
    <h3 class="text-lg font-semibold mb-4">Score</h3>
    <div class="text-xl font-bold text-green-700 mb-2">
      Joueur : {{ playerScore }}
    </div>
    <div class="text-xl font-bold text-red-700">
      Adversaire : {{ opponentScore }}
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
        {{ deckCards.length }} carte<span v-if="deckCards.length > 1">s</span> restantes
      </div>
    </div>
  </div>
</div>



    <!-- MAIN DU JOUEUR ACTIF + Zone de dépôt intégrée -->
    <div v-if="localHand.length" class="player-hand mt-8">
      <!-- Zone de dépôt du joueur -->
      <!-- Zone de dépôt joueur : mêmes cartes que la main -->
      <div class="drop-zone mt-4 p-4 border-2 border-dashed border-gray-400 rounded bg-gray-50">
        <p class="text-xs font-semibold mb-1">Vos combinaisons</p>

        <div v-if="playerMelds.length" class="flex flex-wrap gap-2 justify-center">
          <!-- on parcourt chaque combinaison -->
          <template v-for="(meld, mIndex) in playerMelds" :key="'meld-'+mIndex">
            <div
              v-for="c in meld.cards"
              :key="c.rank + c.suit"
              class="card border px-3 py-2 rounded shadow text-xl"
              :class="getCardColor(cardToStr(c))"@click="playCardFromMeld(c)"  
            >
              {{ cardToStr(c) }}
            </div>
          </template>
        </div>

        <span v-else class="text-[10px] italic text-gray-400">Aucune</span>
      </div>

      <!-- MAIN DU JOUEUR avec espacement -->
      <div class="mt-4">
        <draggable v-model="localHand" @end="onHandReorder" class="cards flex gap-2 justify-center flex-wrap" item-key="element">
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
<div v-if="showComboPopup" class="fixed inset-0 bg-black/50 flex items-center justify-center" @click.self="showComboPopup=false">
  <div class="bg-white p-6 rounded-lg w-80">
    <h3 class="text-lg font-semibold mb-4">Combinaisons possibles</h3>
    <ul class="space-y-2 max-h-56 overflow-y-auto">
      <li v-for="(combo,i) in validCombos" :key="i">
        <button class="w-full px-3 py-1 border rounded hover:bg-slate-100"
                @click="playCombination(combo)">
          {{ combo.name }} ({{ combo.points }} pts)
        </button>
      </li>
    </ul>
    <button class="mt-4 text-sm text-red-600" @click="showComboPopup=false">Fermer</button>
  </div>
</div>
<!-- GameRoom.vue <template> -->
<Transition name="fade">
  <div
    v-if="showTrumpExchangePopup"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
  >
    <div class="bg-white rounded-2xl shadow-xl p-6 w-[320px]">
      <h2 class="text-xl font-semibold mb-4 text-center">
        Échanger le 7 d’atout ?
      </h2>

      <p class="text-center mb-6">
        Vous possédez le <strong>7{{ trump }}</strong> .<br>
        Souhaitez-vous le poser et<br>
        récupérer le
        <strong>{{ trumpCard.rank }}{{ trump }}</strong> exposé&nbsp;?
      </p>

      <div class="flex justify-center gap-4">
        <button
          class="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
          @click="acceptExchange"
        >
          Oui, échanger
        </button>

        <button
          class="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400"
          @click="showTrumpExchangePopup = false"
        >
          Plus tard
        </button>
      </div>
    </div>
  </div>
</Transition>

</template>

<script setup lang="ts">
import draggable from 'vuedraggable';
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import {
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/firebase";


function cardToStr(card: Card | string): string {
  return typeof card === 'string' ? card : `${card.rank}${card.suit}`
}

function strToCard(str: string): Card {
  const suit = str.slice(-1) as Suit
  const rank = str.slice(0, str.length - 1) as Rank
  return { rank, suit }
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
const showComboPopup = ref(false);
const validCombos    = ref<Combination[]>([]);
const currentMeneId = computed(() => roomData.value?.currentMeneId ?? 0);
const playerMelds = computed<Combination[]>(() =>
  roomData.value?.melds?.[uid.value ?? ''] ?? []            // tableau vide si absent
)

const playerMeldCards = computed<Card[]>(() =>
  playerMelds.value.flatMap(c => c.cards)
)
/* melds de l’adversaire (pour la zone du haut) -------------------- */
const opponentMelds = computed<Combination[]>(() => {
  return opponentUid.value
    ? (roomData.value?.melds?.[opponentUid.value] ?? []) as Combination[]
    : []                                                   // ← tableau vide, typé
})

onMounted(() => {
  onAuthStateChanged(getAuth(), (user) => {
    uid.value = user?.uid ?? null;
    if (uid.value) subscribeRoom();
    else loading.value = false;
    });
  watch(
    () => currentMeneId.value,
    (newMeneId) => {
      // On coupe l’abonnement précédent, s’il existe
      if (unsubscribeMene) {
        unsubscribeMene();
        unsubscribeMene = null;
      }

      // On s’abonne à la nouvelle mène (ou on vide l’affichage si meneId nul)
      if (newMeneId !== null && newMeneId !== undefined) {
        unsubscribeMene = subscribeMene(roomId, newMeneId);
      } else {
        battleZoneCards.value = [];
      }
    },
    { immediate: true } // on déclenche dès le montage
  );
/* watch : recalcule à chaque changement de main ou melds */
  watch(
    () => [localHand.value, playerMelds.value, canMeld.value],
    () => {
      /* si ce n’est pas à moi de meld → on ferme */
      if (canMeld.value !== uid.value) {
        showComboPopup.value = false
        return
      }

      const allCards: Card[] = [
        ...localHand.value.map(strToCard),
        ...playerMeldCards.value
      ]

      validCombos.value = detectCombinations(
        allCards,
        trumpCard.value.slice(-1) as Suit
      )

      showComboPopup.value = validCombos.value.length > 0
    },
    { immediate: true }
  )
  watch(
  () => canMeld.value,
  (newVal, oldVal) => {
    if (oldVal === uid.value && newVal == null) {
      drawCardsAfterMeld().catch(console.error);
    }
  }
  );
  watch(
  () => showComboPopup.value,
  (newVal, oldVal) => {
    if (oldVal && !newVal) {                 // vient d’être fermé
      setTimeout(() => {
        drawCardsAfterMeld().catch(console.error);
      }, 1000);                              // 1 seconde
    }
  }
  );
 // Quand roomData change, on met à jour localHand
  watch(
  () => roomData.value?.hands?.[uid.value] ?? [],
  (newHand) => {
    localHand.value = [...newHand]; // copie pour modifier localement
  },
  { immediate: true }
);

// Quand drag/drop modifie localHand, on doit envoyer la nouvelle main dans Firestore
function onHandReorder() {
  if (!uid.value || !roomRef) return;

  // MAJ Firestore avec le nouvel ordre de main
  updateDoc(roomRef, {
    [`hands.${uid.value}`]: localHand.value
  });
}
});

// Quand drag/drop modifie localHand, on doit envoyer la nouvelle main dans Firestore
function onHandReorder() {
  if (!uid.value || !roomRef) return;
}

function subscribeRoom() {
  onSnapshot(roomRef, (snap) => {
    roomData.value = snap.exists() ? snap.data() : null;
    loading.value = false;
  });
}

onUnmounted(() => {
  if (unsubscribeMene) {
    unsubscribeMene();
    unsubscribeMene = null;
  }
});

/* ──────────  aides  ────────── */
const opponentUid = computed(() =>
  roomData.value?.hands
    ? Object.keys(roomData.value.hands).find((k) => k !== uid.value)
    : null
);

// const localHand = computed<string[]>(() =>
//   uid.value ? roomData.value?.hands?.[uid.value] ?? [] : []
// );

const localHand = ref<string[]>([]);


const opponentHand = computed<string[]>(() =>
  opponentUid.value ? roomData.value?.hands?.[opponentUid.value] ?? [] : []
);

const currentTurn = computed<string | null>(() => roomData.value?.currentTurn ?? null);
const deckCards = computed(() => roomData.value?.deck ?? []);
const trumpCard = computed(() => roomData.value?.trumpCard ?? "—");
const canMeld = computed(() => roomData.value?.canMeld ?? null)


// Cartes jouées visibles dans les zones de dépôt
// const playerPlayedCards = computed<string[]>(() => roomData.value?.playerPlayedCards ?? []);
// const opponentPlayedCards = computed<string[]>(() => roomData.value?.opponentPlayedCards ?? []);

// Scores
const playerScore = computed(() => roomData.value?.scores?.[uid.value ?? ""] ?? 0);
const opponentScore = computed(() =>
  opponentUid.value ? roomData.value?.scores?.[opponentUid.value] ?? 0 : 0
);

/** Joue (depuis un meld) une carte déjà posée par le joueur */
async function playCardFromMeld(card: Card) {
  if (!uid.value || !roomData.value) return

  /* sécurité : doit être votre tour */
  if (currentTurn.value !== uid.value) return

  /* conversion objet → chaîne (ex : {rank:'K',suit:'♣'} → 'K♣') */
  const cardStr = cardToStr(card)

  await runTransaction(db, async tx => {
    /* ---------- lecture instantanée ---------- */
    const snap = await tx.get(roomRef)
    if (!snap.exists()) throw 'Room inexistante'
    const d = snap.data()!

    if (d.currentTurn !== uid.value) throw 'Pas votre tour'
    if (d.canMeld === uid.value)      // on n’a pas encore pioché
      throw 'Piochez avant de rejouer une carte'

    /* ---------- retirer la carte du meld ---------- */
    const melds    : Combination[] = d.melds?.[uid.value] ?? []
    let   removed  = false

    const newMelds = melds
      .map(m => {
        if (removed) return m
        const i = m.cards.findIndex(cc => cc.rank === card.rank && cc.suit === card.suit)
        if (i !== -1) {
          removed = true
          const cards = [...m.cards]
          cards.splice(i, 1)                // enlève la carte
          return { ...m, cards }
        }
        return m
      })
      .filter(m => m.cards.length)          // supprime un meld vide

    if (!removed) throw 'Carte non trouvée dans vos combinaisons'

    /* ---------- ajouter la carte au pli ---------- */
    const trick = d.trick ?? { cards: [], players: [] }
    if (trick.cards.length >= 2) throw 'Le pli courant n’est pas encore vidé'

    trick.cards.push(cardStr)
    trick.players.push(uid.value)

    /* mise à jour pour l’affichage temps-réel (mene/{id}) */
    const meneRef  = doc(db, 'rooms', roomId, 'menes', String(currentMeneId.value))
    const meneSnap = await tx.get(meneRef)
    const meneData = meneSnap.exists() ? meneSnap.data() : {}
    const currentPliCards = [...(meneData.currentPliCards ?? []), cardStr]
    tx.set(meneRef, { currentPliCards }, { merge: true })

    /* ---------- objet d’update principal ---------- */
    const update: any = {
      [`melds.${uid.value}`] : newMelds,
      trick
    }

    /* ---------- si 2 cartes → résolution du pli ---------- */
    if (trick.cards.length === 2) {
      const winnerUid = resolveTrick(
        trick.cards[0], trick.cards[1],
        trick.players[0], trick.players[1],
        d.trumpCard
      )

      /* --- pioche automatique --- */
      const deck  = d.deck  ?? []
      const hands = d.hands

       // carte pour l'autre joueur (s'il en reste)
 
      if (deck.length && hands[winnerUid].length < 9) {
        hands[winnerUid].push(deck.shift()!)
      }
       const loserUid = winnerUid === uid.value ? opponentUid.value! : uid.value
      if (!loserUid) throw 'Adversaire introuvable'      
      if (deck.length && hands[loserUid].length < 9) {
        hands[loserUid].push(deck.shift()!)
      }

      /* --- scoring 10 / As --- */
      const scores = d.scores ?? {}
      if (trick.cards.some(c => c.startsWith('10') || c.startsWith('A'))) {
        scores[winnerUid] = (scores[winnerUid] ?? 0) + 10
      }

      /* --- nettoyage pli + passage de main --- */
      update.trick                 = { cards: [], players: [] }
      update.currentTurn           = winnerUid
      update.canMeld               = winnerUid              // vainqueur pourra poser un meld
      update.deck                  = deck
      update[`hands.${winnerUid}`] = hands[winnerUid]
      update[`hands.${loserUid}`]  = hands[loserUid]
      update.scores                = scores
    } else {
      /* 1 seule carte → tour à l’adversaire */
      update.currentTurn = opponentUid.value
    }

    /* ---------- commit Firestore ---------- */
    tx.update(roomRef, update)
  })
}

const hand         = ref<string[]>([])  
const trump = ref<Suit | undefined>(undefined)
const showTrumpExchangePopup = ref(false)

/* détection – seulement dans la main */
const canExchangeTrump = computed(() => {
  const seven = `7${trump.value}`
  const eligibleRanks = ['J', 'Q', 'K', '10', 'A']
  return hand.value.includes(seven) &&
         eligibleRanks.includes(trumpCard.value.rank)
})

/* ouverture automatique : dès que les conditions deviennent vraies */
watch(canExchangeTrump, ok => {
  if (ok) showTrumpExchangePopup.value = true
})

async function acceptExchange() {
  try {
    await tryExchangeSeven(uid.value); // déclenche la transaction
  } catch (e) {
    console.error(e); // à remplacer par un toast d'erreur éventuel
  }
  showTrumpExchangePopup.value = false;
}
///
async function drawCardsAfterMeld() {
  if (!uid.value) return;

  await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw 'Room inexistante';
    const d = snap.data()!;

    /* autorisé uniquement si la phase meld est finie */
    if (d.canMeld != null) throw 'Les combinaisons ne sont pas terminées';

    const winnerUid = uid.value;                                   // moi, le gagnant
    const loserUid  = Object.keys(d.hands).find(k => k !== winnerUid)!;

    const deck  = [...(d.deck ?? [])];
    const hands = { ...d.hands };

    /* ---- limite 9 cartes (main + meld) ---- */
    const meldSize = (melds: any[] | undefined) =>
      melds?.reduce((n, m) => n + (m.cards?.length ?? 0), 0) ?? 0;

    const winnerLimit = hands[winnerUid].length + meldSize(d.melds?.[winnerUid]);
    const loserLimit  = hands[loserUid].length + meldSize(d.melds?.[loserUid]);

    if (deck.length && winnerLimit < 9) hands[winnerUid].push(deck.shift()!);
    if (deck.length && loserLimit  < 9) hands[loserUid] .push(deck.shift()!);

    tx.update(roomRef, {
      deck,
      [`hands.${winnerUid}`]: hands[winnerUid],
      [`hands.${loserUid}`] : hands[loserUid],
      currentTurn: winnerUid,   // le gagnant joue aussitôt
      canMeld: null
    });
  });
}

///
async function playCombination(combo: Combination) {
  if (!uid.value) return

  await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef)
    const d = snap.data()
    if (!d) throw new Error('Room introuvable')

    /* 1️⃣  vérifs habituelles */
    if (d.canMeld !== uid.value) throw 'Vous ne pouvez plus poser de combinaison'
    if (!combo.cards.every(c =>
          d.hands[uid.value].some((cc: string) => cc === `${c.rank}${c.suit}`)
          || (d.melds?.[uid.value] ?? []).flatMap((m: any)=>m.cards).includes(c)
        )) throw 'Cartes manquantes'

    /* 2️⃣  retirer de la main */
    const newHand = d.hands[uid.value].filter(
      (s: string) => !combo.cards.some(c => s === `${c.rank}${c.suit}`)
    )

    /* 3️⃣  ajouter dans melds */
    const melds = { ...(d.melds ?? {}) }
    melds[uid.value] = [...(melds[uid.value] ?? []), combo]

    /* 4️⃣  scorer */
    const scores = { ...(d.scores ?? {}) }
    scores[uid.value] = (scores[uid.value] ?? 0) + combo.points

    /* 5️⃣  canMeld = null pour bloquer d’autres poses ce pli */
    tx.update(roomRef, {
      [`hands.${uid.value}`]: newHand,
      [`melds.${uid.value}`]: melds[uid.value],
      scores,
      canMeld: null
    })
  })

  showComboPopup.value = false
}


/* ──────────  clic sur une carte  ────────── */
async function playCard(card: string) {
  if (!uid.value || !roomData.value) return;

  /* 1. sécurité : tour & carte possédée */
  if (currentTurn.value !== uid.value) {
    alert("Ce n'est pas votre tour.");
    return;
  }
  if (!roomData.value.hands[uid.value].includes(card)) {
    alert("Vous ne possédez pas cette carte.");
    return;
  }

  /* ─────────── transaction Firestore ─────────── */
  const pliComplet = await runTransaction(db, async (tx) => {
    let isComplete = false;               // ← flag renvoyé hors transaction

    /* 2. snapshot instantané */
    const snap = await tx.get(roomRef);
    if (!snap.exists()) throw "La partie n'existe plus";
    const d = snap.data()!;

    if (d.currentTurn !== uid.value) throw "Tour obsolète";

    /* 3. main locale MAJ */
    const newHand = d.hands[uid.value].filter((c: string) => c !== card);

    /* 4. mise à jour du pli */
    const trick = d.trick ?? { cards: [], players: [] };
    if (trick.cards.length >= 2) throw "Le pli courant n'est pas encore vidé";

    trick.cards.push(card);
    trick.players.push(uid.value);

    /* 5. mise à jour visuelle (mene) */
    const meneRef  = doc(db, "rooms", roomId, "menes", String(currentMeneId.value));
    const meneSnap = await tx.get(meneRef);
    const meneData = meneSnap.exists() ? meneSnap.data() : {};
    const currentPliCards = [...(meneData.currentPliCards ?? []), card];
    tx.set(meneRef, { currentPliCards }, { merge: true });

    /* 6. objet d'update général */
    const update: any = {
      [`hands.${uid.value}`]: newHand,
      trick
    };

    /* 7. pli complet ? */
    if (trick.cards.length === 2) {
      const winnerUid = resolveTrick(
        trick.cards[0], trick.cards[1],
        trick.players[0], trick.players[1],
        d.trumpCard
      );

      /* scoring sur 10 / As */
      const scores = d.scores ?? {};
      if (trick.cards.some(c => c.startsWith("10") || c.startsWith("A"))) {
        scores[winnerUid] = (scores[winnerUid] ?? 0) + 10;
      }

      /* vider pli + passage au gagnant + autoriser meld */
      update.trick       = { cards: [], players: [] };
      update.currentTurn = winnerUid;
      update.canMeld     = winnerUid;
      update.scores      = scores;

      isComplete = true;               // ← on signale dehors que le pli est fini
    } else {
      /* une seule carte → tour à l'adversaire */
      update.currentTurn = opponentUid.value;
    }

    tx.update(roomRef, update);
    return isComplete;                 // ← renvoyé à pliComplet
  });

  /* ---------- après la transaction ---------- */
  if (pliComplet) {
    // ex. : vider l'aperçu graphique du pli 2 s plus tard
    setTimeout(async () => {
      const meneRef = doc(db, "rooms", roomId, "menes", String(currentMeneId.value));
      await updateDoc(meneRef, { currentPliCards: [] });
    }, 2000);
  }
}



// Echange du 7 transaction Firestore.
async function tryExchangeSeven(uid: string) {
  await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef);
    const d = snap.data();
    if (!d) throw new Error('Room introuvable');

    const handArr   = d.hands[uid] as string[]; // ["A♣", "7♥", …]
    const trumpSuit = d.trump as Suit;
    const trumpCard = d.trumpCard as Card | string;

    const { newHand, newTrumpCard, exchanged } =
      exchangeSevenTrump(handArr, trumpSuit, trumpCard);

    if (!exchanged) return;      // rien à faire, on sort de la transaction

    tx.update(roomRef, {
      [`hands.${uid}`] : newHand,
      trumpCard        : newTrumpCard   // stocké sous forme d’objet {rank,suit}
    });
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
/*---------------------------------DETECTION----------------------------*/
/* -------- types -------- */
type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
interface Card { rank: Rank; suit: Suit }
interface Combination { name: string; points: number; cards: Card[] }

/* -------- aide -------- */
const order: Rank[] = ['7','8','9','J','Q','K','10','A'];
const isTrump = (card: Card, trump: Suit) => card.suit === trump;

/* -------- détection -------- */
function detectCombinations(
  all: Card[],
  trump: Suit,
  existing: Combination[] = []
): Combination[] {
  const combos: Combination[] = [];
  const byRank: Record<Rank, Card[]> =
    { '7':[], '8':[], '9':[], '10':[], 'J':[], 'Q':[], 'K':[], 'A':[] };
  all.forEach(c => byRank[c.rank].push(c));

  const toKey = (cs: Card[]) =>
    cs.map(c => `${c.rank}${c.suit}`).sort().join('-');
  const already = new Set(existing.map(c => toKey(c.cards)));
  const pushIfNew = (c: Combination) => { if (!already.has(toKey(c.cards))) combos.push(c); };

  /* 4-as / 4-rois / … */
  const fourMap = { A:100, K:80, Q:60, J:40 } as const;
  (['A','K','Q','J'] as Rank[]).forEach(r => {
    if (byRank[r].length >= 4)
      pushIfNew({ name:`4 ${r}`, points: fourMap[r], cards: byRank[r].slice(0,4) });
  });

  /* mariages */
  ['♠','♥','♦','♣'].forEach(s => {
    const king = all.find(c => c.rank==='K' && c.suit===s);
    const queen= all.find(c => c.rank==='Q' && c.suit===s);
    if (king && queen) {
      const atout = s === trump ? ' d’atout' : '';
      pushIfNew({
        name:`Mariage ${s}${atout}`,
        points: s===trump ? 40 : 20,
        cards:[king,queen]
      });
    }
  });

  /* suites */
  ['♠','♥','♦','♣'].forEach(s => {
    const suite = ['J','Q','K','10','A'].map(r => all.find(c => c.rank===r && c.suit===s));
    if (suite.every(Boolean)) {
      const atout = s === trump ? ' d’atout' : '';
      pushIfNew({
        name:`Suite ${s}${atout}`,
        points: s===trump ? 250 : 150,
        cards: suite as Card[]
      });
    }
  });

  /* Dame♠ + Valet♦ */
  const qs = all.filter(c => c.rank==='Q' && c.suit==='♠');
  const jd = all.filter(c => c.rank==='J' && c.suit==='♦');
  const pairs = Math.min(qs.length, jd.length);
  if (pairs >= 1)
    pushIfNew({ name:'Dame♠+Valet♦', points:40, cards:[qs[0],jd[0]] });
  if (pairs >= 2)
    pushIfNew({ name:'2×(Dame♠+Valet♦)', points:500, cards:[qs[0],jd[0],qs[1],jd[1]] });

  return combos;
}

/**
 * Échange éventuel du 7 d’atout avec la trumpCard.
 *
 * @param hand        main du joueur (array de STRING, ex. "7♥")
 * @param trump       couleur d’atout
 * @param trumpCard   carte exposée (Card OU string)
 *
 * @returns { newHand, newTrumpCard, exchanged }
 */
function exchangeSevenTrump(
  hand: string[],
  trump: Suit,
  trumpCard: Card | string
): { newHand: string[]; newTrumpCard: Card; exchanged: boolean } {
  /* 1️⃣ normaliser trumpCard en objet Card */
  const tcObj = typeof trumpCard === 'string' ? strToCard(trumpCard) : trumpCard;

  /* 2️⃣ le 7 d’atout est-il dans la main ? */
  const sevenStr = `7${trump}` as const;
  const sevenIdx  = hand.indexOf(sevenStr);

  /* 3️⃣ la trumpCard est-elle un J/Q/K/10/A ? */
  const eligible = ['J','Q','K','10','A'] as const;
  const canExchange = sevenIdx !== -1 && eligible.includes(tcObj.rank);

  if (!canExchange) {
    /* aucun échange possible → on renvoie des copies inchangées */
    return {
      newHand: [...hand],
      newTrumpCard: { ...tcObj },
      exchanged: false,
    };
  }

  /* 4️⃣ construire la nouvelle main et la nouvelle trumpCard */
  const newHand = [...hand];
  newHand.splice(sevenIdx, 1);               // retire le 7 d’atout
  newHand.push(cardToStr(tcObj));            // ajoute l’ancienne trumpCard

  const newTrumpCard: Card = { rank: '7', suit: trump };

  return { newHand, newTrumpCard, exchanged: true };
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
