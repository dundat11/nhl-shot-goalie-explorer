import * as d3 from 'd3'
import { drawRink } from './rink.js'
import { initLayers, renderHeatmap, renderScatter } from './heatmap.js'

// Vite serves data/processed/ as static assets via publicDir config.
// shots_viz.json is available at the root path.
const DATA_PATH = '/shots_viz.json'

// ── SVG setup ─────────────────────────────────────────────────────────────────
const PADDING = 5
const svg = d3.select('#rink')
  .attr('viewBox', `${-100 - PADDING} ${-42.5 - PADDING} ${200 + PADDING * 2} ${85 + PADDING * 2}`)
  .attr('preserveAspectRatio', 'xMidYMid meet')

const tooltip = d3.select('#tooltip')

// ── State ─────────────────────────────────────────────────────────────────────
const state = { shooter: 'all', season: 'all', view: 'heatmap', metric: 'rate' }

// ── Filter ────────────────────────────────────────────────────────────────────
function filterShots(all) {
  return all.filter(d => {
    if (state.shooter === 'utah'     && !d.isUtahShooting) return false
    if (state.shooter === 'opponent' &&  d.isUtahShooting) return false
    if (state.season  !== 'all'      && String(d.season) !== state.season) return false
    return true
  })
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function updateStats(shots) {
  const onGoal  = shots.filter(d => d.isOnGoal)
  const goals   = onGoal.filter(d => d.isGoal)
  const bench   = onGoal.filter(d => d.isHomeBenchSide)
  const far     = onGoal.filter(d => !d.isHomeBenchSide)

  const overall    = onGoal.length ? goals.length / onGoal.length : 0
  const benchRate  = bench.length  ? bench.filter(d => d.isGoal).length / bench.length : 0
  const farRate    = far.length    ? far.filter(d => d.isGoal).length   / far.length   : 0
  const diff       = benchRate - farRate

  set('stat-shots',      onGoal.length.toLocaleString())
  set('stat-goals',      goals.length.toLocaleString())
  set('stat-rate',       pct(overall))
  set('stat-bench-rate', pct(benchRate))
  set('stat-far-rate',   pct(farRate))

  const diffEl = document.getElementById('stat-diff')
  diffEl.textContent = (diff >= 0 ? '+' : '') + pct(diff)
  diffEl.style.color = diff > 0 ? '#2E6DB4' : '#6ab4ff'
}

const pct = v => (v * 100).toFixed(1) + '%'
const set = (id, val) => { document.getElementById(id).textContent = val }

// ── Render ────────────────────────────────────────────────────────────────────
function render(all) {
  const shots = filterShots(all)
  updateStats(shots)
  if (state.view === 'heatmap') {
    renderHeatmap(shots, state.metric, tooltip)
  } else {
    renderScatter(shots, tooltip)
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
function wireControls(all) {
  const keyMap = {
    'filter-shooter': 'shooter',
    'filter-season':  'season',
    'filter-view':    'view',
    'filter-metric':  'metric',
  }
  document.querySelectorAll('.btn-group').forEach(group => {
    group.addEventListener('click', e => {
      const btn = e.target.closest('.btn')
      if (!btn) return
      group.querySelectorAll('.btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const key = keyMap[group.id]
      if (key) { state[key] = btn.dataset.value; render(all) }
    })
  })
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
drawRink(svg)
initLayers(svg)

d3.json(DATA_PATH).then(all => {
  wireControls(all)
  render(all)
}).catch(err => {
  console.error('Failed to load shot data:', err)
  svg.append('text')
    .attr('x', 0).attr('y', 0)
    .attr('text-anchor', 'middle')
    .attr('fill', '#2E6DB4')
    .attr('font-size', '5')
    .text('Could not load data — run process_data.py first')
})
