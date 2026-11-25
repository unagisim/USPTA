<script lang="ts">
  import { describeEntry, describeRaw, describeTimer, scoreBefore } from '../lib/describe';
  import { clock, hour } from '../lib/device';
  import { FORMATS, setScoreFor, type LogEntry, type MatchEvent } from '../lib/engine';
  import type { LiveMatch } from '../lib/state.svelte';

  // Feuille de match à l'écran : en-tête, résultat, chronologie complète avec les corrections.
  let { live, onBack }: { live: LiveMatch; onBack: () => void } = $props();

  const m = $derived(live.m);
  const r = $derived(live.result);
  const names = $derived({ A: live.name('A'), B: live.name('B') });
  const byId = $derived(new Map<number, LogEntry>(r.log.map((e) => [e.event.id, e])));
  const voided = $derived(new Set(m.events.filter((e) => e.kind === 'undo').map((e) => (e as Extract<MatchEvent, { kind: 'undo' }>).target)));

  const REASONS = { retirement: 'abandon', disqualification: 'disqualification', walkover: 'forfait', completed: '' };
  const result = $derived.by(() => {
    const s = r.state;
    if (!s.winner) return null;
    const sets = s.completedSets.map((set) => setScoreFor(set, s.winner!)).join(' ');
    const how = s.endReason && s.endReason !== 'completed' ? ` (${REASONS[s.endReason]})` : '';
    return `${names[s.winner]} gagne ${sets}${how}`;
  });

  interface Row {
    id: number;
    ts: number;
    score: string;
    text: string;
    kind: 'play' | 'sanction' | 'time' | 'correction' | 'other';
    struck: boolean;
  }

  const rows = $derived.by((): Row[] =>
    m.events.map((e): Row => {
      const entry = byId.get(e.id);
      const base = { id: e.id, ts: e.ts, score: entry ? scoreBefore(entry) : '', struck: voided.has(e.id) };
      switch (e.kind) {
        case 'undo':
          return { ...base, kind: 'correction', text: `Correction : saisie n° ${e.target} annulée${e.reason ? ` (${e.reason})` : ''}` };
        case 'replace': {
          const w = e.with;
          const what = w.kind === 'point' ? `point à ${names[w.winner]}` : w.kind === 'let' ? 'point à rejouer' : w.call;
          return { ...base, kind: 'correction', text: `Correction : saisie n° ${e.target} → ${what}${e.reason ? ` (${e.reason})` : ''}` };
        }
        case 'timer':
          return { ...base, kind: 'time', text: describeTimer(e, names) };
        case 'start':
          return { ...base, kind: 'other', text: 'Début du match' };
        case 'note':
          return { ...base, kind: 'other', text: `Note : ${e.text}` };
        default: {
          const text = entry ? describeEntry(entry, names) : describeRaw(e, names);
          const sanction = entry?.outcome.sanction;
          const extra = sanction ? ` → ${sanctionText(sanction.level)}` : '';
          const note = 'note' in e && e.note ? ` (${e.note})` : '';
          const reason = 'reason' in e && e.reason ? ` (${e.reason})` : '';
          const kind = e.kind === 'conduct' || e.kind === 'time_violation' ? 'sanction' : e.kind === 'set_server' || e.kind === 'adjust' ? 'correction' : 'play';
          return { ...base, kind, text: `${text}${extra}${note}${reason}${entry?.replaced ? ' (corrigé)' : ''}` };
        }
      }
    }),
  );

  function sanctionText(level: string): string {
    return { warning: 'avertissement', point: '1 point de pénalité', three_points: '3 points de pénalité', disqualification: 'disqualification' }[level] ?? level;
  }

  let filter = $state<'all' | 'key'>('key');
  const shown = $derived(filter === 'all' ? rows : rows.filter((x) => x.kind !== 'play'));
</script>

<div class="page">
  <div class="topbar">
    <button class="ghost" onclick={onBack}>← Match</button>
    <h1>Feuille de match</h1>
  </div>

  <div class="card">
    <p><strong>{m.info.tournament || 'Tournoi'}</strong>{m.info.round ? ` · ${m.info.round}` : ''}{m.info.court ? ` · Court ${m.info.court}` : ''}</p>
    <p class="muted">
      {FORMATS[m.formatId].label} : {FORMATS[m.formatId].description}<br />
      Juge-arbitre : {m.info.referee || '—'} · Arbitre : {m.info.umpire || '—'}{m.info.umpireLicence ? ` (${m.info.umpireLicence})` : ''}
    </p>
    {#each ['A', 'B'] as const as s (s)}
      {@const p = m.players[s]}
      <p>{names[s]}{p.club ? ` · ${p.club}` : ''}{p.ranking ? ` · ${p.ranking}` : ''}{p.licence ? ` · ${p.licence}` : ''}</p>
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

  <div class="seg">
    <button aria-pressed={filter === 'key'} onclick={() => (filter = 'key')}>Incidents</button>
    <button aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>Tous les points</button>
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
