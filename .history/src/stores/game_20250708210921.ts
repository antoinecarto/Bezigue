// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";
// import type { Combination } from "@/game/BezigueGame";
import type { Combination } from "@/core/rules/detectCombinations";

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

  // src/stores/game.ts
  async function addToMeld(uid: string, code: string) {
    if (!room.value || room.value.phase !== "meld") return;

    /* 🔸 1. MISE À JOUR LOCALE IMMÉDIATE ----------------------- */
    const localHand = hand.value;
    const i = localHand.indexOf(code);
    if (i !== -1) localHand.splice(i, 1); // retire de la main

    if (!melds.value[uid]) melds.value[uid] = [];
    melds.value[uid].push(code); // ajoute dans la meld
    /* --------------------------------------------------------- */

    const roomRef = doc(db, "rooms", room.value.id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;

      /* sécurité côté serveur */
      const srvHand = [...(d.hands[uid] ?? [])];
      const idx = srvHand.indexOf(code);
      if (idx === -1) return; // carte déjà enlevée ailleurs

      srvHand.splice(idx, 1);
      const srvMeld = [...(d.melds?.[uid] ?? []), code];

      tx.update(roomRef, {
        [`hands.${uid}`]: srvHand,
        [`melds.${uid}`]: srvMeld,
      });
    }).catch(() => {
      /* rollback local en cas d’erreur */
      melds.value[uid] = melds.value[uid].filter((c) => c !== code);
      hand.value.splice(i === -1 ? 0 : i, 0, code);
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

  function resolveTrick(
    first: string,
    second: string,
    firstUid: string,
    secondUid: string,
    trump: Suit
  ): string {
    const a = splitCode(first); // { rank, suit }
    const b = splitCode(second);

    // 1) même couleur → plus haute l’emporte
    if (a.suit === b.suit) {
      return RANK_ORDER[a.rank] >= RANK_ORDER[b.rank] ? firstUid : secondUid;
    }

    // 2) couleurs diff. : atout > non‑atout
    if (a.suit === trump && b.suit !== trump) return firstUid;
    if (b.suit === trump && a.suit !== trump) return secondUid;

    // 3) couleurs diff., pas d’atout → le meneur gagne
    return firstUid;
  }

  async function playCard(code: string) {
    if (
      playing.value ||
      !room.value ||
      room.value.phase !== "play" ||
      !myUid.value ||
      room.value.currentTurn !== myUid.value
    )
      return;

    const roomRef = doc(db, "rooms", room.value.id);
    playing.value = true;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        /* ─── enlève la carte de la main serveur ─── */
        const srvHand = [...(d.hands[myUid.value] ?? [])];
        const pos = srvHand.indexOf(code);
        if (pos === -1) throw new Error("Card not in hand server");
        srvHand.splice(pos, 1);

        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), myUid.value];
        const opponent = d.players.find((p) => p !== myUid.value)!;

        const update: Record<string, any> = {
          [`hands.${myUid.value}`]: srvHand,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [myUid.value]: code },
        };

        /* ───────── 1re carte ───────── */
        if (cards.length === 1) {
          update.currentTurn = opponent;
        } else {
          /* ───────── 2e carte : on résout le pli ───────── */
          // trump est le dernier caractère de trumpCard, ex. "♣", "♦", …
          const trumpSuit = d.trumpCard.slice(-1) as Suit;
          const winner = resolveTrick(
            cards[0],
            cards[1],
            players[0],
            players[1],
            trumpSuit
          );
          const loser = players.find((p) => p !== winner)!;

          /* points : +10 pour chaque 10 ou As du pli */
          const points = cards.reduce(
            (acc, c) =>
              ["10", "A"].includes(splitCode(c).rank) ? acc + 10 : acc,
            0
          );
          if (points) {
            update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
          }

          /* réinitialise le pli */
          update.trick = { cards: [], players: [] };
          update.exchangeTable = {};
          update.currentTurn = winner;

          /* file de pioche si <9 cartes (winner puis loser) */
          const prospective = { ...d.hands, [myUid.value]: srvHand };
          const needs = (u: string) =>
            (prospective[u]?.length ?? 0) + (d.melds?.[u]?.length ?? 0) < 9;
          const drawQueue: string[] = [];
          if (needs(winner)) drawQueue.push(winner);
          if (needs(loser)) drawQueue.push(loser);

          /* on passe toujours en phase 'meld' (drawQueue peut être vide) */
          update.phase = "meld";
          update.drawQueue = drawQueue;
        }

        tx.update(roomRef, update);
      });
    } finally {
      playing.value = false;
    }
  }

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
    getCombos,
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
