import { describe, expect, it } from 'vitest';
import { lastUndoable } from '../src/lib/engine';
import { Rec } from './helpers';

describe('code de conduite', () => {
  it('avertissement, 1 point, 3 points reportés sur le jeu suivant, puis disqualification', () => {
    const r = new Rec('F1');
    r.add({ kind: 'conduct', player: 'B', offence: 'abus de balle' });
    expect(r.last.outcome.sanction).toMatchObject({ level: 'warning', points: 0 });
    expect(r.s.points).toEqual({ A: 0, B: 0 });

    r.add({ kind: 'conduct', player: 'B', offence: 'abus de raquette' });
    expect(r.last.outcome.sanction).toMatchObject({ level: 'point', points: 1 });
    expect(r.s.points).toEqual({ A: 1, B: 0 });

    r.point('A'); // 30-0
    r.add({ kind: 'conduct', player: 'B', offence: 'abus verbal' });
    expect(r.last.outcome.sanction).toMatchObject({ level: 'three_points', points: 3 });
    // 40-0, jeu A, puis 1 point reporté sur le jeu suivant (B au service : 0-15).
    expect(r.s.games).toEqual({ A: 1, B: 0 });
    expect(r.s.points).toEqual({ A: 1, B: 0 });

    r.add({ kind: 'conduct', player: 'B', offence: 'abus physique' });
    expect(r.last.outcome.sanction).toMatchObject({ level: 'disqualification', points: 0 });
    expect(r.s.winner).toBeNull(); // décision du juge-arbitre
    r.add({ kind: 'end', type: 'disqualification', loser: 'B' });
    expect(r.s.winner).toBe('A');
    expect(r.s.endReason).toBe('disqualification');
  });

  it('le barème des dépassements de temps est indépendant du code de conduite', () => {
    const r = new Rec('F1');
    r.add({ kind: 'conduct', player: 'A', offence: 'obscénité audible' });
    r.add({ kind: 'conduct', player: 'A', offence: 'obscénité audible' });
    r.add({ kind: 'time_violation', player: 'A' });
    expect(r.last.outcome.sanction).toMatchObject({ scale: 'time', level: 'warning', points: 0 });
    r.add({ kind: 'time_violation', player: 'A' });
    r.add({ kind: 'time_violation', player: 'A' });
    expect(r.last.outcome.sanction).toMatchObject({ level: 'point', points: 1 });
    expect(r.r.conductCount).toEqual({ A: 2, B: 0 });
    expect(r.r.timeViolationCount).toEqual({ A: 3, B: 0 });
    expect(r.s.points).toEqual({ A: 0, B: 3 }); // 1 (conduite) + 2 (temps)
  });
});

describe('corrections', () => {
  it('annuler le dernier point, avec trace', () => {
    const r = new Rec('F1').point('A', 2);
    const last = lastUndoable(r.events)!;
    expect(last.id).toBe(2);
    r.add({ kind: 'undo', target: last.id, reason: 'erreur de saisie' });
    expect(r.s.points).toEqual({ A: 1, B: 0 });
    expect(r.r.corrections).toHaveLength(1);
    expect(lastUndoable(r.events)!.id).toBe(1);
  });

  it('annuler une sanction retire le point et le niveau du barème', () => {
    const r = new Rec('F1');
    r.add({ kind: 'conduct', player: 'B', offence: 'abus de balle' });
    const id = r.add({ kind: 'conduct', player: 'B', offence: 'abus de balle' });
    r.add({ kind: 'undo', target: id });
    expect(r.s.points).toEqual({ A: 0, B: 0 });
    expect(r.r.conductCount.B).toBe(1);
  });

  it('modifier un point ancien recalcule la suite', () => {
    const r = new Rec('F1');
    const first = r.add({ kind: 'point', winner: 'B' });
    r.point('A', 4);
    expect(r.s.games).toEqual({ A: 1, B: 0 });
    r.add({ kind: 'replace', target: first, with: { kind: 'point', winner: 'A' }, reason: 'overrule' });
    // A gagne le jeu dès le 4e point ; le 5e point compte dans le 2e jeu.
    expect(r.s.games).toEqual({ A: 1, B: 0 });
    expect(r.s.points).toEqual({ A: 1, B: 0 });
    expect(r.r.log[0].replaced).toBe(true);
  });

  it('point à rejouer après coup (overrule en let)', () => {
    const r = new Rec('F1');
    const id = r.add({ kind: 'point', winner: 'B' });
    r.add({ kind: 'replace', target: id, with: { kind: 'let' } });
    expect(r.s.points).toEqual({ A: 0, B: 0 });
  });

  it('erreur de serveur : le bon joueur sert la suite, les points restent acquis', () => {
    const r = new Rec('F1').point('A', 2);
    r.add({ kind: 'set_server', server: 'B', reason: 'mauvais serveur' });
    expect(r.s.server).toBe('B');
    expect(r.s.points).toEqual({ A: 2, B: 0 });
    r.point('A', 2);
    expect(r.s.server).toBe('A'); // le service alterne normalement ensuite
  });

  it('score fixé à la main', () => {
    const r = new Rec('F1').point('A');
    r.add({ kind: 'adjust', sets: [{ A: 6, B: 3 }], games: { A: 2, B: 2 }, points: { A: 0, B: 1 }, server: 'B' });
    expect(r.s.setsWon).toEqual({ A: 1, B: 0 });
    expect(r.s.games).toEqual({ A: 2, B: 2 });
    expect(r.s.server).toBe('B');
  });
});

describe('fins de match et temps', () => {
  it('abandon : score figé', () => {
    const r = new Rec('F1').games('A', 2);
    r.add({ kind: 'end', type: 'retirement', loser: 'A', note: 'blessure' });
    expect(r.s.winner).toBe('B');
    r.point('A');
    expect(r.s.games).toEqual({ A: 2, B: 0 });
  });

  it('pauses toilettes comptées et chronomètre actif', () => {
    const r = new Rec('F1');
    r.add({ kind: 'timer', timer: 'toilet', action: 'start', player: 'B' });
    expect(r.r.activeTimer).toMatchObject({ timer: 'toilet', player: 'B' });
    r.add({ kind: 'timer', timer: 'toilet', action: 'stop', player: 'B' });
    expect(r.r.activeTimer).toBeNull();
    expect(r.r.toiletBreaks).toEqual({ A: 0, B: 1 });
  });
});

describe('balles neuves', () => {
  it('7 jeux (échauffement compté pour 2), puis tous les 9 jeux', () => {
    const r = new Rec('F1', { balls: { mode: 'regulation', first: 7, every: 9, warmupGames: 2 } });
    // 6-0, 0-6, puis 2-0 au 3e set : 14 jeux, sans jeu décisif.
    const winners = [...Array(6).fill('A'), ...Array(6).fill('B'), 'A', 'A'] as ('A' | 'B')[];
    const changes: number[] = [];
    winners.forEach((w, i) => {
      r.games(w);
      if (r.last.outcome.newBalls) changes.push(i + 1);
    });
    expect(changes).toEqual([5, 14]);
  });

  it('reportées au 2e jeu du set suivant si elles tombent avant un jeu décisif', () => {
    const r = new Rec('F1', { balls: { mode: 'regulation', first: 14, every: 9, warmupGames: 2 } });
    r.alternate(12);
    expect(r.last.outcome.newBalls).toBe(false);
    expect(r.r.ballsDelayed).toBe(true);
    r.point('A', 7); // jeu décisif
    expect(r.last.outcome.newBalls).toBe(false);
    r.games('B'); // 1er jeu du 2e set
    expect(r.last.outcome.newBalls).toBe(true);
  });

  it('option 3e set', () => {
    const r = new Rec('F1', { balls: { mode: 'final_set' } }).games('A', 6);
    expect(r.last.outcome.newBalls).toBe(false);
    r.games('B', 6);
    expect(r.last.outcome.newBalls).toBe(true);
  });
});
