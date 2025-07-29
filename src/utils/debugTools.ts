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

export function checkHandsForDuplicates(handA: string[], handB: string[]) {
  const duplicatesA = findDuplicates(handA);
  const duplicatesB = findDuplicates(handB);

  const crossDuplicates = handA.filter((card) => handB.includes(card));

  if (duplicatesA.length > 0) {
    console.log("🃏 Doublons dans la main A :", duplicatesA);
  }

  if (duplicatesB.length > 0) {
    console.log("🃏 Doublons dans la main B :", duplicatesB);
  }

  if (crossDuplicates.length > 0) {
    console.log("⚔️ Cartes présentes dans les deux mains :", crossDuplicates);
  }
}

function findDuplicates(arr: string[]): string[] {
  const countMap: Record<string, number> = {};
  arr.forEach((card) => {
    countMap[card] = (countMap[card] ?? 0) + 1;
  });
  return Object.entries(countMap)
    .filter(([, count]) => count > 1)
    .map(([card]) => card);
}
