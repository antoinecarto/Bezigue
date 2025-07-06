// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { detectCombinations } from "@/core/rules/detectCombinations";
import { Card } from "@/game/models/Card.ts"; // classe Card
import type { RoomDoc } from "@/types/firestore";

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomDoc | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]); // main du joueur courant
  const meld = ref<string[]>([]); // cartes déposées (zone meld)
  const loading = ref(true);

  /* ──────────── getters ─────────── */
  const meldArea = computed(() => meld.value);
  const trumpSuit = computed(() => room.value?.trumpCard.slice(-1) ?? "");

  /* ──────────── helpers ─────────── */
  function _subscribeRoom(roomId: string) {
    const roomRef = doc(db, "rooms", roomId);

    return onSnapshot(roomRef, (snap) => {
      loading.value = false;
      if (!snap.exists()) {
        room.value = null;
        return;
      }

      room.value = snap.data() as RoomDoc;
      hand.value = room.value?.hands?.[myUid.value ?? ""] ?? [];
    });
  }

  /* ──────────── actions ─────────── */
  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
    return _subscribeRoom(roomId); // ← renvoie l’unsubscribe
  }

  function updateHand(newHand: string[]) {
    hand.value = [...newHand];
    // TODO : écrire dans Firestore si tu veux persister l’ordre
  }

  async function playCard(code: string) {
    if (!room.value || !myUid.value) return;

    // TODO : logique transaction Firestore
    await runTransaction(db, async (tx) => {
      // ...
    });
  }

  async function dropToMeld(code: string) {
    const idx = hand.value.indexOf(code);
    if (idx !== -1) {
      hand.value.splice(idx, 1);
      meld.value.push(code);
    }

    const best = detectCombinations(
      meld.value.map(Card.fromCode),
      [],
      trumpSuit.value
    )[0];

    // TODO : traiter la combinaison 'best' (score, etc.)
  }

  function setTargetScore(value: number) {
    if (room.value && room.value.phase === "waiting") {
      updateDoc(doc(db, "rooms", room.value.id), { targetScore: value });
    }
  }

  /* ──────────── expose ──────────── */
  return {
    // state
    room,
    myUid,
    hand,
    meld,
    loading,

    // getters
    meldArea,
    trumpSuit,

    // actions
    joinRoom,
    updateHand,
    playCard,
    dropToMeld,
    setTargetScore,
  };
});
