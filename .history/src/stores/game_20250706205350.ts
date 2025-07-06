// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  doc,
  onSnapshot,
  runTransaction,
  Transaction,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";
import { distributeCards, generateShuffledDeck } from "@/game/BezigueGame";

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
  // "A♠_1" → ["A", "♠"]
  const [rankSuit] = code.split("_");
  const rank = rankSuit.slice(0, -1);
  const suit = rankSuit.slice(-1) as Suit;
  return { rank, suit } as const;
}
function compareCards(a: string, b: string, trump: Suit, lead: Suit) {
  const ca = splitCode(a);
  const cb = splitCode(b);

  if (ca.suit === cb.suit) {
    return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank]; // + => b plus fort
  }
  if (ca.suit === trump && cb.suit !== trump) return 1; // a atout
  if (cb.suit === trump && ca.suit !== trump) return -1;
  if (ca.suit === lead && cb.suit !== lead) return 1; // suit d'attaque gagne
  if (cb.suit === lead && ca.suit !== lead) return -1;
  return 0;
}

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const melds = ref<Record<string, string[]>>({});
  const loading = ref(true);
  const showExchange = ref(false);
  const drawInProgress = ref(false);

  /* ──────────── getters ──────────── */
  const trumpSuit = computed(
    () => (room.value?.trumpCard.slice(-1) as Suit) ?? "♠"
  );
  const canDraw = computed(() => {
    const r = room.value;
    return (
      r &&
      r.phase === "draw" &&
      r.drawQueue?.[0] === myUid.value &&
      !drawInProgress.value
    );
  });
  function getMeldArea(uid: string) {
    return melds.value[uid] ?? [];
  }
  function getMeld(uid: string) {
    return melds.value[uid] ?? [];
  }

  /* ─────────── helpers ─────────── */
  function _subscribeRoom(roomId: string) {
    const roomRef = doc(db, "rooms", roomId);
    return onSnapshot(roomRef, (snap) => {
      loading.value = false;
      if (!snap.exists()) {
        room.value = null;
        return;
      }
      const data = snap.data() as RoomDoc;
      room.value = { id: snap.id, ...data };
      if (myUid.value) hand.value = data.hands?.[myUid.value] ?? [];
      melds.value = { ...data.melds };
    });
  }

  /* ──────────── actions ──────────── */

  async function updateHand(newHand: string[]) {
    if (!room.value || !room.value.id || !myUid.value) return;
    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");

      const data = snap.data() as RoomDoc;

      // Met à jour la main uniquement pour le joueur connecté
      tx.update(roomRef, {
        [`hands.${myUid.value}`]: newHand,
      });

      // Mise à jour locale (optimiste)
      hand.value = [...newHand];
    });
  }

  async function addToMeld(uid: string, code: string) {
    if (!room.value) return;
    const roomRef = doc(db, "rooms", room.value.id);

    // optimistic update local
    const idx = hand.value.indexOf(code);
    if (idx !== -1) hand.value.splice(idx, 1);
    melds.value[uid] = [...getMeld(uid), code];

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room not found");
      const data = snap.data() as RoomDoc;

      const serverHand = [...(data.hands[uid] ?? [])];
      const pos = serverHand.indexOf(code);
      if (pos === -1) throw new Error("Card not in hand (server)");
      serverHand.splice(pos, 1);

      const serverMeld = [...(data.melds?.[uid] ?? []), code];
      tx.update(roomRef, {
        [`hands.${uid}`]: serverHand,
        [`melds.${uid}`]: serverMeld,
      });
    });
  }

  function updateMeldArea(uid: string, cards: string[]) {
    melds.value[uid] = [...cards];
  }

  /* ─────────── playCard & pli ─────────── */
  async function playCard(code: string) {
    if (!room.value || room.value.phase !== "play" || !myUid.value) return;
    const uid = myUid.value;
    if (room.value.currentTurn !== uid) return; // pas ton tour

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");
      const data = snap.data() as RoomDoc;

      // sécurité : carte doit être en main côté serveur
      const handSrv = [...(data.hands[uid] ?? [])];
      const idxSrv = handSrv.indexOf(code);
      if (idxSrv === -1) throw new Error("Card not in hand server");
      handSrv.splice(idxSrv, 1);

      // ajoute la carte au pli courant
      const cards = [...data.trick.cards, code];
      const players = [...data.trick.players, uid];

      const update: any = {
        [`hands.${uid}`]: handSrv,
        trick: { cards, players },
      };

      // si 2 cartes → évaluer le vainqueur
      if (cards.length === 2) {
        const leadSuit = splitCode(cards[0]).suit;
        const cmp = compareCards(
          cards[0],
          cards[1],
          data.trumpSuit as Suit,
          leadSuit
        );
        const winnerUid = cmp >= 0 ? players[0] : players[1];
        update.currentTurn = winnerUid; // garde la main
        update.trick = { cards: [], players: [] }; // reset pli
      }

      tx.update(roomRef, update);
    });
  }

  /** Retourne "d'" ou "de " selon la première lettre */
  function deOuD(name: string): string {
    return /^[aeiouyàâäéèëêïîôöùûüh]/i.test(name.trim()) ? "d'" : "de ";
  }

  /* ---------- joinRoom ---------- */
  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
    return _subscribeRoom(roomId);
  }

  /* ---------- dropToMeld fallback via clic ---------- */
  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  /* ───────── expose ───────── */
  return {
    // state
    room,
    myUid,
    hand,
    melds,
    loading,

    // getters
    trumpSuit,
    canDraw,
    getMeldArea,

    // actions
    updateHand,
    addToMeld,
    updateMeldArea,
    dropToMeld,
    playCard,
    joinRoom,
    deOuD,
    getMeld,
  };
});
