<script lang="ts">
  import Scoreboard from '../components/Scoreboard.svelte';
  import Countdown from '../components/Countdown.svelte';
  import SanctionSheet from '../components/SanctionSheet.svelte';
  import TimeSheet from '../components/TimeSheet.svelte';
  import CorrectionSheet from '../components/CorrectionSheet.svelte';
  import EndSheet from '../components/EndSheet.svelte';
  import { fr, playCall, scoreCall } from '../lib/annonces';
  import { clock } from '../lib/device';
  import { leftPlayer, other, pointSituation, REST_ALERTS, RESUME_CALL_AT, serveCourt, type EventInput, type Side } from '../lib/engine';
  import { app, type LiveMatch } from '../lib/state.svelte';

  let { live, onExit, onSheet }: { live: LiveMatch; onExit: () => void; onSheet: () => void } = $props();

  const s = $derived(live.state);
  const r = $derived(live.result);
  const left = $derived(leftPlayer(s, live.config));
  const right = $derived(other(left));
  const names = $derived({ A: live.name('A'), B: live.name('B') });
  const over = $derived(s.winner !== null);

  /** Message après une annulation ou une correction ; remplace l'annonce de la dernière saisie. */
  let flash = $state<string[] | null>(null);
  // Avant le premier point : lancement du match.
  const call = $derived(
    flash ??
      (r.activeTimer?.timer === 'interruption'
        ? [fr.interrupted]
        : r.log.length
          ? live.lastCall
          : [playCall(live.m.players[s.server], !!live.m.info.team)]),
  );

  let panel = $state<'none' | 'sanction' | 'time' | 'correct' | 'end'>('none');

  async function add(e: EventInput) {
    flash = null;
    await live.add(e);
  }
  async function undo() {
    if (await live.undo()) flash = ['Saisie annulée', live.state.winner ? '' : scoreCall(live.state, live.ctx)].filter(Boolean);
  }
  function corrected(message: string) {
    panel = 'none';
    flash = [message, live.state.winner ? '' : scoreCall(live.state, live.ctx)].filter(Boolean);
  }

  // ---- Rappels pour l'arbitre ----
  const lastOutcome = $derived(r.log.length ? r.log[r.log.length - 1].outcome : null);
  const hints = $derived.by(() => {
    const h: string[] = [];
    if (over) return h;
    const o = flash ? null : lastOutcome;
    if (o?.changeEnds) h.push(o.rest === 'none' ? 'Changement de côté, sans pause' : 'Changement de côté');
    if (o?.tiebreakStarts) h.push(`Jeu décisif : ${names[s.server]} au service`);
    if (o?.superTiebreakStarts) h.push(`Super jeu décisif : ${names[s.server]} au service`);
    if (o?.newBalls) h.push('Balles neuves');
    if (r.ballsDelayed) h.push('Balles neuves reportées au 2e jeu de la manche suivante');
    const sit = pointSituation(s, live.config);
    if (sit.matchPoint) h.push(`Balle de match ${names[sit.matchPoint]}`);
    else if (sit.setPoint) h.push(`Balle de manche ${names[sit.setPoint]}`);
    else if (sit.breakPoint) h.push('Balle de break');
    return h;
  });

  const court = $derived(serveCourt(s, live.config));
  const second = $derived(s.serveNumber === 2);
  const serveInfo = $derived(
    `${names[s.server]} · ${court === 'right' ? 'côté droit' : court === 'left' ? 'côté gauche' : 'choix du relanceur'}`,
  );

  // ---- Temps ----
  let dismissedRest = $state(0);
  const resume = { at: RESUME_CALL_AT, text: 'Reprise' };
  const rest = $derived(r.lastRest && r.lastRest.start !== dismissedRest && !r.activeTimer ? r.lastRest : null);
  const restDuration = $derived(rest?.rest === 'set_break' ? app.settings.durations.setBreak : app.settings.durations.changeover);
  /** Fin du dernier point, pour le temps écoulé entre les points (sans limite FFT). */
  const lastPointEnd = $derived.by(() => {
    for (let i = r.log.length - 1; i >= 0; i--) {
      const e = r.log[i];
      if (e.outcome.pointWinner || e.outcome.serveCall) return e.event.ts;
    }
    return r.start;
  });
  const matchTime = $derived(r.start ? (r.end ?? app.now) - r.start : 0);
  const active = $derived(r.activeTimer);
  const activeDuration = $derived(
    active?.timer === 'medical' ? app.settings.durations.medical : active?.timer === 'toilet' ? app.settings.durations.toilet : null,
  );
  const activeLabel = $derived(
    active
      ? {
          warmup: 'Échauffement',
          medical: `Soins ${active.player ? names[active.player] : ''}`,
          toilet: `Toilettes ${active.player ? names[active.player] : ''}`,
          interruption: 'Interruption',
        }[active.timer]
      : '',
  );
  async function stopActive() {
    if (active) await add({ kind: 'timer', timer: active.timer, action: 'stop', ...(active.player ? { player: active.player } : {}) });
  }
</script>

<div class="screen">
  <header>
    <button class="ghost" onclick={onExit} aria-label="Accueil">←</button>
    <span class="info">{live.m.info.court ? `Court ${live.m.info.court}` : live.m.info.tournament}</span>
    <span class="clock">{clock(matchTime)}</span>
    <button class="ghost" onclick={onSheet}>Feuille</button>
  </header>

  <Scoreboard score={s} {left} {names} colors={live.colors} />


  <div class="call" aria-live="polite">
    {#each call as line, i (i)}<p>{line}</p>{:else}<p class="empty">—</p>{/each}
  </div>

  {#if hints.length}
    <div class="hints">
      {#each hints as h (h)}<span>{h}</span>{/each}
    </div>
  {/if}

  <div class="timers">
    {#if active}
      {#if activeDuration !== null}
        {#key active.start}
          <Countdown label={activeLabel} start={active.start} duration={activeDuration} alerts={REST_ALERTS} cue={resume} onStop={stopActive} />
        {/key}
      {:else}
        <div class="elapsed strong">
          <span>{activeLabel}</span><b>{clock(app.now - active.start)}</b>
          <button class="ghost" onclick={stopActive}>Reprise</button>
        </div>
      {/if}
    {:else if rest && !over}
      {#key rest.start}
        <Countdown
          label={rest.rest === 'set_break' ? 'Fin de manche' : 'Changement de côté'}
          start={rest.start}
          duration={restDuration}
          alerts={REST_ALERTS}
          cue={resume}
          onStop={() => (dismissedRest = rest.start)}
        />
      {/key}
    {:else if lastPointEnd && !over}
      <div class="elapsed"><span>Depuis la fin du point</span><b>{clock(app.now - lastPointEnd)}</b></div>
    {/if}
  </div>

  {#if over}
    <div class="done">
      <button class="primary" onclick={onSheet}>Voir la feuille de match</button>
    </div>
  {:else}
    <section class="serve" class:second aria-label="Service">
      <div class="serve-head">
        <span class="num">{second ? '2e service' : '1er service'}</span>
        <span class="who">{serveInfo}</span>
      </div>
      <div class="serve-row">
        <button onclick={() => add({ kind: 'serve', call: 'fault' })}>
          {second ? 'Double faute' : 'Faute'}<small>« {fr.fault} »</small>
        </button>
        <button onclick={() => add({ kind: 'serve', call: 'net_fault' })}>
          {second ? 'Filet, double faute' : 'Filet, faute'}<small>« {fr.netFault} »</small>
        </button>
        <button onclick={() => add({ kind: 'serve', call: 'net' })}>
          Filet, bon<small>« {second ? fr.netSecond : fr.netFirst} »</small>
        </button>
        <button onclick={() => add({ kind: 'serve', call: 'ace' })}>Ace</button>
      </div>
    </section>

    <div class="points">
      <button class="player c-{live.colors[left]}" onclick={() => add({ kind: 'point', winner: left })}>
        <small>Point</small>{names[left]}
      </button>
      <button class="player c-{live.colors[right]}" onclick={() => add({ kind: 'point', winner: right })}>
        <small>Point</small>{names[right]}
      </button>
    </div>
    <button class="let" onclick={() => add({ kind: 'let' })}>
      Let pendant l'échange · point rejoué{second ? ' en 1er service' : ''}
    </button>
  {/if}

  <nav>
    <button onclick={undo}>Annuler</button>
    <button onclick={() => (panel = 'sanction')} disabled={over}>Sanction</button>
    <button onclick={() => (panel = 'time')} disabled={over}>Temps</button>
    <button onclick={() => (panel = 'correct')}>Corriger</button>
    <button onclick={() => (panel = 'end')} disabled={over}>Fin</button>
  </nav>
</div>

{#if panel === 'sanction'}
  <SanctionSheet {live} {left} onClose={() => (panel = 'none')} onDone={() => ((panel = 'none'), (flash = null))} />
{:else if panel === 'time'}
  <TimeSheet {live} {left} onClose={() => (panel = 'none')} onDone={() => ((panel = 'none'), (flash = null))} />
{:else if panel === 'correct'}
  <CorrectionSheet {live} {left} onClose={() => (panel = 'none')} onDone={corrected} />
{:else if panel === 'end'}
  <EndSheet {live} {left} onClose={() => (panel = 'none')} onDone={() => ((panel = 'none'), (flash = null))} />
{/if}

<style>
  .screen {
    max-width: 640px;
    margin: 0 auto;
    padding: 8px 12px calc(12px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 100dvh;
  }
  header {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  header button {
    min-height: 40px;
  }
  .info {
    flex: 1;
    color: var(--muted);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .clock {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .serve {
    border: 2px solid var(--border);
    border-radius: var(--radius);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .serve.second {
    border-color: var(--warn);
    background: var(--warn-bg);
  }
  .serve-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .num {
    flex: none;
    font-size: 18px;
    font-weight: 800;
    text-transform: uppercase;
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .second .num {
    background: var(--warn);
    color: var(--warn-bg);
  }
  .serve-head .who {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .call {
    background: var(--call-bg);
    color: var(--call-fg);
    border-radius: var(--radius);
    padding: 10px 12px;
    text-align: center;
    min-height: 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .call p {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    line-height: 1.25;
  }
  .call .empty {
    opacity: 0.4;
  }
  .hints {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }
  .hints span {
    background: var(--warn-bg);
    color: var(--warn);
    border-radius: 999px;
    padding: 4px 12px;
    font-weight: 600;
  }
  .elapsed {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .elapsed span {
    flex: 1;
  }
  .elapsed.strong {
    background: var(--surface-2);
    color: var(--text);
    border-radius: var(--radius);
    font-size: 20px;
  }
  .serve-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .serve-row button {
    padding: 4px 2px;
    font-weight: 700;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.15;
    font-size: 15px;
  }
  .serve-row small {
    font-weight: 500;
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }
  .points {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    flex: 1;
    min-height: 120px;
  }
  .points button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
    border-width: 2px;
  }
  .points small {
    font-size: 14px;
    font-weight: 500;
  }
  .player {
    background: var(--p-bg);
    color: var(--p-fg);
    border-color: var(--p-strong);
  }
  .let {
    width: 100%;
    min-height: 40px;
    font-size: 14px;
    color: var(--muted);
  }
  .done button {
    width: 100%;
    min-height: 64px;
  }
  nav {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  nav button {
    padding: 0 2px;
    font-size: 14px;
  }
</style>
