// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";

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
  const scores = ref<Record<string, number>>({}); // ← nouveau ref

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
    });
  }

  /* ──────────── actions ──────────── */
  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });
    hand.value = [...newHand];
  }

  async function addToMeld(uid: string, code: string) {
    if (
      !room.value ||
      room.value.phase !== "play" ||
      room.value.currentTurn !== uid
    )
      return;
    const roomRef = doc(db, "rooms", room.value.id);
    const idx = hand.value.indexOf(code);
    if (idx !== -1) hand.value.splice(idx, 1);
    melds.value[uid] = [...getMeld(uid), code];

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;
      const srvHand = [...(d.hands[uid] ?? [])];
      const pos = srvHand.indexOf(code);
      if (pos === -1) throw new Error("Card not in hand server");
      srvHand.splice(pos, 1);
      const srvMeld = [...(d.melds?.[uid] ?? []), code];
      tx.update(roomRef, {
        [`hands.${uid}`]: srvHand,
        [`melds.${uid}`]: srvMeld,
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
  //
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
        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        // — supprime la carte de la main serveur —
        const srvHand = [...(d.hands[myUid.value] ?? [])];
        const idx = srvHand.indexOf(code);
        if (idx === -1) throw new Error("Card not in hand server");
        srvHand.splice(idx, 1);

        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), myUid.value];
        const opponent = d.players.find((p) => p !== myUid.value)!;

        const update: Record<string, any> = {
          [`hands.${myUid.value}`]: srvHand,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [myUid.value]: code },
        };

        if (cards.length === 1) {
          update.currentTurn = opponent; // l'autre joue la 2ᵉ carte
        } else if (cards.length === 2) {
          const winner = resolveTrick(
            cards[0],
            cards[1],
            players[0],
            players[1],
            d.trumpSuit as Suit
          );
          const loser = players.find((p) => p !== winner)!;
          /* ———💯 CALCUL DES POINTS 💯—————————————— */
          const points = cards.reduce((acc, c) => {
            const rk = splitCode(c).rank; // '7','8','9','10','J','Q','K','A'
            return HIGH_SCORE_RANKS.has(rk) ? acc + 10 : acc;
          }, 0);

          if (points) {
            update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
          }

          // ——— suite logique du pli ———

          update.currentTurn = winner;
          update.trick = { cards: [], players: [] };
          update.exchangeTable = {};

          // ——— PI O C H E ———
          const prospectiveHands = { ...d.hands, [myUid.value]: srvHand };
          const needsCard = (u: string) =>
            (prospectiveHands[u]?.length ?? 0) + (d.melds?.[u]?.length ?? 0) <
            9;

          const newQueue: string[] = [];
          if (needsCard(winner)) newQueue.push(winner);
          if (needsCard(loser)) newQueue.push(loser);

          if (newQueue.length && d.deck.length) {
            update.phase = "draw";
            update.drawQueue = newQueue; // winner puis loser
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

  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
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
