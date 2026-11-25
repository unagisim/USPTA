<script lang="ts">
  import Countdown from '../components/Countdown.svelte';
  import type { TossChoice } from '../lib/db';
  import { fr } from '../lib/annonces';
  import { clock } from '../lib/device';
  import { other, WARMUP_CALLS, type Side } from '../lib/engine';
  import { app, type LiveMatch } from '../lib/state.svelte';

  let { live, onExit }: { live: LiveMatch; onExit: () => void } = $props();

  const m = $derived(live.m);
  const name = (s: Side) => live.name(s);

  // Procédure avant le match (cahier des charges §8), à compléter.
  const CHECKS: [string, string][] = [
    ['net', 'Hauteur du filet au centre : 0,914 m'],
    ['sticks', 'Piquets de simple en place'],
    ['strap', 'Sangle centrale réglée'],
    ['chairs', 'Chaises, eau et serviettes des joueurs'],
    ['balls', 'Balles du match (et balles de réserve)'],
    ['call', 'Appel des joueurs et contrôle de la tenue'],
  ];

  async function check(key: string) {
    m.checklist = { ...m.checklist, [key]: !m.checklist[key] };
    await live.save();
  }

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
  /** Annonce du dernier seuil franchi (début, 2 min, 1 min), affichée 15 s ; « Time » reste affiché. */
  const warmupCall = $derived.by(() => {
    if (warmupLeft === null) return null;
    if (warmupLeft <= 0) return fr.warmup(0);
    const dur = app.settings.durations.warmup;
    const t = [dur, ...WARMUP_CALLS].find((x) => warmupLeft <= x + 0.5 && warmupLeft > x - 15);
    return t === undefined ? null : fr.warmup(t === dur ? 300 : t);
  });

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
    <h2>Contrôles</h2>
    {#each CHECKS as [key, label] (key)}
      <label class="check"><input type="checkbox" checked={!!m.checklist[key]} onchange={() => check(key)} /> {label}</label>
    {/each}
  </div>

  <div class="card stack">
    <h2>Tirage au sort</h2>
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
    <h2>Échauffement</h2>
    {#if warmup}
      {#key warmup.start}
        <Countdown label="Échauffement" start={warmup.start} duration={app.settings.durations.warmup} alerts={WARMUP_CALLS} onStop={stopWarmup} />
      {/key}
      {#if warmupCall}<p class="call">« {warmupCall} »</p>{/if}
    {:else}
      <button onclick={startWarmup}>Lancer l'échauffement ({clock(app.settings.durations.warmup * 1000)})</button>
    {/if}
  </div>

  <button class="primary wide" onclick={startMatch}>Début du match</button>
  <p class="muted center">Annonce : « {fr.time} », {name(m.firstServer)} au service.</p>
</div>

<style>
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--text);
    font-size: 16px;
    min-height: 44px;
    margin: 0;
  }
  .check input {
    width: 24px;
    min-height: 24px;
    flex: none;
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
  .wide {
    width: 100%;
    min-height: 64px;
    font-size: 18px;
  }
  .center {
    text-align: center;
  }
</style>
