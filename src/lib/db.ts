// Stockage local (IndexedDB via Dexie). Un match est enregistré avec sa liste d'événements,
// à chaque saisie ; le score est toujours recalculé par le moteur.

import Dexie, { type EntityTable } from 'dexie';
import {
  DEFAULT_DURATIONS,
  FORMATS,
  type BallChange,
  type Durations,
  type FormatId,
  type MatchConfig,
  type MatchEvent,
  type Player,
  type Side,
} from './engine';

export interface MatchInfo {
  tournament: string;
  round: string;
  court: string;
  referee: string;
  umpire: string;
  umpireLicence: string;
}

export type TossChoice = 'serve' | 'receive' | 'side' | 'defer';

export interface Toss {
  winner: Side;
  choice: TossChoice;
}

/** setup : saisie ; prematch : contrôles, tirage, échauffement ; live : match ; finished : terminé. */
export type Phase = 'prematch' | 'live' | 'finished';

export interface StoredMatch {
  id: string;
  createdAt: number;
  updatedAt: number;
  info: MatchInfo;
  players: { A: Player; B: Player };
  formatId: FormatId;
  balls: BallChange;
  firstServer: Side;
  leftAtStart: Side;
  toss: Toss | null;
  /** Étapes cochées de la procédure guidée. */
  checklist: Record<string, boolean>;
  events: MatchEvent[];
  phase: Phase;
  winner: Side | null;
}

export type NameStyle = 'full' | 'short';
export type Theme = 'auto' | 'light' | 'dark' | 'sun';

export interface Settings {
  id: 'settings';
  offences: string[];
  durations: Durations;
  sound: boolean;
  vibrate: boolean;
  nameStyle: NameStyle;
  theme: Theme;
}

export const DEFAULT_OFFENCES = [
  'obscénité audible',
  'obscénité visible',
  'abus de balle',
  'abus de raquette ou d\'équipement',
  'abus verbal',
  'abus physique',
  'conseils (coaching)',
  'comportement antisportif',
  'non-respect du code vestimentaire',
];

export const defaultSettings = (): Settings => ({
  id: 'settings',
  offences: [...DEFAULT_OFFENCES],
  durations: { ...DEFAULT_DURATIONS },
  sound: true,
  vibrate: true,
  nameStyle: 'full',
  theme: 'auto',
});

class AppDB extends Dexie {
  matches!: EntityTable<StoredMatch, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('uspta');
    this.version(1).stores({
      matches: 'id, updatedAt, phase',
      settings: 'id',
    });
  }
}

export const db = new AppDB();

export const configOf = (m: StoredMatch): MatchConfig => ({
  format: FORMATS[m.formatId],
  firstServer: m.firstServer,
  leftAtStart: m.leftAtStart,
  balls: m.balls,
});

/** Copie simple : les objets réactifs de Svelte ne peuvent pas être stockés tels quels. */
export const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export async function loadSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  return { ...defaultSettings(), ...s };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put(plain(s));
}

export const listMatches = () => db.matches.orderBy('updatedAt').reverse().toArray();

export async function saveMatch(m: StoredMatch): Promise<void> {
  await db.matches.put(plain({ ...m, updatedAt: Date.now() }));
}

export const deleteMatch = (id: string) => db.matches.delete(id);

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
