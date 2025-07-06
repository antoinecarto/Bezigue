import { Card } from "@/game/model/Card";

export const cardToStr = (c: Card | string) =>
  typeof c === "string" ? c : c.toString();
export const strToCard = (s: string | Card) =>
  typeof s === "string" ? Card.fromString(s) : s;

export const arrayToStr = (arr: (Card | string)[]) => arr.map(cardToStr);
export const arrayToCard = (arr: string[]) => arr.map(strToCard);
