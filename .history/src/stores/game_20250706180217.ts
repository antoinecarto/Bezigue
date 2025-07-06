// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
  Transaction,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";
import { distributeCards, generateShuffledDeck } from "@/game/BezigueGame";

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room   = ref<RoomState | null>(null);
  const myUid  = ref<string | null>(null);
  const hand   = ref<string[]>([]);
  const melds  = ref<Record<string, string[]>>({});
  const loading        = ref(true);
  const showExchange   = ref(false);
  const drawInProgress = ref(false);

  /* ──────────── getters ──────────── */
  function getMeldArea(uid: string) {
    return melds.value[uid] ?? [];
  }
  const trumpSuit = computed(() => room.value?.trumpCard.slice(-1) ?? "");
  const canDraw = computed(() => {
    const r = room.value;
    return (
      r &&
      r.phase === "draw" &&
      r.drawQueue?.[0] === myUid.value &&
      !drawInProgress.value
    );
  });

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

      room.value = {
        id: snap.id,
        ...data,
      };

      // synchro temps‑réel main et melds
      if (myUid.value) {
        hand.value = data.hands?.[myUid.value] ?? [];
      }
      melds.value = { ...data.melds };
    });
  }

  // ------------------------------------------------------------------
  // ACTIONS
  // ------------------------------------------------------------------
  function getMeld(uid: string) {
    return melds.value[uid] ?? [];
  }

  async function addToMeld(uid: string, code: string) {
    if (!room.value) return;
    const roomRef = doc(db, "rooms", room.value.id);

    /* MAJ locale optimiste */
    const idx = hand.value.indexOf(code);
    if (idx !== -1) hand.value.splice(idx, 1);
    melds.value[uid] = [...getMeld(uid), code];

    /* MAJ Firestore atomique */
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

  /* ---------- échange 7 d’atout ---------------- */
  async function confirmExchange() {
    if (!room.value || !myUid.value) return;
    showExchange.value = false;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(doc(db, "rooms", room.value.id));
      const d = snap.data() as RoomDoc;

      const sevenCode = "7" + d.trumpSuit;
      if (!d.hands[myUid.value].includes(sevenCode)) return;

      const allowedRanks = ["A", "10", "K", "Q", "J"];
      if (!allowedRanks.includes(d.trumpCard.slice(0, -1))) return;

      const newHand = d.hands[myUid.value].filter((c) => c !== sevenCode);
      newHand.push(d.trumpCard);

      tx.update(doc(db, "rooms", room.value.id), {
        trumpCard: sevenCode,
        [`hands.${myUid.value}`]: newHand,
      });
    });
  }

  /* ---------- dropToMeld via clic fallback ---------------- */
  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;
    await addToMeld(myUid.value, code);
  }

  // ──────────── joinRoom (garde la logique précédente) ────────────
  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
    return _subscribeRoom(roomId); // unsubscribe retourné
  }

  // autres actions (drawCard, playCard, etc.) restent inchangées
  /* ──────────── expose ──────────── */
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

    // actions
    getMeldArea,
    getMeld,
    addToMeld,
    updateMeldArea,
    dropToMeld,
    joinRoom,
    _subscribeRoom, // à utiliser via joinRoom