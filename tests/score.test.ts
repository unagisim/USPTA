import { describe, expect, it } from 'vitest';
import { leftPlayer, serveCourt, formatPoints } from '../src/lib/engine';
import { Rec } from './helpers';

describe('gain des sets selon le format', () => {
  it('format 1 : 6-4 gagne le set, 6-5 non, 7-5 oui', () => {
    const a = new Rec('F1').alternate(8).games('A', 2); // 4-4 puis 6-4
    expect(a.s.completedSets[0].games).toEqual({ A: 6, B: 4 });

    const b = new Rec('F1').alternate(10).games('A'); // 5-5 puis 6-5
    expect(b.s.completedSets).toHaveLength(0);
    b.games('A');
    expect(b.s.completedSets[0].games).toEqual({ A: 7, B: 5 });
  });

  it('format 1 : jeu décisif à 6-6, set gagné 7-6', () => {
    const r = new Rec('F1').alternate(12);
    expect(r.s.inTiebreak).toBe(true);
    r.point('A', 7);
    expect(r.s.completedSets[0]).toEqual({ games: { A: 7, B: 6 }, tiebreak: { A: 7, B: 0 } });
  });

  it('format 3 (4 jeux, jeu décisif à 4-4) : 4-2, 5-3 et 5-4', () => {
    expect(new Rec('F3').alternate(4).games('A', 2).s.completedSets[0].games).toEqual({ A: 4, B: 2 });
    const r = new Rec('F3').alternate(6).games('A');
    expect(r.s.completedSets).toHaveLength(0); // 4-3
    r.games('A');
    expect(r.s.completedSets[0].games).toEqual({ A: 5, B: 3 });
    const t = new Rec('F3').alternate(8);
    expect(t.s.inTiebreak).toBe(true);
    t.point('B', 7);
    expect(t.s.completedSets[0].games).toEqual({ A: 4, B: 5 });
  });

  it('format 5 (3 jeux, jeu décisif à 2-2) : 3-1, puis 3-2 par jeu décisif', () => {
    expect(new Rec('F5').alternate(2).games('A', 2).s.completedSets[0].games).toEqual({ A: 3, B: 1 });
    const t = new Rec('F5').alternate(4);
    expect(t.s.inTiebreak).toBe(true);
    t.point('A', 7);
    expect(t.s.completedSets[0].games).toEqual({ A: 3, B: 2 });
  });

  it('format 6 (4 jeux, jeu décisif à 3-3) : 4-2, puis 4-3 par jeu décisif', () => {
    expect(new Rec('F6').alternate(4).games('A', 2).s.completedSets[0].games).toEqual({ A: 4, B: 2 });
    const t = new Rec('F6').alternate(6);
    expect(t.s.inTiebreak).toBe(true);
    t.point('A', 7);
    expect(t.s.completedSets[0].games).toEqual({ A: 4, B: 3 });
  });

  it('format 7 (5 jeux, jeu décisif à 4-4) : 5-3, puis 5-4 par jeu décisif', () => {
    expect(new Rec('F7').alternate(6).games('A', 2).s.completedSets[0].games).toEqual({ A: 5, B: 3 });
    const t = new Rec('F7').alternate(8);
    expect(t.s.inTiebreak).toBe(true);
    t.point('B', 7);
    expect(t.s.completedSets[0].games).toEqual({ A: 4, B: 5 });
  });

  it('format 1 : 3e set classique', () => {
    const r = new Rec('F1').games('A', 6).games('B', 6);
    expect(r.s.isSuperTiebreakSet).toBe(false);
    r.games('A', 6);
    expect(r.s.winner).toBe('A');
  });

  it('format 2 : super jeu décisif en 10 points avec 2 points d\'écart', () => {
    const r = new Rec('F2').games('A', 6).games('B', 6);
    expect(r.s.isSuperTiebreakSet).toBe(true);
    r.point('A', 9).point('B', 9).point('A');
    expect(r.s.winner).toBeNull(); // 10-9
    r.point('A');
    expect(r.s.winner).toBe('A');
    expect(r.s.completedSets[2]).toEqual({ games: { A: 1, B: 0 }, tiebreak: { A: 11, B: 9 }, superTiebreak: true });
  });
});

describe('points et service', () => {
  it('point décisif à 40-40 (format 4)', () => {
    const r = new Rec('F4').point('A', 3).point('B', 3);
    expect(serveCourt(r.s, r.config)).toBe('receiver_choice');
    r.point('B');
    expect(r.s.games).toEqual({ A: 0, B: 1 });
  });

  it('avantage sans point décisif (format 1)', () => {
    const r = new Rec('F1').point('A', 3).point('B', 3).point('A');
    expect(formatPoints(r.s)).toEqual({ A: 'AV', B: '40' });
    r.point('B');
    expect(formatPoints(r.s)).toEqual({ A: '40', B: '40' });
  });

  it('faute, double faute, filet, ace et let', () => {
    const r = new Rec('F1');
    r.add({ kind: 'serve', call: 'fault' });
    expect(r.s.serveNumber).toBe(2);
    r.add({ kind: 'serve', call: 'net' });
    expect(r.s.serveNumber).toBe(2); // filet sur 2e balle : on rejoue la 2e balle
    r.add({ kind: 'serve', call: 'net_fault' });
    expect(r.s.points).toEqual({ A: 0, B: 1 }); // double faute
    expect(r.s.serveNumber).toBe(1);
    r.add({ kind: 'serve', call: 'ace' });
    expect(r.s.points).toEqual({ A: 1, B: 1 });
    r.add({ kind: 'serve', call: 'fault' });
    r.add({ kind: 'let' });
    expect(r.s.serveNumber).toBe(1); // let : deux services
  });

  it('côté du service', () => {
    const r = new Rec('F1');
    expect(serveCourt(r.s, r.config)).toBe('right');
    r.point('A');
    expect(serveCourt(r.s, r.config)).toBe('left');
  });

  it('ordre du service en jeu décisif et premier serveur du set suivant', () => {
    const r = new Rec('F1').alternate(12); // A sert le 1er jeu, donc le 13e (jeu décisif)
    expect(r.s.server).toBe('A');
    const servers = [];
    for (let i = 0; i < 6; i++) {
      servers.push(r.s.server);
      r.point(i % 2 === 0 ? 'A' : 'B');
    }
    expect(servers).toEqual(['A', 'B', 'B', 'A', 'A', 'B']);
    r.point('A', 4); // 7-3
    expect(r.s.completedSets).toHaveLength(1);
    expect(r.s.server).toBe('B'); // B a reçu le 1er point du jeu décisif
  });
});

describe('changements de côté et pauses', () => {
  it('après les jeux impairs ; pas de pause après le 1er jeu', () => {
    const r = new Rec('F1', { leftAtStart: 'A' }).games('A');
    expect(r.last.outcome.changeEnds).toBe(true);
    expect(r.last.outcome.rest).toBe('none');
    expect(leftPlayer(r.s, r.config)).toBe('B');
    r.games('B');
    expect(r.last.outcome.changeEnds).toBe(false);
    r.games('A');
    expect(r.last.outcome.rest).toBe('changeover');
    expect(leftPlayer(r.s, r.config)).toBe('A');
  });

  it('fin de set : pause de 2 minutes, changement si le set compte un nombre impair de jeux', () => {
    const odd = new Rec('F1').alternate(6).games('A', 3); // 6-3
    expect(odd.last.outcome.rest).toBe('set_break');
    expect(odd.last.outcome.changeEnds).toBe(true);

    const even = new Rec('F1').alternate(8).games('A', 2); // 6-4
    expect(even.last.outcome.rest).toBe('set_break');
    expect(even.last.outcome.changeEnds).toBe(false);
    even.games('B'); // 1er jeu du 2e set : changement sans pause
    expect(even.last.outcome.changeEnds).toBe(true);
    expect(even.last.outcome.rest).toBe('none');
  });

  it('jeu décisif : changement tous les 6 points, sans pause', () => {
    const r = new Rec('F1').alternate(12).point('A', 5);
    expect(r.last.outcome.changeEnds).toBe(false);
    r.point('B');
    expect(r.last.outcome.changeEnds).toBe(true);
    expect(r.last.outcome.rest).toBe('none');
  });

  it('dernière pause disponible pour le chronomètre, effacée au point suivant', () => {
    const r = new Rec('F1').games('A', 3);
    expect(r.r.lastRest?.rest).toBe('changeover');
    r.point('A');
    expect(r.r.lastRest).toBeNull();
  });
});
