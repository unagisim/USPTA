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

/** Teinte de la tenue, pour les pastilles du PDF (mêmes valeurs que --p-swatch dans app.css). */
export const COLOR_HEX: Record<PlayerColor, string> = {
  blue: '#2e5bc7',
  red: '#d32f2f',
  green: '#2e8b4a',
  yellow: '#f2d000',
  orange: '#f07c1e',
  purple: '#7b3fc4',
  pink: '#e0559b',
  black: '#111111',
  white: '#ffffff',
  grey: '#8a938f',
};
