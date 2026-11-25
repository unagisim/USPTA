import { describe, expect, it } from 'vitest';
import { announce, presentation, type AnnounceContext } from '../src/lib/annonces';
import { FORMATS, orderFor, receiverIndex } from '../src/lib/engine';
import { Rec } from './helpers';

const dbl = (format: 'F1' | 'F4' = 'F1') => new Rec(format, { serveOrder: { A: 0, B: 1 } });
/** Serveur du prochain point : équipe et joueur. */
const who = (r: Rec) => `${r.s.server}${r.r.serverIndex}`;

describe('double : ordre de service', () => {
  it('chaque équipe alterne ses joueurs de jeu en jeu', () => {
    const r = dbl();
    const seen = [who(r)];
    for (let i = 0; i < 5; i++) seen.push(who(r.games(i % 2 === 0 ? 'A' : 'B')));
    expect(seen).toEqual(['A0', 'B1', 'A1', 'B0', 'A0', 'B1']);
  });

  it('le jeu décisif poursuit la rotation, par séries de points', () => {
    const r = dbl().alternate(12); // 6-6 : A0 B1 A1 B0 … 12 jeux, A0 serait au service
    expect(who(r)).toBe('A0');
    expect(r.s.inTiebreak).toBe(true);
    const seen = [];
    for (let i = 0; i < 5; i++) {
      r.point(i % 2 === 0 ? 'A' : 'B');
      seen.push(who(r));
    }
    // Après 1 point : B1 sert 2 points, puis A1 2 points, puis B0.
    expect(seen).toEqual(['B1', 'B1', 'A1', 'A1', 'B0']);
  });

  it("l'ordre peut changer au début d'une manche", () => {
    const r = dbl().games('A', 6);
    r.add({ kind: 'serve_order', first: { A: 1, B: 0 } });
    // 2e manche : A sert en premier (B a servi le 6e jeu), cette fois avec son joueur 1.
    expect(who(r)).toBe('A1');
    r.games('B');
    expect(who(r)).toBe('B0');
    expect(r.r.serveOrderSet).toBe(2);
  });

  it('le journal garde le joueur au service de chaque point', () => {
    const r = dbl().games('A').point('B');
    const last = r.r.log[r.r.log.length - 1];
    expect(last.before.server).toBe('B');
    expect(last.serverIndex).toBe(1);
  });

  it('en simple, toujours le joueur 0', () => {
    const r = new Rec('F1').games('A', 3);
    expect(r.r.serverIndex).toBe(0);
  });
});


const players = {
  A: { civility: 'M.' as const, firstName: 'Paul', lastName: 'Dupont' },
  B: { civility: 'Mme' as const, firstName: 'Julie', lastName: 'Martin' },
};
const partners = {
  A: { civility: 'M.' as const, firstName: 'Luc', lastName: 'Bernard' },
  B: { civility: 'Mme' as const, firstName: 'Anne', lastName: 'Petit' },
};
const ctx = (r: Rec): AnnounceContext => ({ config: r.config, players, partners });

describe('double : annonces', () => {
  it("nom des équipes et joueur au service après le premier jeu", () => {
    const r = dbl().games('A');
    expect(announce(r.last, ctx(r))).toEqual(['Jeu Dupont / Bernard, premier jeu.', 'Au service Mme Petit']);
  });

  it('abandon au pluriel', () => {
    const r = dbl().games('A');
    r.add({ kind: 'end', type: 'retirement', loser: 'B' });
    expect(announce(r.last, ctx(r))).toEqual([
      "Mesdames, messieurs, Mme Martin et Mme Petit sont contraintes d'abandonner, jeu set et match Dupont / Bernard 1/0.",
    ]);
  });

  it('présentation des équipes et tirage au pluriel', () => {
    const lines = presentation({ competition: '', round: '', players, partners, left: 'A', format: FORMATS.F4, toss: { winner: 'B', choice: 'receive' } });
    expect(lines[0]).toBe(
      'Match, opposant à droite de la chaise Mme Julie Martin et Mme Anne Petit, à gauche de la chaise M. Paul Dupont et M. Luc Bernard.',
    );
    expect(lines[2]).toBe('Mme Julie Martin et Mme Anne Petit ont gagné le tirage au sort et ont choisi de recevoir.');
  });
});


describe('double : relanceurs', () => {
  it('le relanceur alterne avec le côté du service, et change en début de manche', () => {
    const r = new Rec('F1', { serveOrder: { A: 0, B: 0 }, receiveOrder: { A: 0, B: 1 } });
    const rcv = () => receiverIndex(r.s, r.config, r.r.receiveOrder);
    expect(rcv()).toBe(1); // B relance, côté droit : son joueur 1
    r.point('A');
    expect(rcv()).toBe(0); // côté gauche
    r.point('A', 3).games('A', 5); // 6-0
    r.add({ kind: 'serve_order', first: { A: 0, B: 0 }, receive: { A: 1, B: 0 } });
    // 2e manche : A sert (B a servi le dernier jeu) ; B relance côté droit avec son joueur 0.
    expect(r.s.server).toBe('A');
    expect(rcv()).toBe(0);
  });

  it('point décisif : choix de l\'équipe en relance', () => {
    const r = new Rec('F4', { serveOrder: { A: 0, B: 0 }, receiveOrder: { A: 0, B: 0 } }).point('A', 3).point('B', 3);
    expect(receiverIndex(r.s, r.config, r.r.receiveOrder)).toBeNull();
  });
});

describe('double : correction des positions', () => {
  it('le bon joueur sert tout de suite, les points joués ne changent pas', () => {
    const r = dbl().games('A').games('B').point('A'); // 3e jeu : A1 au service
    expect(who(r)).toBe('A1');
    const before = r.r.log.map((e) => e.serverIndex);
    r.add({ kind: 'serve_order', first: orderFor(r.r, { A: 0, B: 0 }), reason: 'Erreur de serveur' });
    expect(who(r)).toBe('A0');
    expect(r.r.log.map((e) => e.serverIndex)).toEqual(before);
    r.point('A', 3); // fin du jeu : B sert avec le joueur demandé
    expect(who(r)).toBe('B0');
  });
});
