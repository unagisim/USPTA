import { FORMATS, replay, type BallChange, type EventInput, type FormatId, type MatchConfig, type MatchEvent, type Side } from '../src/lib/engine';

/** Petit enregistreur de match pour les tests. */
export class Rec {
  events: MatchEvent[] = [];
  config: MatchConfig;
  private ts = 1_000_000;

  constructor(format: FormatId = 'F1', opts: { firstServer?: Side; leftAtStart?: Side; balls?: BallChange; serveOrder?: Record<Side, 0 | 1>; receiveOrder?: Record<Side, 0 | 1> } = {}) {
    this.config = {
      format: FORMATS[format],
      firstServer: opts.firstServer ?? 'A',
      leftAtStart: opts.leftAtStart ?? 'A',
      balls: opts.balls ?? { mode: 'none' },
      ...(opts.serveOrder ? { serveOrder: opts.serveOrder } : {}),
      ...(opts.receiveOrder ? { receiveOrder: opts.receiveOrder } : {}),
    };
  }

  add(e: EventInput): number {
    const id = this.events.length + 1;
    this.ts += 1000;
    this.events.push({ ...e, id, ts: this.ts } as MatchEvent);
    return id;
  }

  point(winner: Side, n = 1): this {
    for (let i = 0; i < n; i++) this.add({ kind: 'point', winner });
    return this;
  }

  /** Gagne `n` jeux d'affilée (4 points chacun) pour `winner`. */
  games(winner: Side, n = 1): this {
    for (let i = 0; i < n; i++) this.point(winner, 4);
    return this;
  }

  /** Jeux alternés A, B, A, B… */
  alternate(n: number, first: Side = 'A'): this {
    for (let i = 0; i < n; i++) this.games(i % 2 === 0 ? first : first === 'A' ? 'B' : 'A');
    return this;
  }

  get r() {
    return replay(this.config, this.events);
  }

  get s() {
    return this.r.state;
  }

  get last() {
    const log = this.r.log;
    return log[log.length - 1];
  }
}
