// État partagé de l'application : réglages, horloge, et le match ouvert.

import { announce, playerName, type AnnounceContext } from './annonces';
import { configOf, loadSettings, saveMatch, saveSettings, defaultSettings, type Settings, type StoredMatch } from './db';
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

/** Match ouvert : événements, score recalculé, annonces. Enregistré à chaque saisie. */
export class LiveMatch {
  m = $state<StoredMatch>() as StoredMatch;

  constructor(match: StoredMatch) {
    this.m = match;
  }

  config = $derived(configOf(this.m));
  result = $derived(replay(this.config, this.m.events));
  state = $derived(this.result.state);
  ctx: AnnounceContext = $derived({
    config: this.config,
    players: this.m.players,
    nameStyle: app.settings.nameStyle,
  });

  name(side: Side): string {
    return playerName(this.m.players[side], app.settings.nameStyle);
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
