<script lang="ts">
  import FileReady from '../components/FileReady.svelte';
  import { clock, hour } from '../lib/device';
  import { sidePlayers } from '../lib/db';
  import { FORMATS } from '../lib/engine';
  import { resultText, setTimes, sheetRows, statTables } from '../lib/sheet';
  import type { LiveMatch } from '../lib/state.svelte';

  // Feuille de match à l'écran : en-tête, résultat, chronologie complète avec les corrections.
  let { live, onBack }: { live: LiveMatch; onBack: () => void } = $props();

  const m = $derived(live.m);
  const r = $derived(live.result);
  const names = $derived({ A: live.name('A'), B: live.name('B') });
  const result = $derived(resultText(r, names));
  const rows = $derived(sheetRows(m, r, names));
  const times = $derived(setTimes(r));
  const span = (a: number | null, b: number | null) => (a && b ? clock(b - a) : '—');

  // Statistiques au service : match entier ou une manche.
  let statSet = $state<number | undefined>(undefined);
  const setCount = $derived(r.state.completedSets.length + (r.state.winner ? 0 : 1));
  /** Double : statistiques par équipe ou par joueur. */
  let byPlayer = $state(false);
  const tables = $derived(statTables(m, r.log, statSet, byPlayer));

  let filter = $state<'all' | 'key'>('key');
  const shown = $derived(filter === 'all' ? rows : rows.filter((x) => x.kind !== 'play'));

  // Export PDF : préparation, puis un tap dédié pour partager (exigé par Android).
  let pdf = $state<File | null>(null);
  let exporting = $state(false);
  let exportError = $state('');
  /** Logo du club pour l'en-tête du PDF ; le PDF se fait sans s'il ne se charge pas. */
  async function loadLogo() {
    try {
      const blob = await (await fetch(`${import.meta.env.BASE_URL}logo.png`)).blob();
      const data = await new Promise<string>((ok, ko) => {
        const fr = new FileReader();
        fr.onload = () => ok(fr.result as string);
        fr.onerror = ko;
        fr.readAsDataURL(blob);
      });
      const img = new Image();
      img.src = data;
      await img.decode();
      // Réduit et converti en JPEG : le PNG d'origine alourdirait le PDF de plusieurs centaines de Ko.
      const w = 300;
      const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      return { data: canvas.toDataURL('image/jpeg', 0.85), width: w, height: h };
    } catch {
      return undefined;
    }
  }

  async function exportPdf() {
    exporting = true;
    exportError = '';
    try {
      const { buildSheetPdf } = await import('../lib/export/pdf');
      const { blob, fileName } = buildSheetPdf(m, r, names, await loadLogo());
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
      <p>
        <span class="dot c-{live.colors[s]}"></span>
        {#each sidePlayers(m, s) as p, i (i)}
          {#if i > 0}<br />{/if}{live.doubles ? `${p.civility} ${p.firstName} ${p.lastName}` : names[s]}{p.club ? ` · ${p.club}` : ''}{p.ranking ? ` · ${p.ranking}` : ''}
        {/each}
      </p>
    {/each}
  </div>

  <div class="card">
    {#if result}<p><strong>{result}</strong></p>{:else}<p>Match en cours</p>{/if}
    <table class="times">
      <thead><tr><th></th><th>Début</th><th>Fin</th><th>Durée</th></tr></thead>
      <tbody>
        {#each times as t (t.set)}
          <tr><th scope="row">Manche {t.set}</th><td>{t.start ? hour(t.start) : '—'}</td><td>{t.end ? hour(t.end) : '—'}</td><td>{span(t.start, t.end)}</td></tr>
        {/each}
        <tr class="total">
          <th scope="row">Match</th><td>{r.start ? hour(r.start) : '—'}</td><td>{r.end ? hour(r.end) : '—'}</td><td>{span(r.start, r.end)}</td>
        </tr>
      </tbody>
    </table>
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
    {#if live.doubles}
      <div class="seg sets">
        <button aria-pressed={!byPlayer} onclick={() => (byPlayer = false)}>Par équipe</button>
        <button aria-pressed={byPlayer} onclick={() => (byPlayer = true)}>Par joueur</button>
      </div>
    {/if}
    {#each tables as table, ti (ti)}
      <table class="stats">
        <thead>
          <tr>
            <th></th>
            {#each table.cols as c, ci (ci)}
              <th><span class="dot c-{live.colors[c.side]}"></span>{c.label}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each table.rows as [label, ...values] (label)}
            <tr>
              <th scope="row">{label}</th>
              {#each values as v, vi (vi)}<td>{v}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    {/each}
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
  .times {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    margin: 6px 0;
  }
  .times th,
  .times td {
    padding: 4px;
    border-bottom: 1px solid var(--border);
    text-align: right;
  }
  .times tbody th {
    text-align: left;
    font-weight: 500;
    color: var(--muted);
  }
  .times .total th,
  .times .total td {
    font-weight: 700;
    color: var(--text);
  }
  .stats + .stats {
    margin-top: 12px;
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
  .stats thead th {
    white-space: normal;
    font-size: 13px;
    vertical-align: bottom;
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
