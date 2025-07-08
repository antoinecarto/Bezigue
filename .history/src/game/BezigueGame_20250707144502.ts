/** Crée un deck de 64 cartes, 2 exemplaires par rang/couleur, puis mélange */
export function generateShuffledDeck(): string[] {
  const suits = ["S", "H", "D", "C"]; // ♠ ♥ ♦ ♣
  const ranks = ["7", "8", "9", "J", "Q", "K", "10", "A"];
  const deck: string[] = [];

  for (const r of ranks) {
    for (const s of suits) {
      deck.push(`${r}${s}_1`, `${r}${s}_2`); // ← suffixes _1 / _2
    }
  }

  // Fisher‑Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Distribue 9 cartes chacun, fixe l’atout, prépare la pioche */
export function distributeCards(deck: string[]) {
  return {
    hands: {
      player1: deck.slice(0, 9),
      player2: deck.slice(9, 18),
    },
    drawPile: deck.slice(18), // 46 cartes restantes
    trumpCard: deck[deck.length - 1], // dernière carte vue
  };
}
