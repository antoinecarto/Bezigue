import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db } from "@/services/firebase"; // ton init Firebase
import { detectCombinations } from "@/core/rules/detectCombinations.ts";
import type { RoomDoc } from "@/types/firestore";
export const useGameStore = defineStore("game", () => {
  /* --- state ---------------------------------------------------------------- */
  const room = ref<RoomDoc | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const meld = ref<string[]>([]);
  const loading = ref(true);
  const meldArea = computed(() => meld.value);

  /* --- getters -------------------------------------------------------------- */
  const trumpSuit = computed(() => room.value?.trumpCard.slice(-1) ?? "");

  /* --- internal helpers ----------------------------------------------------- */
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

  /* --- actions -------------------------------------------------------------- */
  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
    return _subscribeRoom(roomId); // retourne l’unsubscribe
  }

  async function playCard(code: string) {
    if (!room.value || !myUid.value) return;
    await runTransaction(db, async (tx) => {
      /* … même logique que précédemment, mais ici … */
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
    // etc.
  }

  return {
    myUid,
    room,
    hand,
    meld,
    meldArea,
    loading,
    trumpSuit,
    joinRoom,
    playCard,
    dropToMeld,
  };
});
