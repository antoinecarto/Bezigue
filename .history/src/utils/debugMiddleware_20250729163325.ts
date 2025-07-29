import { assertNoDuplicates } from "@/utils/debugTools.ts";

export function createDeckMiddleware(store: any) {
  store.$subscribe((mutation: any, state: any) => {
    const allCards = [
      ...(state.deck ?? []),
      ...Object.values(state.hands ?? {}).flat(),
      ...Object.values(state.reservedHands ?? {}).flat(),
      console.log(`Mutation sur ${mutation.events?.map(e => e.key).join(", ")}`);
    ];

    try {
      assertNoDuplicates(allCards, "Store Game — Mutation détectée");
    } catch (err) {
      console.error("🧨 Middleware doublon détecté !", err);
    }


  });
}