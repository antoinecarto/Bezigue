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
import type { Suit } from "@/game/models/Card.ts";
import { detectCombinations } from "@/core/rules/detectCombinations";
import { Card } from "@/game/models/Card.ts"; // classe Card
import { distributeCards, generateShuffledDeck } from "@/game/BezigueGame";

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */

  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]); // main du joueur courant
  const melds = ref<Record<string, string[]>>({});
  const loading = ref(true);
  const showExchange = ref(false);
  const drawInProgress = ref(false);

  /* ──────────── getters ─────────── */

  function getMeld(uid: string): string[] {
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

    // onSnapshot renvoie directement la fonction de désabonnement
    return onSnapshot(roomRef, (snap) => {
      loading.value = false;

      /* Le document n’existe plus (supprimé) → réinit */
      if (!snap.exists()) {
        room.value = null;
        return;
      }

      /* Contenu Firestore */
      const data = snap.data() as RoomDoc;

      /* Enrichi localement avec l’id → RoomState */
      room.value = {
        id: snap.id,
        ...data,
      };

      /* Si l’uid est déjà connu, met à jour la main locale */
      if (myUid.value) {
        hand.value = room.value.hands?.[myUid.value] ?? [];
      }
    });
  }

  // ------------------------------------------------------------------
  // ACTIONS
  // ------------------------------------------------------------------

  // ─── getter pratique ────────────────────────────────
  function getMeld(uid: string) {
    return melds.value[uid] ?? [];
  }

  // ─── action qui fait TOUT (local + Firestore) ───────
  async function addToMeld(uid: string, code: string) {
    if (!room.value) return;
    const roomRef = doc(db, "rooms", room.value.id);

    /* 1. MAJ locale immédiate (optimistic UI) */
    const idx = hand.value.indexOf(code);
    if (idx !== -1) hand.value.splice(idx, 1);
    melds.value[uid] = [...getMeld(uid), code];

    /* 2. MAJ Firestore atomique */
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("room not found");

      const data = snap.data() as RoomDoc;
      // sécurité : assure que la carte est bien dans la main serveur
      const serverHand = [...(data.hands[uid] ?? [])];
      const pos = serverHand.indexOf(code);
      if (pos === -1) throw new Error("card not in hand (server)");
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
  async function setTargetScore(value: number) {
    if (!room.value) return;
    if (room.value.phase !== "waiting") return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      targetScore: value,
    });
  }

  async function drawCard() {
    if (!canDraw.value || !room.value) return;

    drawInProgress.value = true;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, "rooms", room.value!.id));
        const d = snap.data() as RoomDoc;

        if (d.phase !== "draw" || d.drawQueue[0] !== myUid.value)
          throw "Pas votre tour de piocher";

        const deck = [...d.deck];
        const card = deck.shift()!;
        const newHand = [...d.hands[myUid.value!], card];
        const newQueue = d.drawQueue.slice(1);

        const update: Record<string, any> = {
          deck,
          [`hands.${myUid.value}`]: newHand,
          drawQueue: newQueue,
        };

        if (newQueue.length === 0) {
          update.phase = "play";
          update.trick = { cards: [], players: [] };
        }

        tx.update(doc(db, "rooms", room.value!.id), update);
      });
    } finally {
      drawInProgress.value = false;
    }
  }

  /* ---------- échange 7 d’atout ---------------- */
  async function confirmExchange() {
    if (!room.value || !myUid.value) return;
    showExchange.value = false;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(doc(db, "rooms", room.value!.id));
      const d = snap.data() as RoomDoc;

      const sevenCode = "7" + d.trumpSuit;
      if (!d.hands[myUid.value!].includes(sevenCode)) return; // pas de 7

      const allowedRanks = ["A", "10", "K", "Q", "J"];
      if (!allowedRanks.includes(d.trumpCard.slice(0, -1))) return; // carte exposée non échangeable

      // swap
      const hand = d.hands[myUid.value!].filter((c) => c !== sevenCode);
      hand.push(d.trumpCard);

      tx.update(doc(db, "rooms", room.value!.id), {
        trumpCard: sevenCode,
        [`hands.${myUid.value}`]: hand,
      });
    });
  }

  function cancelExchange() {
    showExchange.value = false;
  }
  function joinRoom(roomId: string, uid: string) {
    myUid.value = uid;
    return _subscribeRoom(roomId); // ← renvoie l’unsubscribe
  }

  function updateHand(newHand: string[]) {
    hand.value = [...newHand];
    // TODO : écrire dans Firestore si tu veux persister l’ordre
  }
  /* ───────── playCard ───────── */
  async function playCard(code: string) {
    console.log("playCard called with code =", code);

    /* 1. Pré‑conditions */
    if (!room.value || room.value.phase !== "play") return;

    const uid = myUid.value;
    if (!uid) {
      console.error("UID is undefined");
      return;
    }

    const roomId = room.value.id; // 💡 grâce à RoomState, .id est garanti
    if (!roomId) {
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        console.log("Dans runTransaction");

        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists()) throw new Error("Room does not exist");

        const roomData = roomSnap.data() as RoomDoc;
        const handArray = roomData.hands?.[uid] ?? [];

        console.log("handArray =", handArray, "code =", code);

        /* 2. Vérifie et retire la carte */
        const idx = handArray.indexOf(code);
        if (idx === -1) throw new Error("Card not found in hand");

        const newHand = [...handArray];
        newHand.splice(idx, 1);

        /* 3. Met à jour exchangeTable */
        const newExchangeTable = { ...roomData.exchangeTable, [uid]: code };

        /* 4. Persiste les changements */
        tx.update(roomRef, {
          [`hands.${uid}`]: newHand,
          exchangeTable: newExchangeTable,
        });
      });

      console.log("Transaction successful");
    } catch (err) {
      console.error("Transaction error:", err);
    }
  }

  /* ───────── dropToMeld ───────── */
  async function dropToMeld(code: string) {
    if (!room.value || !myUid.value) return;

    const uid = myUid.value;
    const roomRef = doc(db, "rooms", room.value.id);

    // ► Mise à jour locale
    const idx = hand.value.indexOf(code);
    if (idx === -1) return; // la carte n’est pas en main
    hand.value.splice(idx, 1);

    melds.value[uid] = melds.value[uid] ?? [];
    melds.value[uid].push(code);

    // ► Persistance Firestore
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room not found");

        const d = snap.data() as RoomDoc;
        const serverHand = [...(d.hands?.[uid] ?? [])];
        const pos = serverHand.indexOf(code);
        if (pos === -1) throw new Error("Card not in hand (server)");

        serverHand.splice(pos, 1);

        const serverMelds = (d.melds?.[uid] ?? []).slice();
        serverMelds.push(code);

        tx.update(roomRef, {
          [`hands.${uid}`]: serverHand,
          [`melds.${uid}`]: serverMelds,
        });
      });
    } catch (e) {
      console.error("Firestore meld update failed:", e);
    }
  }

  // Au démarrage :
  function maybeStartGame(tx: Transaction, d: RoomDoc, roomId: string) {
    if (d.phase !== "waiting") return;
    if (d.players.length !== 2) return;

    const host = d.players[0];
    const guest = d.players.find((u) => u !== host)!;
    const roomRef = doc(db, "rooms", roomId);

    const fullDeck = generateShuffledDeck();
    const distrib = distributeCards(fullDeck);
    if (!distrib.trumpCard) throw new Error("distrib.trumpCard is undefined");

    const hands: Record<string, string[]> = {
      [host]: distrib.hands.player1.map((c) => c.toString()),
      [guest]: distrib.hands.player2.map((c) => c.toString()),
    };

    tx.set(
      roomRef,
      {
        phase: "play",
        currentTurn: host,
        deck: distrib.drawPile.map((c) => c.toString()),
        trumpCard: distrib.trumpCard.toString(),
        trumpTaken: false,
        trumpSuit: distrib.trumpCard.toString().slice(-1) as Suit,
        hands,
        melds: {},
        trick: { cards: [], players: [] },
        drawQueue: [],
        exchangeTable: {},
      },
      { merge: true }
    );
  }
  /* ──────────── expose ──────────── */
  return {
    // state
    room,
    myUid,
    hand,
    loading,
    melds,

    // getters
    trumpSuit,
    canDraw,

    // actions
    getMeldArea,
    updateMeldArea,
    dropToMeld,
    joinRoom,
    updateHand,
    playCard,
    setTargetScore,
    drawCard,
    confirmExchange,
    cancelExchange,
    maybeStartGame,
    addToMeld,
    getMeld,
  };
});
