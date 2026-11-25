<script lang="ts">
  import FileReady from '../components/FileReady.svelte';
  import { clock, hour } from '../lib/device';
  import { FORMATS, serveStatRows, serveStats } from '../lib/engine';
  import { resultText, sheetRows } from '../lib/sheet';
  import type { LiveMatch } from '../lib/state.svelte';

  // Feuille de match à l'écran : en-tête, résultat, chronologie complète avec les corrections.
  let { live, onBack }: { live: LiveMatch; onBack: () => void } = $props();

  const m = $derived(live.m);
  const r = $derived(live.result);
  const names = $derived({ A: live.name('A'), B: live.name('B') });
  const result = $derived(resultText(r, names));
  const rows = $derived(sheetRows(m, r, names));

  // Statistiques au service : match entier ou une manche.
  let statSet = $state<number | undefined>(undefined);
  const setCount = $derived(r.state.completedSets.length + (r.state.winner ? 0 : 1));
  const statRows = $derived(serveStatRows(serveStats(r.log, statSet)));

  let filter = $state<'all' | 'key'>('key');
  const shown = $derived(filter === 'all' ? rows : rows.filter((x) => x.kind !== 'play'));

  // Export PDF : préparation, puis un tap dédié pour partager (exigé par Android).
  let pdf = $state<File | null>(null);
  let exporting = $state(false);
  let exportError = $state('');
  async function exportPdf() {
    exporting = true;
    exportError = '';
    try {
      const { buildSheetPdf } = await import('../lib/export/pdf');
      const { blob, fileName } = buildSheetPdf(m, r, names);
      pdf = new File([blob], fileName, { type: 'application/pdf' });
    } catch (e) {
      console.error(e);
      exportError = "La création du PDF a échoué.";
    } finally {
      exporting = false;
    }
  }
</script>

<div class="page">
  <div class="topbar">
    <button class="ghost" onclick={onBack}>← Match</button>
    <h1>Feuille de match</h1>
  </div>

  <div class="card">
    <p><strong>{m.info.tournament || 'Compétition'}</strong>{m.info.round ? ` · ${m.info.round}` : ''}{m.info.court ? ` · Court ${m.info.court}` : ''}</p>
    <p class="muted">
      {FORMATS[m.formatId].label} : {FORMATS[m.formatId].description}<br />
      Juge-arbitre : {m.info.referee || '—'} · Arbitre : {m.info.umpire || '—'}{m.info.umpireLicence ? ` (${m.info.umpireLicence})` : ''}
    </p>
    {#each ['A', 'B'] as const as s (s)}
      {@const p = m.players[s]}
      <p>{names[s]}{p.club ? ` · ${p.club}` : ''}{p.ranking ? ` · ${p.ranking}` : ''}</p>
    {/each}
  </div>

  <div class="card">
    {#if result}<p><strong>{result}</strong></p>{:else}<p>Match en cours</p>{/if}
    <p class="muted">
      Début : {r.start ? hour(r.start) : '—'} · Fin : {r.end ? hour(r.end) : '—'}{r.start && r.end ? ` · Durée : ${clock(r.end - r.start)}` : ''}
    </p>
    <p class="muted">
      Code de conduite : {names.A} {r.conductCount.A}, {names.B} {r.conductCount.B} · Dépassements de temps : {names.A}
      {r.timeViolationCount.A}, {names.B} {r.timeViolationCount.B} · Pauses toilettes : {r.toiletBreaks.A} et {r.toiletBreaks.B}
    </p>
  </div>

  <div class="card">
    <h2>Statistiques au service</h2>
    {#if setCount > 1}
      <div class="seg sets">
        <button aria-pressed={statSet === undefined} onclick={() => (statSet = undefined)}>Match</button>
        {#each Array.from({ length: setCount }, (_, k) => k + 1) as k (k)}
          <button aria-pressed={statSet === k} onclick={() => (statSet = k)}>Manche {k}</button>
        {/each}
      </div>
    {/if}
    <table class="stats">
      <thead>
        <tr>
          <th></th>
          {#each ['A', 'B'] as const as p (p)}
            <th><span class="dot c-{live.colors[p]}"></span>{m.players[p].lastName}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each statRows as [label, a, b] (label)}
          <tr><th scope="row">{label}</th><td>{a}</td><td>{b}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>

  <button class="primary wide" onclick={exportPdf} disabled={exporting}>
    {exporting ? 'Création du PDF…' : 'Exporter la feuille en PDF'}
  </button>
  {#if exportError}<p class="error" role="alert">{exportError}</p>{/if}
  {#if pdf}
    <FileReady file={pdf} title="Feuille de match" onClose={() => (pdf = null)} />
  {/if}

  <div class="seg">
    <button aria-pressed={filter === 'key'} onclick={() => (filter = 'key')}>Incidents</button>
    <button aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>Déroulé point par point</button>
  </div>

  <ol class="log">
    {#each shown as row (row.id)}
      <li class={row.kind} class:struck={row.struck}>
        <span class="t">{hour(row.ts)}</span>
        <span class="n">n° {row.id}</span>
        <span class="x">{row.text}{#if row.score}<small> · {row.score}</small>{/if}</span>
      </li>
    {:else}
      <li class="muted">Rien à afficher.</li>
    {/each}
  </ol>
</div>

<style>
  .dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 5px;
    vertical-align: -1px;
    background: var(--p-swatch);
    border: 1px solid var(--border);
  }
  .sets {
    margin: 8px 0;
  }
  .stats {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    font-size: 14px;
  }
  .stats th,
  .stats td {
    padding: 5px 4px;
    border-bottom: 1px solid var(--border);
  }
  .stats tbody th {
    text-align: left;
    font-weight: 500;
    color: var(--muted);
  }
  .stats td,
  .stats thead th {
    text-align: right;
    white-space: nowrap;
  }
  .wide {
    width: 100%;
    margin-bottom: 12px;
  }
  .error {
    color: var(--danger);
  }
  .card p {
    margin: 4px 0;
  }
  .log {
    list-style: none;
    padding: 0;
    margin: 12px 0;
  }
  .log li {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 8px;
    padding: 6px 4px;
    border-bottom: 1px solid var(--border);
    font-size: 15px;
  }
  .t,
  .n {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .sanction {
    background: var(--danger-bg);
  }
  .correction {
    background: var(--warn-bg);
  }
  .struck .x {
    text-decoration: line-through;
    opacity: 0.6;
  }
  small {
    color: var(--muted);
  }
</style>
