<script lang="ts">
  import Countdown from '../components/Countdown.svelte';
  import type { TossChoice } from '../lib/db';
  import { ballsRule, playCall, presentation, TWO_MINUTES } from '../lib/annonces';
  import { clock } from '../lib/device';
  import { FORMATS, other, PRESENTATION_AT, WARMUP_CALLS, WARMUP_TWO_MINUTES, type Side } from '../lib/engine';
  import { app, type LiveMatch } from '../lib/state.svelte';

  let { live, onExit }: { live: LiveMatch; onExit: () => void } = $props();

  const m = $derived(live.m);
  const name = (s: Side) => live.name(s);
  const format = $derived(FORMATS[m.formatId]);
  const warmupMin = $derived(Math.round(app.settings.durations.warmup / 60));

  // Mémo de la procédure d'avant-match, dans l'ordre : rien à cocher, seulement à lire.
  const COURT = [
    'Court propre et prêt pour la compétition',
    'Aucune balle usagée sur le court',
    "Chaises des joueurs et de l'arbitre en place",
    'Piquets de simple : 0,914 m, ligne comprise',
    'Hauteur du filet au centre : 0,914 m',
    'Tension du filet',
  ];
  const MEETING_BEFORE = [
    "Convoquer les joueurs pour la réunion d'avant-match",
    "Se placer au centre du court, face à la chaise d'arbitre",
    'Donner les balles aux joueurs',
  ];
  const topics = $derived.by((): [string, string][] => {
    const f = format;
    const tb = [
      `à ${f.tiebreakAt} jeux partout${f.finalSetSuperTiebreak ? ' dans les deux premières manches' : ' dans toutes les manches'}`,
      f.finalSetSuperTiebreak ? `super jeu décisif à ${f.superTiebreakPoints} points en 3e manche` : '',
      f.decidingPoint ? 'point décisif à égalité' : '',
    ].filter(Boolean);
    return [
      ['Nombre de manches', `au meilleur des 3 manches${f.gamesPerSet === 6 ? '' : ` de ${f.gamesPerSet} jeux`}`],
      ['Application du jeu décisif', tb.join(' ; ')],
      ['Nombre et changements de balles', ballsRule(m.balls)],
      ['Procédure sur terre battue', 'si le court est en terre battue'],
      ['Présence de juges de ligne et de ramasseurs de balles', ''],
      [`${warmupMin} minutes d'échauffement`, ''],
      ['Questions ?', ''],
    ];
  });

  const CHOICES: [TossChoice, string][] = [
    ['serve', 'Servir'],
    ['receive', 'Recevoir'],
    ['side', 'Choisir le côté'],
    ['defer', "Laisser le choix à l'adversaire"],
  ];

  async function setToss(winner: Side, choice: TossChoice) {
    m.toss = { winner, choice };
    if (choice === 'serve') m.firstServer = winner;
    if (choice === 'receive') m.firstServer = other(winner);
    await live.save();
  }
  async function setServer(s: Side) {
    m.firstServer = s;
    await live.save();
  }
  async function setLeft(s: Side) {
    m.leftAtStart = s;
    await live.save();
  }

  // Échauffement : un événement « timer » permet de le retrouver si l'application est relancée.
  const warmup = $derived(live.result.activeTimer?.timer === 'warmup' ? live.result.activeTimer : null);
  const warmupLeft = $derived(warmup ? app.settings.durations.warmup - (app.now - warmup.start) / 1000 : null);
  /** Étape de l'échauffement : avant les 2 minutes, annonce des 2 minutes (15 s), attente, présentation. */
  const stage = $derived.by(() => {
    if (warmupLeft === null) return 'idle';
    if (warmupLeft <= PRESENTATION_AT) return 'presentation';
    if (warmupLeft <= WARMUP_TWO_MINUTES && warmupLeft > WARMUP_TWO_MINUTES - 15) return 'two_minutes';
    if (warmupLeft <= WARMUP_TWO_MINUTES) return 'before_presentation';
    return 'before_two_minutes';
  });

  const intro = $derived(
    presentation({
      competition: m.info.tournament,
      round: m.info.round,
      players: m.players,
      left: m.leftAtStart,
      format,
      toss: m.toss,
      nameStyle: app.settings.nameStyle,
    }),
  );
  const firstCall = $derived(playCall(m.players[m.firstServer], app.settings.nameStyle));

  async function startWarmup() {
    await live.add({ kind: 'timer', timer: 'warmup', action: 'start' });
  }
  async function stopWarmup() {
    await live.add({ kind: 'timer', timer: 'warmup', action: 'stop' });
  }

  async function startMatch() {
    if (warmup) await stopWarmup();
    await live.add({ kind: 'start' });
    m.phase = 'live';
    await live.save();
  }
</script>

<div class="page">
  <div class="topbar">
    <button class="ghost" onclick={onExit}>← Accueil</button>
    <h1>Avant le match</h1>
  </div>

  <div class="card">
    <p><strong>{m.info.tournament || 'Compétition non renseignée'}</strong></p>
    <p class="muted">
      {[m.info.round, m.info.court ? `Court ${m.info.court}` : '', format.label].filter(Boolean).join(' · ')}
    </p>
    <p>{name('A')} – {name('B')}</p>
  </div>

  <details class="card memo" open={!warmup}>
    <summary><h2>Mémo d'avant-match</h2></summary>
    <h3>Sur le court</h3>
    <ol>
      {#each COURT as step (step)}<li>{step}</li>{/each}
    </ol>
    <h3>Réunion d'avant-match</h3>
    <ol start={COURT.length + 1}>
      {#each MEETING_BEFORE as step (step)}<li>{step}</li>{/each}
      <li>
        Évoquer :
        <ul>
          {#each topics as [topic, detail] (topic)}
            <li>{topic}{#if detail}<span class="muted"> : {detail}</span>{/if}</li>
          {/each}
        </ul>
      </li>
      <li>Effectuer le tirage au sort</li>
      <li>Désigner clairement le gagnant du tirage</li>
    </ol>
    <h3>Sur la chaise</h3>
    <ol start={COURT.length + MEETING_BEFORE.length + 4}>
      <li>Lancer l'échauffement</li>
      <li>Saisir le tirage au sort et la place des joueurs</li>
      <li>Annoncer « {TWO_MINUTES} » à 2:00</li>
      <li>Présenter le match à 0:{String(PRESENTATION_AT).padStart(2, '0')}</li>
    </ol>
  </details>

  <div class="card stack">
    <h2>Échauffement</h2>
    {#if warmup}
      {#key warmup.start}
        <Countdown
          label="Échauffement"
          start={warmup.start}
          duration={app.settings.durations.warmup}
          alerts={WARMUP_CALLS}
          endText="Fin de l'échauffement"
          onStop={stopWarmup}
        />
      {/key}
      {#if stage === 'presentation'}
        <div class="speech call">
          {#each intro as line (line)}<p class:missing={line.startsWith('[')}>{line}</p>{/each}
        </div>
      {:else if stage === 'two_minutes'}
        <p class="call">« {TWO_MINUTES} »</p>
      {:else if stage === 'before_two_minutes'}
        <p class="next">À 2:00 : annoncer « {TWO_MINUTES} »</p>
      {:else if stage === 'before_presentation'}
        <p class="next">À 0:{String(PRESENTATION_AT).padStart(2, '0')} : présentation du match (ci-dessous)</p>
      {/if}
    {:else}
      <button class="primary" onclick={startWarmup}>Lancer l'échauffement ({clock(app.settings.durations.warmup * 1000)})</button>
    {/if}
  </div>

  <div class="card stack">
    <h2>Tirage au sort et placement</h2>
    <div>
      <label for="tw">Gagnant du tirage</label>
      <div class="seg" id="tw">
        {#each ['A', 'B'] as const as s (s)}
          <button aria-pressed={m.toss?.winner === s} onclick={() => setToss(s, m.toss?.choice ?? 'serve')}>{name(s)}</button>
        {/each}
      </div>
    </div>
    {#if m.toss}
      {@const toss = m.toss}
      <div>
        <label for="tc">Son choix</label>
        <div class="seg" id="tc">
          {#each CHOICES as [c, label] (c)}
            <button aria-pressed={toss.choice === c} onclick={() => setToss(toss.winner, c)}>{label}</button>
          {/each}
        </div>
      </div>
      {#if toss.choice === 'side' || toss.choice === 'defer'}
        <p class="muted">L'adversaire fait le choix restant : servir, recevoir ou côté.</p>
      {/if}
    {/if}
    <div>
      <label for="fs">Premier serveur</label>
      <div class="seg" id="fs">
        {#each ['A', 'B'] as const as s (s)}
          <button aria-pressed={m.firstServer === s} onclick={() => setServer(s)}>{name(s)}</button>
        {/each}
      </div>
    </div>
    <div>
      <label for="lp">Joueur à gauche de la chaise</label>
      <div class="seg" id="lp">
        {#each ['A', 'B'] as const as s (s)}
          <button aria-pressed={m.leftAtStart === s} onclick={() => setLeft(s)}>{name(s)}</button>
        {/each}
      </div>
    </div>
  </div>

  <div class="card stack">
    <h2>Présentation du match <span class="muted">à 0:{String(PRESENTATION_AT).padStart(2, '0')}</span></h2>
    <div class="speech">
      {#each intro as line (line)}<p class:missing={line.startsWith('[')}>{line}</p>{/each}
    </div>
  </div>

  <button class="primary wide" onclick={startMatch}>Début du match</button>
  <p class="muted center">Puis, avant le premier service : « {firstCall} »</p>
</div>

<style>
  .card p {
    margin: 4px 0;
  }
  .memo summary {
    cursor: pointer;
    list-style-position: inside;
  }
  .memo summary h2 {
    display: inline;
  }
  h3 {
    font-size: 15px;
    margin: 14px 0 4px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  ol {
    margin: 0;
    padding-left: 26px;
  }
  ol > li {
    padding: 3px 0;
  }
  ul {
    margin: 4px 0 0;
    padding-left: 18px;
  }
  ul li {
    padding: 2px 0;
  }
  .next {
    margin: 0;
    font-weight: 600;
  }
  .call {
    background: var(--call-bg);
    color: var(--call-fg);
    border-radius: var(--radius);
    padding: 12px;
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    margin: 0;
  }
  .speech p {
    margin: 0 0 6px;
  }
  .speech.call {
    font-size: 20px;
    text-align: left;
    line-height: 1.3;
  }
  .missing {
    color: var(--danger);
    font-weight: 600;
  }
  .speech.call .missing {
    color: inherit;
    opacity: 0.7;
  }
  .wide {
    width: 100%;
    min-height: 64px;
    font-size: 18px;
  }
  .center {
    text-align: center;
  }
</style>
