import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";
import type { Combination } from "@/core/rules/detectCombinations";

/* ── RANG UNIQUE & PARTAGÉ ─────────────────────────────────────────── */
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

const HIGH_SCORE_RANKS = new Set(["10", "A"]);

interface ParsedCard {
  suit: Suit;
  rank: number;
  rankStr: string;
}

function splitCode(code: string): { rank: string; suit: Suit } {
  const [rank, suit] = code.split("_") as [string, Suit];
  return { rank, suit };
}

export const useGameStore = defineStore("game", () => {
  /* ─ state ─ */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const melds = ref<Record<string, string[]>>({});
  const exchangeTable = ref<Record<string, string>>({});
  const scores = ref<Record<string, number>>({});
  const combos = ref<Record<string, Combination[]>>({});

  const loading = ref(true);
  const drawInProgress = ref(false);
  const playing = ref(false);

  /* ─ getters ─ */
  const currentTurn = computed(() => room.value?.currentTurn ?? null);
  const canDraw = computed(
    () =>
      room.value?.phase === "draw" &&
      room.value.drawQueue?.[0] === myUid.value &&
      !drawInProgress.value
  );

  const getMeld = (uid: string) => melds.value[uid] ?? [];
  const getExchange = () => exchangeTable.value;
  const getScore = (uid: string) => scores.value[uid] ?? 0;
  const getCombos = (uid: string) => combos.value[uid] ?? [];

  /* ─ helpers ─ */
  function splitCodeFull(code: string): ParsedCard {
    const { rank, suit } = splitCode(code);
    return { suit, rank: RANK_ORDER[rank] ?? 0, rankStr: rank };
  }

  function getMeldCombos(uid: string): Combination[] {
    return combos.value[uid] ?? [];
  }

  function getMeldTags(uid: string): Record<string, string[]> {
    const tags: Record<string, string[]> = {};
    const meldCombos = getMeldCombos(uid);
    meldCombos.forEach((combo) => {
      combo.cards.forEach((card) => {
        if (!tags[card]) tags[card] = [];
        tags[card].push(combo.type);
      });
    });
    return tags;
  }

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

  /* ─ actions ─ */
  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });
    hand.value = [...newHand];
  }

  async function applyCombo(
    roomId: string,
    uid: string,
    combo: { id: string; type: string; cards: string[]; points: number }
  ) {
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const data = snap.data();
      const meldsTags = { ...(data.meldsTags ?? {}) };
      const playerTags = { ...(meldsTags[uid] ?? {}) };
      combo.cards.forEach((cardCode) => {
        playerTags[cardCode] = combo.type;
      });
      meldsTags[uid] = playerTags;
      const newScores = { ...(data.scores ?? {}) };
      newScores[uid] = (newScores[uid] || 0) + combo.points;
      tx.update(roomRef, { meldsTags, scores: newScores });
    });
  }

  async function addToMeld(uid: string, code: string) {
    if (!room.value || room.value.phase !== "meld") return;
    if (!hand.value.includes(code)) return;
    hand.value = hand.value.filter((c) => c !== code);
    melds.value = {
      ...melds.value,
      [uid]: [...(melds.value[uid] ?? []), code],
    };

    const roomRef = doc(db, "rooms", room.value.id);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room not found");
        const d = snap.data() as RoomDoc;
        const srvHand = [...(d.hands[uid] ?? [])];
        const srvMeld = [...(d.melds?.[uid] ?? [])];
        const srvScores = { ...(d.scores ?? {}) };

        const alreadyInMeld = srvMeld.includes(code);
        const idxInHand = srvHand.indexOf(code);
        if (alreadyInMeld) return;
        if (idxInHand !== -1) {
          srvHand.splice(idxInHand, 1);
          srvMeld.push(code);
          // scoring hors combo : +10 pour As ou 10
          const score = HIGH_SCORE_RANKS.has(splitCode(code).rank) ? 10 : 0;
          srvScores[uid] = (srvScores[uid] ?? 0) + score;
          tx.update(roomRef, {
            [`hands.${uid}`]: srvHand,
            [`melds.${uid}`]: srvMeld,
            [`scores.${uid}`]: srvScores[uid],
          });
          return;
        }
        throw new Error("Card missing in server hand");
      });
    } catch (err) {
      console.error(err);
      hand.value = [...hand.value, code];
      melds.value = {
        ...melds.value,
        [uid]: (melds.value[uid] ?? []).filter((c) => c !== code),
      };
    }
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
        const update: Record<string, any> = {
          deck,
          [`hands.${myUid.value}`]: newHand,
          drawQueue: newQueue,
        };
        if (!newQueue.length) {
          update.phase = "play";
          update.currentTurn = d.currentTurn;
        }
        tx.update(roomRef, update);
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
    const a = splitCode(first);
    const b = splitCode(second);
    const rankA = RANK_ORDER[a.rank] ?? 0;
    const rankB = RANK_ORDER[b.rank] ?? 0;
    if (a.suit === b.suit) {
      return rankA >= rankB ? firstUid : secondUid;
    }
    if (a.suit === trump && b.suit !== trump) return firstUid;
    if (b.suit === trump && a.suit !== trump) return secondUid;
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
        if (cards.length === 1) {
          update.currentTurn = opponent;
        } else {
          const trumpSuit = splitCode(d.trumpCard).suit;
          const winner = resolveTrick(
            cards[0],
            cards[1],
            players[0],
            players[1],
            trumpSuit
          );
          const loser = players.find((p) => p !== winner)!;
          const points = cards.reduce(
            (acc, c) =>
              HIGH_SCORE_RANKS.has(splitCode(c).rank) ? acc + 10 : acc,
            0
          );
          if (points) {
            update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
          }
          update.trick = { cards: [], players: [] };
          update.currentTurn = winner;
        }
        tx.update(roomRef, update);
        hand.value = srvHand;
      });
    } catch (err) {
      console.error(err);
    } finally {
      playing.value = false;
    }
  }

  async function joinRoom(roomId: string, uid: string, playerName: string) {
    myUid.value = uid;
    const roomRef = doc(db, "rooms", roomId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;
      if (d.players.includes(uid)) return;
      if (d.players.length >= 2) throw new Error("Room already full");
      const seat2Hand = d.reservedHands?.seat2 ?? [];
      const updates: Record<string, any> = {
        players: [...d.players, uid],
        [`playerNames.${uid}`]: playerName,
        [`hands.${uid}`]: seat2Hand,
        [`scores.${uid}`]: 0,
      };
      updates.phase = "play";
      updates.currentTurn = d.currentTurn ?? d.players[0];
      tx.update(roomRef, updates);
    });
    return _subscribeRoom(roomId);
  }

  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  const deOuD = (name: string) =>
    /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";

  return {
    room,
    myUid,
    hand,
    melds,
    exchangeTable,
    loading,
    playing,
    canDraw,
    currentTurn,
    deOuD,
    getExchange,
    getScore,
    getMeld,
    getCombos,
    updateHand,
    addToMeld,
    playCard,
    drawCard,
    dropToMeld,
    joinRoom,
    resolveTrick,
    applyCombo,
    getMeldTags,
  };
});
