<script lang="ts">
  import Countdown from '../components/Countdown.svelte';
  import { COLORS, type PlayerColor } from '../lib/colors';
  import CoinToss_ from '../components/CoinToss.svelte';
  import type { CoinToss, TossChoice } from '../lib/db';
  import { ballsRule, presentation, TWO_MINUTES } from '../lib/annonces';
  import { clock } from '../lib/device';
  import { FORMATS, other, PRESENTATION_AT, PRESENTATION_AT_DOUBLES, WARMUP_TWO_MINUTES, type Side } from '../lib/engine';
  import { app, nameStyle, type LiveMatch } from '../lib/state.svelte';

  let { live, onExit }: { live: LiveMatch; onExit: () => void } = $props();

  const m = $derived(live.m);
  const name = (s: Side) => live.name(s);
  const format = $derived(FORMATS[m.formatId]);
  /** Présentation à 40 s de la fin de l'échauffement, 50 s en double. */
  const presAt = $derived(live.doubles ? PRESENTATION_AT_DOUBLES : PRESENTATION_AT);
  const presClock = $derived(`0:${String(presAt).padStart(2, '0')}`);
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
  // Points à évoquer, rédigés d'après ce qui a été saisi à la création du match.
  const topics = $derived.by((): string[] => {
    const f = format;
    const i = m.info;
    const officials =
      i.lineJudges && i.ballKids
        ? 'Juges de ligne et ramasseurs de balles présents'
        : i.lineJudges
          ? 'Juges de ligne présents, pas de ramasseurs de balles'
          : i.ballKids
            ? 'Ramasseurs de balles présents, pas de juges de ligne'
            : 'Ni juges de ligne ni ramasseurs de balles';
    return [
      `Partie au meilleur des 3 manches${f.gamesPerSet === 6 ? '' : ` de ${f.gamesPerSet} jeux`}`,
      `Jeu décisif à ${f.tiebreakAt} jeux partout ${f.finalSetSuperTiebreak ? 'dans les deux premières manches' : 'dans toutes les manches'}`,
      f.finalSetSuperTiebreak ? `Troisième manche en super jeu décisif à ${f.superTiebreakPoints} points` : '',
      f.decidingPoint ? 'Point décisif à égalité, choix au relanceur' : '',
      ballsRule(m.balls),
      i.surface === 'clay' ? 'Procédure sur terre battue : vérification des marques de balle' : '',
      officials,
      `${warmupMin} minutes d'échauffement`,
      'Questions ?',
    ].filter(Boolean);
  });

  const CHOICES: [TossChoice, string][] = [
    ['serve', 'Servir'],
    ['receive', 'Recevoir'],
    ['side', 'Choisir le côté'],
    ['defer', "Laisser le choix à l'adversaire"],
  ];

  async function setToss(winner: Side, choice: TossChoice | null, coin?: CoinToss) {
    // Le tirage fait avec la pièce de l'application est gardé quand le gagnant fait son choix.
    const kept = coin ?? (m.toss?.winner === winner ? m.toss?.coin : undefined);
    m.toss = { winner, choice, ...(kept ? { coin: kept } : {}) };
    if (choice === 'serve') m.firstServer = winner;
    if (choice === 'receive') m.firstServer = other(winner);
    await live.save();
  }
  async function resetToss() {
    m.toss = null;
    await live.save();
  }
  async function setServer(s: Side) {
    m.firstServer = s;
    await live.save();
  }
  async function setColor(s: Side, c: PlayerColor) {
    m.colors = { ...live.colors, [s]: c };
    await live.save();
  }
  async function setOrder(s: Side, i: 0 | 1) {
    m.serveOrder = { ...(m.serveOrder ?? { A: 0, B: 0 }), [s]: i };
    await live.save();
  }
  async function setReceive(s: Side, i: 0 | 1) {
    m.receiveOrder = { ...(m.receiveOrder ?? { A: 0, B: 0 }), [s]: i };
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
    if (warmupLeft <= presAt) return 'presentation';
    if (warmupLeft <= WARMUP_TWO_MINUTES && warmupLeft > WARMUP_TWO_MINUTES - 15) return 'two_minutes';
    if (warmupLeft <= WARMUP_TWO_MINUTES) return 'before_presentation';
    return 'before_two_minutes';
  });

  const intro = $derived(
    presentation({
      competition: m.info.tournament,
      round: m.info.round,
      players: m.players,
      ...(live.doubles && m.partners ? { partners: m.partners } : {}),
      left: m.leftAtStart,
      format,
      toss: m.toss,
      nameStyle: nameStyle(),
      team: !!m.info.team,
    }),
  );

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
          {#each topics as topic (topic)}<li>{topic}</li>{/each}
        </ul>
      </li>
      <li>Effectuer le tirage au sort (pièce de l'application ci-dessous, ou vraie pièce)</li>
      <li>Désigner clairement le gagnant du tirage</li>
      <li>Monter sur la chaise et lancer l'échauffement</li>
    </ol>
  </details>

  <div class="card stack">
    <h2>Couleur de la tenue</h2>
    <p class="muted hint">Chaque joueur garde sa couleur tout le match : boutons de point, tableau de score, sanctions et feuille.</p>
    {#each ['A', 'B'] as const as s (s)}
      <div>
        <label for="col{s}">{name(s)}</label>
        <div class="swatches" id="col{s}" role="radiogroup" aria-label="Couleur de {name(s)}">
          {#each COLORS as [c, label] (c)}
            {@const taken = live.colors[other(s)] === c}
            <button
              class="swatch c-{c}"
              role="radio"
              aria-checked={live.colors[s] === c}
              aria-label={label}
              title={taken ? `${label} : déjà prise` : label}
              disabled={taken}
              onclick={() => setColor(s, c)}
            ></button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <div class="card stack">
    <h2>Tirage au sort et placement</h2>
    <CoinToss_
      names={{ A: name('A'), B: name('B') }}
      done={m.toss?.coin ?? null}
      onResult={(w, coin) => setToss(w, null, coin)}
      onReset={resetToss}
    />
    {#if !m.toss?.coin}
      <div>
        <label for="tw">Ou tirage fait avec une vraie pièce : gagnant</label>
        <div class="seg" id="tw">
          {#each ['A', 'B'] as const as s (s)}
            <button aria-pressed={m.toss?.winner === s} onclick={() => setToss(s, m.toss?.choice ?? null)}>{name(s)}</button>
          {/each}
        </div>
      </div>
    {/if}
    {#if m.toss}
      {@const toss = m.toss}
      <div>
        <label for="tc">Choix de {name(toss.winner)}{toss.choice ? '' : ' (à saisir)'}</label>
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
      <label for="fs">{live.doubles ? 'Équipe au service' : 'Premier serveur'}</label>
      <div class="seg" id="fs">
        {#each ['A', 'B'] as const as s (s)}
          <button aria-pressed={m.firstServer === s} onclick={() => setServer(s)}>{name(s)}</button>
        {/each}
      </div>
    </div>
    {#if live.doubles}
      {#each ['A', 'B'] as const as s (s)}
        <div>
          <label for="so{s}">Premier serveur de l'équipe {name(s)}</label>
          <div class="seg" id="so{s}">
            {#each [0, 1] as const as i (i)}
              <button aria-pressed={(m.serveOrder ?? { A: 0, B: 0 })[s] === i} onclick={() => setOrder(s, i)}>{live.playerOf(s, i)}</button>
            {/each}
          </div>
        </div>
        <div>
          <label for="ro{s}">Relanceur côté droit de l'équipe {name(s)}</label>
          <div class="seg" id="ro{s}">
            {#each [0, 1] as const as i (i)}
              <button aria-pressed={(m.receiveOrder ?? { A: 0, B: 0 })[s] === i} onclick={() => setReceive(s, i)}>{live.playerOf(s, i)}</button>
            {/each}
          </div>
        </div>
      {/each}
      <p class="muted hint">Les positions en relance ne changent qu'au début de chaque manche ; l'application les redemande alors.</p>
    {/if}
    <div>
      <label for="lp">{live.doubles ? 'Équipe à gauche de la chaise' : 'Joueur à gauche de la chaise'}</label>
      <div class="seg" id="lp">
        {#each ['A', 'B'] as const as s (s)}
          <button aria-pressed={m.leftAtStart === s} onclick={() => setLeft(s)}>{name(s)}</button>
        {/each}
      </div>
    </div>
  </div>

  <div class="card stack">
    <h2>Échauffement</h2>
    {#if warmup}
      {#key warmup.start}
        <Countdown
          label="Échauffement"
          start={warmup.start}
          duration={app.settings.durations.warmup}
          alerts={[WARMUP_TWO_MINUTES, presAt, 0]}
          endText="Fin de l'échauffement"
          onStop={stopWarmup}
        />
      {/key}
      {#if stage === 'presentation'}
        <div class="speech call">
          {#each intro as line (line)}<p class:missing={line.includes('[')}>{line}</p>{/each}
        </div>
      {:else if stage === 'two_minutes'}
        <p class="call">« {TWO_MINUTES} »</p>
      {:else if stage === 'before_two_minutes'}
        <p class="next">À 2:00 : annoncer « {TWO_MINUTES} »</p>
      {:else if stage === 'before_presentation'}
        <p class="next">À {presClock} : présentation du match (ci-dessous)</p>
      {/if}
    {:else}
      <button class="primary" onclick={startWarmup}>Lancer l'échauffement ({clock(app.settings.durations.warmup * 1000)})</button>
    {/if}
  </div>

  <div class="card stack">
    <h2>Présentation du match <span class="muted">à {presClock}</span></h2>
    <div class="speech">
      {#each intro as line (line)}<p class:missing={line.includes('[')}>{line}</p>{/each}
    </div>
  </div>

  <button class="primary wide" onclick={startMatch}>Début du match</button>
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
  .hint {
    font-size: 13px;
    margin: 0;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .swatch {
    width: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: 50%;
    background: var(--p-swatch);
    border: 2px solid var(--border);
  }
  .swatch[aria-checked='true'] {
    outline: 3px solid var(--text);
    outline-offset: 2px;
  }
  .swatch:disabled {
    opacity: 0.25;
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
</style>
