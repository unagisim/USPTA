import { describe, expect, it } from 'vitest';
import { announce, type AnnounceContext } from '../src/lib/annonces';
import { Rec } from './helpers';

const ctx = (r: Rec): AnnounceContext => ({
  config: r.config,
  players: {
    A: { civility: 'M.', firstName: 'Paul', lastName: 'Dupont' },
    B: { civility: 'Mme', firstName: 'Julie', lastName: 'Martin' },
  },
});
const say = (r: Rec) => announce(r.last, ctx(r));

describe('annonces du score', () => {
  it('score dans le jeu, serveur en premier', () => {
    const r = new Rec('F1').point('A');
    expect(say(r)).toEqual(['15-0']);
    r.point('B');
    expect(say(r)).toEqual(['15 partout']);
    r.point('B');
    expect(say(r)).toEqual(['15-30']);
    r.point('A').point('A').point('B');
    expect(say(r)).toEqual(['Égalité']);
    r.point('B');
    expect(say(r)).toEqual(['Avantage Mme Julie Martin']);
  });

  it('point décisif', () => {
    const r = new Rec('F4').point('A', 3).point('B', 3);
    expect(say(r)).toEqual(['Point décisif, choix du relanceur']);
  });

  it('fin de jeu', () => {
    const r = new Rec('F1').games('A');
    expect(say(r)).toEqual(['Jeu M. Paul Dupont.', 'M. Paul Dupont mène 1 jeu à 0, première manche']);
    r.games('B');
    expect(say(r)).toEqual(['Jeu Mme Julie Martin.', '1 jeu partout, première manche']);
  });

  it('entrée dans le jeu décisif et score du jeu décisif', () => {
    const r = new Rec('F1').alternate(12);
    expect(say(r)).toEqual(['Jeu Mme Julie Martin.', '6 jeux partout, jeu décisif']);
    r.point('B');
    expect(say(r)).toEqual(['1-0 Mme Julie Martin']);
    r.point('A');
    expect(say(r)).toEqual(['1 partout']);
  });

  it('fin de set, super jeu décisif et fin de match', () => {
    const r = new Rec('F2').alternate(8).games('A', 2);
    expect(say(r)).toEqual(['Jeu et première manche M. Paul Dupont, 6 jeux à 4']);
    r.alternate(6, 'A').games('B', 3); // 3-6
    expect(say(r)).toEqual(['Jeu et deuxième manche Mme Julie Martin, 6 jeux à 3', 'Une manche partout, super jeu décisif']);
    r.point('A', 7).point('B', 7).point('A', 3); // 10-7
    expect(say(r)).toEqual(['Jeu, manche et match M. Paul Dupont, 6-4 3-6 10-7']);
  });
});

describe('annonces au service et sanctions', () => {
  it('faute, filet, double faute', () => {
    const r = new Rec('F1');
    r.add({ kind: 'serve', call: 'net' });
    expect(say(r)).toEqual(['Filet, premier service']);
    r.add({ kind: 'serve', call: 'fault' });
    expect(say(r)).toEqual(['Faute']);
    r.add({ kind: 'serve', call: 'net' });
    expect(say(r)).toEqual(['Filet, deuxième service']);
    r.add({ kind: 'serve', call: 'net_fault' });
    expect(say(r)).toEqual(['Filet, faute', '0-15']);
  });

  it('let pendant l\'échange', () => {
    const r = new Rec('F1');
    r.add({ kind: 'let' });
    expect(say(r)).toEqual(['Let']);
  });

  it('code de conduite et dépassement de temps', () => {
    const r = new Rec('F1');
    r.add({ kind: 'conduct', player: 'B', offence: 'abus de balle' });
    expect(say(r)).toEqual(['Infraction au code de conduite, abus de balle, avertissement, Mme Julie Martin']);
    r.add({ kind: 'conduct', player: 'B', offence: 'abus de balle' });
    expect(say(r)).toEqual(['Infraction au code de conduite, abus de balle, point de pénalité, Mme Julie Martin', '15-0']);
    r.add({ kind: 'time_violation', player: 'A' });
    expect(say(r)).toEqual(['Dépassement de temps, avertissement, M. Paul Dupont']);
  });

  it('abandon', () => {
    const r = new Rec('F1');
    r.add({ kind: 'end', type: 'retirement', loser: 'B' });
    expect(say(r)).toEqual(['Victoire de M. Paul Dupont par abandon']);
  });

  it('balles neuves annoncées après le jeu', () => {
    const r = new Rec('F1', { balls: { mode: 'regulation', first: 7, every: 9, warmupGames: 2 } }).alternate(5);
    expect(say(r)).toContain('Balles neuves');
  });
});
