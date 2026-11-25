// Couleur de chaque joueur, choisie d'après sa tenue. Elle le suit tout le match,
// quel que soit son côté du court. Les teintes de chaque thème sont dans app.css (classes .c-*).

import type { Side } from './engine';

export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow' | 'orange' | 'purple' | 'pink' | 'black' | 'white' | 'grey';

export const COLORS: [PlayerColor, string][] = [
  ['blue', 'Bleu'],
  ['red', 'Rouge'],
  ['green', 'Vert'],
  ['yellow', 'Jaune'],
  ['orange', 'Orange'],
  ['purple', 'Violet'],
  ['pink', 'Rose'],
  ['black', 'Noir'],
  ['white', 'Blanc'],
  ['grey', 'Gris'],
];

export const DEFAULT_COLORS: Record<Side, PlayerColor> = { A: 'blue', B: 'orange' };

export const colorName = (c: PlayerColor) => COLORS.find(([k]) => k === c)?.[1] ?? c;
