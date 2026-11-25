import { describe, expect, it } from 'vitest';
import { describeEntry } from '../src/lib/describe';
import { serveStatRows, serveStats } from '../src/lib/engine';
import { setTimes } from '../src/lib/sheet';
import { Rec } from './helpers';

const names = { A: 'Dupont', B: 'Mme Martin' };

describe('statistiques au service', () => {
  it('1res balles, 2es balles, aces, doubles fautes et filets', () => {
    const r = new Rec('F1');
    r.add({ kind: 'serve', call: 'ace' }); // A sert : ace 1re balle
    r.add({ kind: 'serve', call: 'net' }); // filet, 1er service
    r.point('A'); // 1re balle, gagné
    r.add({ kind: 'serve', call: 'fault' });
    r.point('B'); // 2e balle, perdu
    r.add({ kind: 'serve', call: 'fault' });
    r.add({ kind: 'serve', call: 'net_fault' }); // double faute
    const a = serveStats(r.r.log).A;
    expect(a).toEqual({ points: 4, firstIn: 2, firstWon: 2, second: 2, secondWon: 0, aces: 1, doubleFaults: 1, nets: 1 });
    expect(serveStatRows(serveStats(r.r.log))[1]).toEqual(['1res balles dans le court', '2/4 (50 %)', '–']);
  });

  it('les pénalités et les saisies annulées ne comptent pas', () => {
    const r = new Rec('F1');
    r.point('A');
    const id = r.add({ kind: 'serve', call: 'ace' });
    r.add({ kind: 'undo', target: id });
    r.add({ kind: 'conduct', player: 'B', offence: 'Insulte' });
    r.add({ kind: 'conduct', player: 'B', offence: 'Insulte' }); // point de pénalité
    expect(serveStats(r.r.log).A.points).toBe(1);
  });

  it('par manche', () => {
    const r = new Rec('F1').games('A', 6).point('B');
    expect(serveStats(r.r.log, 1).A.points + serveStats(r.r.log, 1).B.points).toBe(24);
    expect(serveStats(r.r.log, 2).A.points).toBe(1); // A sert le 1er jeu de la 2e manche
  });

  it('chaque point indique le serveur et la balle', () => {
    const r = new Rec('F1');
    r.add({ kind: 'serve', call: 'fault' });
    r.point('B');
    expect(describeEntry(r.r.log[1], names)).toBe('Point Mme Martin (service Dupont, 2e balle)');
    r.add({ kind: 'serve', call: 'ace' });
    expect(describeEntry(r.r.log[2], names)).toBe('Ace Dupont (1re balle)');
  });
});


describe('heures des manches', () => {
  it('début et fin de chaque manche', () => {
    const r = new Rec('F1');
    r.add({ kind: 'start' });
    r.games('A', 6).games('B', 2);
    const t = setTimes(r.r);
    expect(t.length).toBe(2);
    expect(t[0].start).toBe(r.events[0].ts);
    expect(t[0].end).toBe(r.events[24].ts); // 24e point : fin de la 1re manche
    expect(t[1].start).toBe(r.events[25].ts);
    expect(t[1].end).toBeNull();
  });
});
