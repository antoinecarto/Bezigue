export function assertNoDuplicates(cards: string[], label = "deck") {
  const seen = new Set<string>();
  const dups = new Set<string>();

  for (const card of cards) {
    if (seen.has(card)) {
      dups.add(card);
    }
    seen.add(card);
  }

  if (dups.size > 0) {
    const list = [...dups].join(", ");
    throw new Error(`❌ Doublons détectés dans ${label} : ${list}`);
  }
}
