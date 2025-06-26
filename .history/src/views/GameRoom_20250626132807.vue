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
            class="card border-2 border-green-700 px-4 py-2 rounded shadow text-2xl bg-white mb-2":class="getCardColor(trumpCard)"
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

    //


    //

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
              :class="getCardColor(cardToStr(c))"
            >
              {{ cardToStr(c) }}
            </div>
          </template>
        </div>

        <span v-else class="text-[10px] italic text-gray-400">Aucune</span>
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
  updateDoc,
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
//

//

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

});

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

const localHand = computed<string[]>(() =>
  uid.value ? roomData.value?.hands?.[uid.value] ?? [] : []
);

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

async function playCombination(combo: Combination) {
  if (!uid.value) return

  await runTransaction(db, async tx => {
    const snap = await tx.get(roomRef)
    const d = snap.data()
    if (!d) throw new Error('Room introuvable')

    /* 1️⃣  vérifs */
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
    const melds = d.melds ?? {}
    melds[uid.value] = [...(melds[uid.value] ?? []), combo]

    /* 4️⃣  scorer */
    const scores = d.scores ?? {}
    scores[uid.value] = (scores[uid.value] ?? 0) + combo.points

    /* 5️⃣  canMeld = null pour bloquer d’autres poses ce pli */
    tx.update(roomRef, {
      [`hands.${uid.value}`] : newHand,
      [`melds.${uid.value}`] : melds[uid.value],
      scores,
      canMeld: null
    })
  })

  showComboPopup.value = false
}


/* ──────────  clic sur une carte  ────────── */
async function playCard(card: string) {
  if (!uid.value || !roomData.value) return;

  /* 1. sécurité : bon tour + carte présente */
  if (currentTurn.value !== uid.value) {
    alert("Ce n'est pas votre tour.");
    return;
  }
  if (!roomData.value.hands[uid.value].includes(card)) {
    alert("Vous ne possédez pas cette carte.");
    return;
  }
  


  const pliComplet = await runTransaction(db, async (tx) => {
  
   let isComplete = false;           // ← flag à renvoyer

  /* 2. lecture instantanée */
  const snap = await tx.get(roomRef);
  if (!snap.exists()) throw "La partie n'existe plus";
  const data = snap.data();

  if (data.currentTurn !== uid.value) throw "Tour obsolète";

  /* 3. MAJ main locale */
  const newHand = data.hands[uid.value].filter((c: string) => c !== card);

  /* 4. MAJ du pli (trick) */
  const trick = data.trick ?? { cards: [], players: [] };
  trick.cards.push(card);
  trick.players.push(uid.value);

  /* 5. MAJ du mène  */
  const meneRef = doc(db, "rooms", roomId, "menes", String(currentMeneId.value));
  const meneSnap = await tx.get(meneRef);
  const meneData = meneSnap.exists() ? meneSnap.data() : {};
  const currentPliCards = [...(meneData.currentPliCards ?? []), card];
  tx.set(meneRef, { currentPliCards }, { merge: true });

  /* Objet d’update Firestore */
  const update: any = {
    [`hands.${uid.value}`]: newHand,
    trick
  };

  /* 5. Si 2 cartes dans le pli → résolution */
  if (trick.cards.length === 2) {
    const winnerUid = resolveTrick(
      trick.cards[0],
      trick.cards[1],
      trick.players[0],
      trick.players[1],
      data.trumpCard
    );
    // 2. PIOCHE automatique
    const deck = data.deck ??[]; 
    const hands = data.hands;           // raccourci

     // carte pour le vainqueur
      if (deck.length > 0) {
   const firstDraw = deck.shift();                 // retire 1ʳᵉ carte
   (data.hands[winnerUid] = data.hands[winnerUid] ?? []).push(firstDraw);
 }

 // carte pour l'autre joueur (s'il en reste)
 const loserUid = winnerUid === uid.value ? opponentUid.value : uid.value;
 if (!loserUid) throw 'Adversaire introuvable'           // ← garde de sécurité

/* --- Pioche pour le vainqueur --- */
if (deck.length > 0 && hands[winnerUid].length < 9) {
  const draw = deck.shift()!;       // retire la 1ʳᵉ carte
  hands[winnerUid].push(draw);
}


/* Deuxième pioche pour le perdant (s’il en reste) */
if (deck.length > 0 && hands[loserUid].length < 9) {
  const draw = deck.shift()!;
  hands[loserUid].push(draw);
}                     // loserUid est string ici

    
    /* Exemple de scoring : +10 par 10 ou As du pli */
    const containsPointCard = trick.cards.some(c =>
    ["10", "A"].some(v => c.startsWith(v))
  );
  const scores = data.scores ?? {};
  if (containsPointCard) {
    scores[winnerUid] = (scores[winnerUid] ?? 0) + 10;
  }
  
  /* on ne vide PAS encore le pli ici */
    update.trick       = { cards: [], players: [] };   // <- clé manquante

  update.currentTurn = winnerUid;
  update.scores      = scores;
  update.canMeld     = winnerUid  
  // 5. mettre à jour la pioche + nouvelles mains
  update.deck                      = deck;                      // pioche restante
  update[`hands.${winnerUid}`]     = data.hands[winnerUid];
  update[`hands.${loserUid}`]      = data.hands[loserUid];
  isComplete = true; 
  // update.canMeld = null
  } else {
    /* 6. Sinon on passe juste le tour à l’adversaire */
    update.currentTurn = opponentUid.value;
  }

  tx.update(roomRef, update);
    return isComplete;

});

// Après la transaction réussie, on attend 2 secondes
if (pliComplet) {
  setTimeout(async () => {
    const meneRef = doc(db, "rooms", roomId, "menes", String(currentMeneId.value));
    await updateDoc(meneRef, { currentPliCards: [] });
  }, 2000);
}

  /* 7. MAJ optimiste locale : on voit la carte tout de suite */
  //battleZoneCards.value.push(card);
}

function strToCard(str: string): Card {
  const suit = str.slice(-1) as Suit
  const rank = str.slice(0, str.length - 1) as Rank
  return { rank, suit }
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
function detectCombinations(all: Card[], trump: Suit): Combination[] {
  const combos: Combination[] = [];
  const byRank: Record<Rank, Card[]> =
    { '7':[], '8':[], '9':[], '10':[], 'J':[], 'Q':[], 'K':[], 'A':[] };
  all.forEach(c => byRank[c.rank].push(c));

  /* 4-As, 4-Rois, 4-Dames, 4-Valets */
  const fourMap = { A:100, K:80, Q:60, J:40 } as const;
  (['A','K','Q','J'] as Rank[]).forEach(r => {
    if (byRank[r].length >= 4) combos.push({ name:`4 ${r}`, points: fourMap[r], cards: byRank[r].slice(0,4) });
  });

  /* mariages */
  ['♠','♥','♦','♣'].forEach(s => {
    const king = all.find(c => c.rank==='K' && c.suit===s);
    const queen= all.find(c => c.rank==='Q' && c.suit===s);
    if (king && queen) {
      const atout = s === trump ? ' d’atout' : '';
      combos.push({ name:`Mariage ${s}${atout}`, points: s===trump?40:20, cards:[king,queen]});
    }
  });

  /* suite J-Q-K-10-A */
  ['♠','♥','♦','♣'].forEach(s => {
    const suite = ['J','Q','K','10','A'].map(r => all.find(c => c.rank===r && c.suit===s));
    if (suite.every(Boolean)) {
      const atout = s === trump ? ' d’atout' : '';
      combos.push({ name:`Suite ${s}${atout}`, points: s===trump?250:150, cards: suite as Card[]});
    }
  });

  /* Dame ♠ + Valet ♦ (et doublon) */
  const qs = all.filter(c => c.rank==='Q' && c.suit==='♠');
  const jd = all.filter(c => c.rank==='J' && c.suit==='♦');
  const pairs = Math.min(qs.length, jd.length);
  if (pairs>=1) combos.push({ name:'Dame♠+Valet♦', points:40, cards:[qs[0],jd[0]]});
  if (pairs>=2) combos.push({ name:'2×(Dame♠+Valet♦)', points:500, cards:[qs[0],jd[0],qs[1],jd[1]]});

// 7 d'atout
  const exposedTrumpCard = trumpCard; // ComputedRef

  const sevenTrump = all.find(c => c.rank === '7' && c.suit === trump);

  if (sevenTrump && exposedTrumpCard && exposedTrumpCard.value.suit === trump) {
    const eligibleRanks = ['J', 'Q', 'K', '10', 'A'];
    if (eligibleRanks.includes(exposedTrumpCard.value.rank)) {
      combos.push({
        name: `Échange 7 d’atout contre ${exposedTrumpCard.value.rank} d’atout`,
        points: 10,
        cards: [sevenTrump, exposedTrumpCard.value]
      });
      // gérer l’échange réel ici
    } else {
      combos.push({ name: '7 d’atout', points: 10, cards: [sevenTrump] });
    }
  } else if (sevenTrump) {
    combos.push({ name: '7 d’atout', points: 10, cards: [sevenTrump] });
  }


  return combos;
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
