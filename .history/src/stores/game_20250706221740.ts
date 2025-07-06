// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
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

  const loading = ref(true);
  const showExchange = ref(false);
  const drawInProgress = ref(false);
  const playing = ref(false); // verrou anti‑double‑clic

  /* ──────────── getters ──────────── */
  const trumpSuit = computed(
    () => (room.value?.trumpCard.slice(-1) as Suit) ?? "♠"
  );
  const canDraw = computed(
    () =>
      room.value?.phase === "draw" &&
      room.value.drawQueue?.[0] === myUid.value &&
      !drawInProgress.value
  );
  const currentTurn = computed(() => room.value?.currentTurn ?? null);

  const getMeldArea = (uid: string) => melds.value[uid] ?? [];
  const getMeld = (uid: string) => melds.value[uid] ?? [];
  const getExchange = computed(() => exchangeTable.value);

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
    });
  }

  /* ──────────── actions ──────────── */
  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    const roomRef = doc(db, "rooms", room.value.id);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");
      tx.update(roomRef, { [`hands.${myUid.value}`]: newHand });
    });
    hand.value = [...newHand];
  }

  async function addToMeld(uid: string, code: string) {
    if (!room.value) return;
    const roomRef = doc(db, "rooms", room.value.id);

    // optimistic local update
    const idx = hand.value.indexOf(code);
    if (idx !== -1) hand.value.splice(idx, 1);
    melds.value[uid] = [...getMeld(uid), code];

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const d = snap.data() as RoomDoc;
      const srvHand = [...(d.hands[uid] ?? [])];
      const pos = srvHand.indexOf(code);
      if (pos === -1) throw new Error("Card not in hand (server)");
      srvHand.splice(pos, 1);
      const srvMeld = [...(d.melds?.[uid] ?? []), code];
      tx.update(roomRef, {
        [`hands.${uid}`]: srvHand,
        [`melds.${uid}`]: srvMeld,
      });
    });
  }

  /* ─────────── playCard & pli ─────────── */
  async function playCard(code: string) {
    if (playing.value) return;
    if (!room.value || room.value.phase !== "play" || !myUid.value) return;
    const uid = myUid.value;
    if (room.value.currentTurn !== uid) return;

    const roomRef = doc(db, "rooms", room.value.id);
    playing.value = true;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        const srvHand = [...(d.hands[uid] ?? [])];
        const idxSrv = srvHand.findIndex(
          (c) => c.split("_")[0] === code.split("_")[0]
        );
        if (idxSrv === -1) throw new Error("Card not in hand server");
        const serverCard = srvHand[idxSrv];
        srvHand.splice(idxSrv, 1);

        const cards = [...(d.trick.cards ?? []), serverCard];
        const players = [...(d.trick.players ?? []), uid];
        const opponent = d.players.find((p: string) => p !== uid);

        const update: Record<string, any> = {
          [`hands.${uid}`]: srvHand,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [uid]: serverCard },
        };

        /* ---- Si 1 carte : on passe simplement la main à l'adversaire ---- */
        if (cards.length === 1 && opponent) {
          update.currentTurn = opponent;
        }

        if (cards.length === 2) {
          const leadSuit = splitCode(cards[0]).suit;
          const winner =
            compareCards(cards[0], cards[1], d.trumpSuit as Suit, leadSuit) >= 0
              ? players[0]
              : players[1];
          const loser = players.find((p) => p !== winner);

          update.currentTurn = winner; // le gagnant garde la main
          update.trick = { cards: [], players: [] };
          update.exchangeTable = {}; // reset table échange

          let deckRest = d.deck ?? [];

          const giveCard = (who: string, currentHand: string[]) => {
            const meldCount = d.melds?.[who]?.length ?? 0;
            const total = currentHand.length + meldCount; // hand + meld
            if (total < 9 && deckRest.length) {
              const drawn = deckRest[0];
              deckRest = deckRest.slice(1);
              update[`hands.${who}`] = [...currentHand, drawn];
            }
          };

          // main déjà modifiée pour winner (srvHand) — on récupère la main actuelle
          giveCard(winner, srvHand);
          if (loser) giveCard(loser, d.hands[loser] ?? []);

          update.deck = deckRest;
        }

        tx.update(roomRef, update);
      });
    } finally {
      playing.value = false;
    }
  }

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
    getMeldArea,
    getExchange,

    // actions
    updateHand,
    addToMeld,
    playCard,
    dropToMeld,
    joinRoom,
    deOuD,
    getMeld,
  };
});
