// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";
import type { Combination } from "@/game/BezigueGame";

/* ───────── helpers rang & couleur ───────── */
const RANK_ORDER: Record<string, number> = {
  "7": 1,
  "8": 2,
  "9": 3,
  J: 4,
  Q: 5,
  K: 6,
  "10": 7,
  A: 8,
};

const HIGH_SCORE_RANKS = new Set(["10", "A"]); // 10 pts par carte 10 ou As

interface ParsedCard {
  suit: Suit;
  rank: number;
  rankStr: string; // ← nouveau champ
}

function parseCard(code: string): ParsedCard {
  const [rankStr, suit] = code.split("_") as [string, Suit];
  return { suit, rank: RANK_ORDER[rankStr], rankStr }; // ← rankStr stocké
}

function splitCode(code: string) {
  const [rankSuit] = code.split("_");
  return {
    rank: rankSuit.slice(0, -1),
    suit: rankSuit.slice(-1) as Suit,
  } as const;
}
function compareCards(a: string, b: string, trump: Suit, lead: Suit) {
  const ca = splitCode(a);
  const cb = splitCode(b);
  if (ca.suit === cb.suit) return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank];
  if (ca.suit === trump && cb.suit !== trump) return 1;
  if (cb.suit === trump && ca.suit !== trump) return -1;
  if (ca.suit === lead && cb.suit !== lead) return 1;
  if (cb.suit === lead && ca.suit !== lead) return -1;
  return 0;
}

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const melds = ref<Record<string, string[]>>({});
  const exchangeTable = ref<Record<string, string>>({});
  const scores = ref<Record<string, number>>({});
  const combos = ref<Record<string, Combination[]>>({});

  const loading = ref(true);
  const drawInProgress = ref(false);
  const playing = ref(false); // verrou anti double‑clic

  /* ──────────── getters ──────────── */
  const trumpSuit = computed(
    () => (room.value?.trumpCard.slice(-1) as Suit) ?? "♠"
  );
  const currentTurn = computed(() => room.value?.currentTurn ?? null);
  const canDraw = computed(
    () =>
      room.value?.phase === "draw" &&
      room.value.drawQueue?.[0] === myUid.value &&
      !drawInProgress.value
  );

  const getMeldArea = (uid: string) => melds.value[uid] ?? [];
  const getMeld = (uid: string) => melds.value[uid] ?? [];
  const getExchange = computed(() => exchangeTable.value);
  const getScore = (uid: string) => scores.value[uid] ?? 0;

  /* ─────────── helpers ─────────── */
  function _subscribeRoom(roomId: string) {
    return onSnapshot(doc(db, "rooms", roomId), (snap) => {
      loading.value = false;
      if (!snap.exists()) {
        room.value = null;
        return;
      }
      const data = snap.data() as RoomDoc;
      room.value = { id: snap.id, ...data };
      if (myUid.value) hand.value = data.hands?.[myUid.value] ?? [];
      melds.value = { ...data.melds };
      exchangeTable.value = { ...(data.exchangeTable ?? {}) };
      scores.value = { ...(data.scores ?? {}) };
      combos.value = { ...(data.combos ?? {}) };
    });
  }

  const getCombos = (uid: string) => combos.value[uid] ?? [];

  /* ──────────── actions ──────────── */
  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });
    hand.value = [...newHand];
  }

  async function addToMeld(uid: string, code: string) {
    if (!room.value || room.value.phase !== "meld") return;
    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;

      const hand = [...(d.hands[uid] ?? [])];
      const idx = hand.indexOf(code);
      if (idx === -1) throw new Error("Card not in hand");
      hand.splice(idx, 1);

      const newMeld = [...(d.melds?.[uid] ?? []), code];

      tx.update(roomRef, {
        [`hands.${uid}`]: hand,
        [`melds.${uid}`]: newMeld,
      });
    });
  }

  async function drawCard() {
    if (!canDraw.value || !room.value || !myUid.value) return;
    const roomRef = doc(db, "rooms", room.value.id);
    drawInProgress.value = true;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;
        if (d.phase !== "draw" || d.drawQueue[0] !== myUid.value)
          throw new Error("Not your draw turn");

        const deck = [...d.deck];
        if (!deck.length) throw new Error("Deck empty");
        const card = deck.shift()!;
        const newHand = [...(d.hands[myUid.value] ?? []), card];
        const newQueue = d.drawQueue.slice(1);
        //
        /* drawCard ------------------------------------------------------------ */
        const update: Record<string, any> = {
          deck,
          [`hands.${myUid.value}`]: newHand,
          drawQueue: newQueue,
        };
        if (!newQueue.length) {
          update.phase = "play";
          update.currentTurn = d.currentTurn; // ↩︎ force le tour correct
        }
        tx.update(roomRef, update);

        // mise à jour optimiste localement
        hand.value = [...newHand];
      });
    } finally {
      drawInProgress.value = false;
    }
  }
  async function playCard(code: string) {
    if (
      playing.value ||
      !room.value ||
      room.value.phase !== "play" ||
      !myUid.value
    )
      return;
    if (room.value.currentTurn !== myUid.value) return;

    const roomRef = doc(db, "rooms", room.value.id);
    playing.value = true;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        // Vérifie que le pli n'est pas complet
        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        // Supprime la carte jouée de la main côté serveur
        const srvHand = [...(d.hands[myUid.value] ?? [])];
        const idx = srvHand.indexOf(code);
        if (idx === -1) throw new Error("Card not in hand server");
        srvHand.splice(idx, 1);

        // Met à jour cartes et joueurs dans le pli en cours
        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), myUid.value];

        // Trouve l'adversaire
        const opponent = d.players.find((p) => p !== myUid.value)!;

        // Prépare update partiel
        const update: Record<string, any> = {
          [`hands.${myUid.value}`]: srvHand,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [myUid.value]: code },
        };

        if (cards.length === 1) {
          // Premier joueur a joué : c'est au tour de l'adversaire
          update.currentTurn = opponent;
        } else if (cards.length === 2) {
          // Deuxième joueur a joué : on détermine le gagnant du pli

          // ATTENTION : Assure-toi que cards[0] est la carte de players[0], idem pour cards[1]
          const winner = resolveTrick(
            cards[0],
            cards[1],
            players[0],
            players[1],
            d.trumpSuit as Suit
          );

          const loser = players.find((p) => p !== winner)!;

          // Calcule les points du pli
          const points = cards.reduce((acc, c) => {
            const rk = splitCode(c).rank; // '7','8','9','10','J','Q','K','A'
            return HIGH_SCORE_RANKS.has(rk) ? acc + 10 : acc;
          }, 0);

          if (points) {
            update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
          }

          // Reset pli et zone d'échange
          update.trick = { cards: [], players: [] };
          update.exchangeTable = {};

          // Le gagnant joue le prochain tour
          update.currentTurn = winner;

          // Vérifie si les joueurs doivent piocher (moins de 9 cartes)
          const prospectiveHands = { ...d.hands, [myUid.value]: srvHand };
          const needsCard = (u: string) =>
            (prospectiveHands[u]?.length ?? 0) + (d.melds?.[u]?.length ?? 0) <
            9;

          const newQueue: string[] = [];
          if (needsCard(winner)) newQueue.push(winner);
          if (needsCard(loser)) newQueue.push(loser);

          if (newQueue.length && d.deck.length) {
            update.phase = "draw";
            update.drawQueue = newQueue; // ordre gagnant puis perdant
          } else {
            // Sinon on reste en phase "play"
            update.phase = "play";
          }
        }

        tx.update(roomRef, update);
      });
    } finally {
      playing.value = false;
    }
  }

  //

  // async function playCard(code: string) {
  //   if (
  //     playing.value ||
  //     !room.value ||
  //     room.value.phase !== "play" ||
  //     !myUid.value
  //   )
  //     return;
  //   if (room.value.currentTurn !== myUid.value) return;

  //   const uid = myUid.value;
  //   const roomRef = doc(db, "rooms", room.value.id);
  //   playing.value = true;
  //   try {
  //     await runTransaction(db, async (tx) => {
  //       const snap = await tx.get(roomRef);
  //       if (!snap.exists()) throw new Error("Room missing");
  //       const d = snap.data() as RoomDoc;
  //       if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

  //       const srvHand = [...(d.hands[uid] ?? [])];
  //       const idxSrv = srvHand.findIndex(
  //         (c) => c.split("_")[0] === code.split("_")[0]
  //       );
  //       if (idxSrv === -1) throw new Error("Card not in hand server");
  //       const serverCard = srvHand[idxSrv];
  //       srvHand.splice(idxSrv, 1);

  //       const cards = [...(d.trick.cards ?? []), serverCard];
  //       const players = [...(d.trick.players ?? []), uid];
  //       const opponent = d.players.find((p) => p !== uid);

  //       const update: Record<string, any> = {
  //         [`hands.${uid}`]: srvHand,
  //         trick: { cards, players },
  //         exchangeTable: { ...(d.exchangeTable ?? {}), [uid]: serverCard },
  //       };

  //       if (cards.length === 1 && opponent) {
  //         update.currentTurn = opponent; // adversaire joue la 2ᵉ carte
  //       }

  //       if (cards.length === 2) {
  //         const leadSuit = splitCode(cards[0]).suit;
  //         const winner =
  //           compareCards(cards[0], cards[1], leadSuit, d.trumpSuit as Suit) >= 0
  //             ? players[0]
  //             : players[1];
  //         const loser = players.find((p) => p !== winner);

  //         update.currentTurn = winner;
  //         update.trick = { cards: [], players: [] };
  //         update.exchangeTable = {}; // reset table

  //         // ---------------- PI O C H E -------------------------------------------
  //         const prospectiveHands = { ...d.hands, [uid]: srvHand }; // main après retrait

  //         const needsCard = (u: string) =>
  //           (prospectiveHands[u]?.length ?? 0) + (d.melds?.[u]?.length ?? 0) <
  //           9;

  //         const newQueue: string[] = [];
  //         if (needsCard(winner)) newQueue.push(winner);
  //         if (loser && needsCard(loser)) newQueue.push(loser);

  //         if (newQueue.length && d.deck.length) {
  //           update.phase = "draw";
  //           update.drawQueue = newQueue; // winner pioche d’abord, puis loser
  //         }
  //       }
  //       tx.update(roomRef, update);
  //     });
  //   } finally {
  //     playing.value = false;
  //   }
  // }

  async function joinRoom(roomId: string, uid: string, playerName: string) {
    myUid.value = uid;

    /* 1️⃣ — transaction pour s’enregistrer — */
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;

      /* déjà dedans → rien à faire */
      if (d.players.includes(uid)) return;

      /* salle pleine → refuse l’entrée  */
      if (d.players.length >= 2) throw new Error("Room already full");

      /* récupère la main réservée et prépare les updates */
      const seat2Hand = d.reservedHands?.seat2 ?? [];
      const updates: Record<string, any> = {
        players: [...d.players, uid],
        [`playerNames.${uid}`]: playerName,
        [`hands.${uid}`]: seat2Hand,
        [`scores.${uid}`]: 0,
      };

      /* dès qu’on est 2 on peut passer en phase 'play' */
      updates.phase = "play";
      updates.currentTurn = d.currentTurn ?? d.players[0]; // ou tirage au sort

      tx.update(roomRef, updates);
    });

    /* 2️⃣ — s’abonner en temps réel — */
    return _subscribeRoom(roomId);
  }

  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  /** Préfixe "d'" ou "de " selon voyelle */
  const deOuD = (name: string) =>
    /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";

  // helper facultatif
  const RANK_ORDER: Record<string, number> = {
    A: 8,
    "10": 7,
    K: 6,
    Q: 5,
    J: 4,
    "9": 3,
    "8": 2,
    "7": 1,
  };

  interface ParsedCard {
    suit: "C" | "D" | "H" | "S";
    rank: number;
  }

  function parseCard(code: string): ParsedCard {
    const [rankStr, suit] = code.split("_") as [string, ParsedCard["suit"]];
    return { suit, rank: RANK_ORDER[rankStr] };
  }

  function resolveTrick(
    firstCard: string,
    secondCard: string,
    firstUid: string,
    secondUid: string,
    trumpSuit: ParsedCard["suit"]
  ): string {
    const A = parseCard(firstCard);
    const B = parseCard(secondCard);

    const trumpA = A.suit === trumpSuit;
    const trumpB = B.suit === trumpSuit;

    // même couleur (atout ou non) → plus forte carte
    if (A.suit === B.suit) return A.rank >= B.rank ? firstUid : secondUid;

    // une seule carte est atout → l'atout gagne
    if (trumpA) return firstUid;
    if (trumpB) return secondUid;

    // couleurs différentes, pas d'atout → le meneur gagne
    return firstUid;
  }

  /* ───────── expose ───────── */
  return {
    // state
    room,
    myUid,
    hand,
    melds,
    exchangeTable,
    loading,
    playing,

    // getters
    trumpSuit,
    canDraw,
    currentTurn,
    getExchange,

    // actions
    getScore,
    getMeldArea,
    updateHand,
    addToMeld,
    playCard,
    drawCard,
    dropToMeld,
    joinRoom,
    deOuD,
    getMeld,
    resolveTrick,
  };
});
