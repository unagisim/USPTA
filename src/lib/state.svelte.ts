// État partagé de l'application : réglages, horloge, et le match ouvert.

import { DEFAULT_COLORS } from './colors';
import { announce, playerName, type AnnounceContext, type NameStyle } from './annonces';
import { configOf, sidePlayers, loadSettings, saveMatch, saveSettings, defaultSettings, type Settings, type StoredMatch } from './db';
import { lastUndoable, replay, type EventInput, type MatchEvent, type Side } from './engine';

export const app = $state({
  settings: defaultSettings(),
  /** Heure courante, rafraîchie 4 fois par seconde pour les chronomètres. */
  now: Date.now(),
});

let ticking = false;
export async function initApp(): Promise<void> {
  app.settings = await loadSettings();
  applyTheme();
  if (!ticking) {
    ticking = true;
    setInterval(() => (app.now = Date.now()), 250);
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  app.settings = { ...app.settings, ...patch };
  applyTheme();
  await saveSettings(app.settings);
}

function applyTheme(): void {
  const t = app.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/** Forme des noms à l'écran, d'après les réglages. */
export const nameStyle = (): NameStyle => ({ format: app.settings.nameFormat, civility: app.settings.civility });

/** Match ouvert : événements, score recalculé, annonces. Enregistré à chaque saisie. */
export class LiveMatch {
  m = $state<StoredMatch>() as StoredMatch;

  constructor(match: StoredMatch) {
    this.m = match;
  }

  config = $derived(configOf(this.m));
  /** Couleur de chaque joueur (tenue), la même tout le match. */
  colors = $derived(this.m.colors ?? DEFAULT_COLORS);
  result = $derived(replay(this.config, this.m.events));
  state = $derived(this.result.state);
  ctx: AnnounceContext = $derived({
    config: this.config,
    players: this.m.players,
    ...(this.m.doubles && this.m.partners ? { partners: this.m.partners } : {}),
    team: !!this.m.info.team,
  });

  get doubles(): boolean {
    return !!this.m.doubles && !!this.m.partners;
  }

  /** Nom d'un côté à l'écran : le joueur, ou « Dupont / Martin » pour une équipe de double. */
  name(side: Side): string {
    const ps = sidePlayers(this.m, side);
    return ps.map((p) => playerName(p, nameStyle())).join(' / ');
  }

  /** Joueur d'une équipe à l'écran (double). */
  playerOf(side: Side, idx: 0 | 1): string {
    const p = sidePlayers(this.m, side)[idx] ?? this.m.players[side];
    return playerName(p, nameStyle());
  }

  /** Annonce de la dernière saisie, à afficher en gros. */
  lastCall = $derived.by(() => {
    const log = this.result.log;
    return log.length ? announce(log[log.length - 1], this.ctx) : [];
  });

  async add(input: EventInput): Promise<MatchEvent> {
    const events = this.m.events;
    const id = events.reduce((max, e) => Math.max(max, e.id), 0) + 1;
    const event = { ...input, id, ts: Date.now() } as MatchEvent;
    this.m.events = [...events, event];
    const r = replay(this.config, this.m.events);
    if (r.state.winner && this.m.phase === 'live') this.m.phase = 'finished';
    else if (!r.state.winner && this.m.phase === 'finished') this.m.phase = 'live';
    this.m.winner = r.state.winner;
    await this.save();
    return event;
  }

  /** Annule la dernière saisie qui touche au score ou aux barèmes. */
  async undo(reason = 'Annulation'): Promise<boolean> {
    const last = lastUndoable(this.m.events);
    if (!last) return false;
    await this.add({ kind: 'undo', target: last.id, reason });
    return true;
  }

  async save(): Promise<void> {
    await saveMatch(this.m);
  }
}
