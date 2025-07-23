// src/stores/game.ts
import { defineStore } from "pinia";
import { ref, computed, watchEffect, watch } from "vue";
import { doc, onSnapshot, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import type { RoomDoc, RoomState } from "@/types/firestore";
import type { Suit } from "@/game/models/Card";

/* ── RANG UNIQUE & PARTAGÉ ─────────────────────────────────────────── */

function splitCode(code: string) {
  const [raw, _] = code.split("_"); // raw = "7C", "10D", etc.
  const rank = raw.slice(0, -1); // Tout sauf le dernier caractère
  const suit = raw.slice(-1) as Suit; // Dernier caractère (C, D, H, S)
  return { rank, suit } as const;
}

export const useGameStore = defineStore("game", () => {
  /* ──────────── state ──────────── */
  const room = ref<RoomState | null>(null);
  const myUid = ref<string | null>(null);
  const hand = ref<string[]>([]);
  const melds = ref<Record<string, string[]>>({});
  const exchangeTable = ref<Record<string, string>>({});
  const scores = ref<Record<string, number>>({});

  const loading = ref(true);
  const playing = ref(false); // verrou anti double‑clic
  const showExchange = ref(false);

  /* ──────────── getters ──────────── */

  watchEffect(() => {
    if (!room.value) return;
    console.log("drawQueue:", room.value.drawQueue);
  });

  watchEffect(() => {
    if (!room.value || !myUid.value) return;

    const trick = room.value.trick;
    if (!trick || trick.cards?.length !== 2) return;

    // ⚠️ Ne pas lancer deux fois
    if (playing.value) return;

    // Ne pas résoudre si ce n'est pas moi qui ai posé la 2e carte
    const lastToPlay = trick.players?.[1];
    if (lastToPlay !== myUid.value) return;

    // Appel unique : pose un verrou
    playing.value = true;
    resolveTrickOnServer().finally(() => {
      playing.value = false;
    });
  });

  watch(
    () => room.value?.currentTurn,
    (newVal, oldVal) => {
      if (!oldVal || !newVal || newVal !== myUid.value) return;
      checkExchangePossibility();
    }
  );

  const currentTurn = computed(() => room.value?.currentTurn ?? null);

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
      console.log("🔥 Firestore melds reçus :", data.melds);
    });
  }

  async function updateHand(newHand: string[]) {
    if (!room.value || !myUid.value) return;
    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${myUid.value}`]: newHand,
    });
    hand.value = [...newHand];
  }

  /**
   * Déplace `code` de la main de `uid` vers sa meld.
   * - Déclenche la réactivité Vue 3 (nouveaux tableau + objet).
   * - Annule proprement en cas d'erreur Firestore.
   */
  async function addToMeld(uid: string, code: string) {
    if (!room.value) return;

    const currentHand = room.value.hands[uid] ?? [];
    const currentMeld = room.value.melds[uid] ?? [];

    if (!currentHand.includes(code)) {
      console.warn(`⛔️ ${code} n'est pas dans la main`);
    }

    const newHand = currentHand.filter((c) => c !== code);
    const newMeld = [...currentMeld, code];

    if (newHand.length + newMeld.length > 9) {
      console.warn("⛔️ Trop de cartes (main + meld > 9)");
      return;
    }

    console.log("📝 Mise à jour Firestore : ", {
      [`hands.${uid}`]: newHand,
      [`melds.${uid}`]: newMeld,
    });

    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${uid}`]: newHand,
      [`melds.${uid}`]: newMeld,
    });
  }

  async function removeFromMeldAndReturnToHand(uid: string, code: string) {
    console.log("⚙️ Début de removeFromMeldAndReturnToHand", { uid, code });

    if (!room.value) {
      console.warn("⛔️ Pas de room");
      return;
    }

    const currentMeld = room.value.melds[uid] ?? [];
    const currentHand = room.value.hands[uid] ?? [];

    if (!currentMeld.includes(code)) {
      console.warn(`⛔ ${code} n'est pas dans le meld`);
      return;
    }

    if (currentHand.length + currentMeld.length >= 9) {
      console.warn("⛔️ Trop de cartes !");
      return;
    }

    const newMeld = currentMeld.filter((c) => c !== code);
    const newHand = [...currentHand, code];
    console.log(
      "🔁 Suppression dans Firestore (removeFromMeldAndReturnToHand)",
      {
        [`hands.${uid}`]: newHand,
        [`melds.${uid}`]: newMeld,
      }
    );
    try {
      await updateDoc(doc(db, "rooms", room.value.id), {
        [`hands.${uid}`]: newHand,
        [`melds.${uid}`]: newMeld,
      });
    } catch (e) {
      console.error("Erreur Firestore lors du retour en main", e);
    }
  }

  async function removeFromMeld(uid: string, code: string) {
    console.log("⚙️ Début de removeFromMeld", { uid, code });

    if (!room.value) {
      console.warn("⛔️ Pas de room");
      return;
    }

    const currentHand = room.value.hands[uid] ?? [];
    const currentMeld = room.value.melds[uid] ?? [];

    if (!currentMeld.includes(code)) {
      console.warn(`⛔️ ${code} n'est pas dans le meld`);
      return;
    }

    const newMeld = currentMeld.filter((c) => c !== code);
    const newHand = [...currentHand, code];

    if (newHand.length + newMeld.length > 9) {
      console.warn("⛔️ Trop de cartes (main + meld > 9)");
      return;
    }

    await updateDoc(doc(db, "rooms", room.value.id), {
      [`hands.${uid}`]: newHand,
      [`melds.${uid}`]: newMeld,
    });

    console.log("🔁 Suppression dans Firestore (removeFromMeld)", {
      [`hands.${uid}`]: newHand,
      [`melds.${uid}`]: newMeld,
    });
  }

  async function drawCard() {
    if (!room.value || !myUid.value) return;
    if (!canDraw()) return;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");

      const d = snap.data() as RoomDoc;
      const dq = d.drawQueue ?? [];

      if (dq[0] !== myUid.value) throw new Error("Not your turn to draw");

      const hand = [...(d.hands[myUid.value] ?? [])];
      const meld = d.melds?.[myUid.value] ?? [];
      if (hand.length + meld.length >= 9) throw new Error("Hand full");

      const deck = [...(d.deck ?? [])];
      if (!deck.length) throw new Error("Deck is empty");

      const card = deck.shift()!;
      hand.push(card);

      const newQueue = dq.slice(1); // on retire le joueur qui vient de piocher

      const update: Record<string, any> = {
        [`hands.${myUid.value}`]: hand,
        deck,
        drawQueue: newQueue,
      };

      tx.update(roomRef, update);
    });
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

  // delay utilitaire
  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Met à jour la meld d'un joueur (uid) avec un nouveau tableau de cartes (newMeld).
   * - Met à jour localement la reactive `melds`.
   * - Met à jour dans Firestore.
   * - Gère proprement les erreurs avec rollback local si besoin.
   */
  async function updateMeld(uid: string, newMeld: string[]) {
    if (!room.value) return;

    // Sauvegarder la valeur locale avant modif (pour rollback si erreur)
    const oldMeld = melds.value[uid] ?? [];

    // Mise à jour locale
    melds.value = {
      ...melds.value,
      [uid]: newMeld,
    };

    try {
      await updateDoc(doc(db, "rooms", room.value.id), {
        [`melds.${uid}`]: newMeld,
      });
    } catch (e) {
      console.error("Erreur lors de la mise à jour de la meld Firestore", e);
      // rollback local
      melds.value = {
        ...melds.value,
        [uid]: oldMeld,
      };
    }
  }

  async function playCard(code: string) {
    if (
      playing.value ||
      !room.value ||
      !myUid.value ||
      room.value.currentTurn !== myUid.value
    )
      return;

    playing.value = true;

    const roomRef = doc(db, "rooms", room.value.id);

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists()) throw new Error("Room missing");
        const d = snap.data() as RoomDoc;

        if ((d.trick.cards?.length ?? 0) >= 2) throw new Error("Trick full");

        console.log("Server Hand:", d.hands[myUid.value]);
        console.log("Server Meld:", d.melds?.[myUid.value]);
        // Récupérer la main et le meld côté serveur
        const srvHand = [...(d.hands[myUid.value] ?? [])];
        const srvMeld = [...(d.melds?.[myUid.value] ?? [])];

        let removedFrom = "";

        // Essayer de retirer la carte de la main
        let pos = srvHand.indexOf(code);
        if (pos !== -1) {
          srvHand.splice(pos, 1);
          removedFrom = "hand";
        } else {
          // Sinon, essayer de la retirer du meld
          pos = srvMeld.indexOf(code);
          if (pos !== -1) {
            srvMeld.splice(pos, 1);
            removedFrom = "meld";
          } else {
            throw new Error("Card not in hand or meld server");
          }
        }

        const cards = [...(d.trick.cards ?? []), code];
        const players = [...(d.trick.players ?? []), myUid.value];
        const opponent = d.players.find((p) => p !== myUid.value)!;

        const update: Record<string, any> = {
          [`hands.${myUid.value}`]: srvHand,
          [`melds.${myUid.value}`]: srvMeld,
          trick: { cards, players },
          exchangeTable: { ...(d.exchangeTable ?? {}), [myUid.value]: code },
        };

        if (cards.length === 1) {
          update.currentTurn = opponent;
        }

        tx.update(roomRef, update);
      });
    } finally {
      playing.value = false;
    }
  }

  async function resolveTrickOnServer() {
    if (!room.value) return;

    const roomRef = doc(db, "rooms", room.value.id);

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error("Room missing");
      const d = snap.data() as RoomDoc;

      const cards = d.trick.cards ?? [];
      const players = d.trick.players ?? [];
      if (cards.length !== 2) throw new Error("Trick not full");
      await delay(3000); // Laisse le pli affiché 3s dans l’UI

      // Code pour déterminer le gagnant, points, etc (idem dans playCard)

      function getSuit(card: string): string {
        const [raw] = card.split("_");
        return raw.slice(-1);
      }
      const trumpSuit = getSuit(d.trumpCard);
      const winner = resolveTrick(
        cards[0],
        cards[1],
        players[0],
        players[1],
        trumpSuit
      );
      const loser = players.find((p) => p !== winner)!;

      const points = cards.reduce(
        (acc, c) => (["10", "A"].includes(splitCode(c).rank) ? acc + 10 : acc),
        0
      );

      const update: Record<string, any> = {
        trick: { cards: [], players: [] },
        exchangeTable: {},
        currentTurn: winner,
        drawQueue: [winner, loser],
      };

      if (points) {
        update[`scores.${winner}`] = (d.scores?.[winner] ?? 0) + points;
      }

      tx.update(roomRef, update);
    });
  }

  function checkExchangePossibility() {
    const d = room.value;
    const uid = myUid.value;
    if (!d || !uid) return;
    if (d.currentTurn !== uid) return;

    const handCards = d.hands?.[uid];
    if (!handCards) return;

    const sevenCode = "7" + d.trumpSuit;
    const allowedRanks = ["A", "10", "K", "Q", "J"];
    const isExchangeable = allowedRanks.includes(d.trumpCard.slice(0, -1));

    if (handCards.includes(sevenCode) && isExchangeable) {
      showExchange.value = true;
    }
  }

  // ----- échange confirmé -----
  async function confirmExchange() {
    if (!room.value || !myUid.value) return;
    showExchange.value = false;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(doc(db, "rooms", room.value!.id));
      const d = snap.data() as RoomDoc;

      const sevenCode = "7" + d.trumpSuit;
      if (!d.hands[myUid.value!].includes(sevenCode)) return;

      const allowedRanks = ["A", "10", "K", "Q", "J"];
      if (!allowedRanks.includes(d.trumpCard.slice(0, -1))) return;

      const hand = d.hands[myUid.value!].filter((c) => c !== sevenCode);
      hand.push(d.trumpCard);

      tx.update(doc(db, "rooms", room.value!.id), {
        trumpCard: sevenCode,
        [`hands.${myUid.value}`]: hand,
      });
    });
  }

  function canDraw(): boolean {
    if (!room.value || !myUid.value) return false;

    const d = room.value;

    // 1. Vérifie que le pli est terminé
    const trickDone = (d.trick.cards?.length ?? 0) === 0;

    // 2. Vérifie que c'est bien à ce joueur de piocher
    const isInDrawQueue = d.drawQueue?.[0] === myUid.value;

    // 3. Vérifie la taille de la main + meld <= 9
    const hand = d.hands?.[myUid.value] ?? [];
    const meld = d.melds?.[myUid.value] ?? [];
    const cardCountOk = hand.length + meld.length < 9;

    return trickDone && isInDrawQueue && cardCountOk;
  }

  function cancelExchange() {
    showExchange.value = false;
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
    showExchange,
    // getters
    canDraw,
    currentTurn,
    getExchange,

    // actions
    removeFromMeldAndReturnToHand,
    removeFromMeld,
    updateMeld,
    getScore,
    updateHand,
    addToMeld,
    playCard,
    drawCard,
    dropToMeld,
    joinRoom,
    deOuD,
    resolveTrick,
    confirmExchange,
    cancelExchange,
  };
});
