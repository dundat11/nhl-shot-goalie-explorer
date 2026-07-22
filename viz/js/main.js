import * as d3 from 'd3'
import { drawRink, drawGrid, toggleGrid } from './rink.js'
import { initLayers, renderHeatmap, renderScatter, setSelectMode, clearSelection, getSelectionStats } from './heatmap.js'

const BASE         = import.meta.env.BASE_URL
const TEAMS_PATH    = `${BASE}teams.json`
const GOALIES_PATH  = `${BASE}goalies.json`
const GAMES_PATH    = `${BASE}games.csv`

// ── SVG ───────────────────────────────────────────────────────────────────────
const PADDING = 5
const svg = d3.select('#rink')
  .attr('viewBox', `${-100-PADDING} ${-42.5-PADDING} ${200+PADDING*2} ${85+PADDING*2}`)
  .attr('preserveAspectRatio', 'xMidYMid meet')

const tooltip = d3.select('#tooltip')

// ── State ─────────────────────────────────────────────────────────────────────
const state = { team: null, goalie: 'all', shooter: 'all', season: 'all', view: 'heatmap', metric: 'rate', selectZone: false, grid: false, game: 'all' }

let _teams        = []
let _allGames     = []
let _teamShots    = []
let _goalies      = []
let _currentGoalie = null  // set by loadGoalie() in Task 16; unused until then

// ── Filter ────────────────────────────────────────────────────────────────────
function filterShots(all) {
  return all.filter(d => {
    if (state.shooter === 'home'     && !d.isHomeShooting) return false
    if (state.shooter === 'opponent' &&  d.isHomeShooting) return false
    if (state.season  !== 'all'      && String(d.season) !== state.season) return false
    if (state.game    !== 'all'      && String(d.gameId)  !== state.game)  return false
    return true
  })
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function updateStats(shots, selectionStats) {
  if (selectionStats && selectionStats.zones > 0) {
    const { selected, rest, diff } = selectionStats
    set('stat-shots',      selected.shots.toLocaleString())
    set('stat-goals',      selected.goals.toLocaleString())
    set('stat-rate',       pct(selected.rate))
    set('stat-bench-rate', pct(rest.rate))
    set('stat-far-rate',   rest.shots.toLocaleString())

    const diffEl = document.getElementById('stat-diff')
    diffEl.textContent = (diff >= 0 ? '+' : '') + pct(diff)
    diffEl.style.color = diff > 0 ? '#2E6DB4' : '#6ab4ff'

    // Relabel stats for selection context
    setLabel('label-bench-rate', 'Rest of Ice Rate')
    setLabel('label-far-rate',   'Rest of Ice Shots')
    setLabel('label-rate',       'Selected Zone Rate')
    setLabel('label-shots',      'Selected Shots')
    setLabel('label-goals',      'Selected Goals')
    setLabel('label-diff',       'vs Rest of Ice')
    return
  }

  // Restore default labels
  setLabel('label-bench-rate', 'Bench Side Rate')
  setLabel('label-far-rate',   'Far Side Rate')
  setLabel('label-rate',       'Overall Rate')
  setLabel('label-shots',      'Shots on Goal')
  setLabel('label-goals',      'Goals')
  setLabel('label-diff',       'Difference')

  const onGoal = shots.filter(d => d.isOnGoal)
  const goals  = onGoal.filter(d => d.isGoal)
  const bench  = onGoal.filter(d => d.isHomeBenchSide)
  const far    = onGoal.filter(d => !d.isHomeBenchSide)

  const overall   = onGoal.length ? goals.length / onGoal.length : 0
  const benchRate = bench.length  ? bench.filter(d => d.isGoal).length / bench.length : 0
  const farRate   = far.length    ? far.filter(d => d.isGoal).length   / far.length   : 0
  const diff      = benchRate - farRate

  set('stat-shots',      onGoal.length.toLocaleString())
  set('stat-goals',      goals.length.toLocaleString())
  set('stat-rate',       pct(overall))
  set('stat-bench-rate', pct(benchRate))
  set('stat-far-rate',   pct(farRate))

  const diffEl = document.getElementById('stat-diff')
  diffEl.textContent = (diff >= 0 ? '+' : '') + pct(diff)
  diffEl.style.color = diff > 0 ? '#2E6DB4' : '#6ab4ff'
}

const pct      = v => (v * 100).toFixed(1) + '%'
const set      = (id, val) => { document.getElementById(id).textContent = val }
const setLabel = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val }

// ── Selection status bar ──────────────────────────────────────────────────────
function updateSelectStatus(stats) {
  const bar   = document.getElementById('select-status')
  const count = document.getElementById('select-count')
  const hint  = document.getElementById('select-hint')

  if (!state.selectZone) {
    bar.classList.remove('visible')
    return
  }

  bar.classList.add('visible')
  if (!stats || stats.zones === 0) {
    count.textContent = 'No zones selected'
    hint.textContent  = 'Click hexes on the map — stats will compare selected zone vs rest of ice'
  } else {
    const sign = stats.diff >= 0 ? '+' : ''
    count.textContent = `${stats.zones} zone${stats.zones > 1 ? 's' : ''} selected`
    hint.textContent  = `Selected: ${pct(stats.selected.rate)} · Rest of ice: ${pct(stats.rest.rate)} · ${sign}${pct(stats.diff)}`
  }
}

// ── Team loader functions ────────────────────────────────────────────────────
function populateGameOptions(abbrev) {
  const sel = document.getElementById('filter-game')
  sel.innerHTML = '<option value="all">All home games</option>'
  _allGames
    .filter(g => g.homeTeam === abbrev && (g.gameState === 'OFF' || g.gameState === 'FINAL'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(g => {
      const opt = document.createElement('option')
      opt.value = g.gameId
      const season = g.season === '20242025' ? '24-25' : '25-26'
      opt.textContent = `${g.date} · ${abbrev} vs ${g.awayTeam} (${season})`
      sel.appendChild(opt)
    })
  state.game = 'all'
}

function resetGoalieSelect() {
  const sel = document.getElementById('filter-goalie')
  sel.innerHTML = '<option value="all">All goalies</option>'
}

async function loadTeam(abbrev) {
  const team = _teams.find(t => t.abbrev === abbrev)
  if (!team) return

  document.getElementById('team-logo').src = team.logoLight
  document.getElementById('team-logo').alt = team.name
  document.getElementById('team-title').textContent = team.name
  document.getElementById('team-arena').textContent = team.arena

  state.team = abbrev
  state.goalie = 'all'
  _currentGoalie = null
  resetGoalieSelect()
  populateGameOptions(abbrev)

  clearSelection()
  const shots = await d3.json(`${BASE}teams/${abbrev}.json`)
  _teamShots = shots
  _allShots = shots
  render()
}

// ── Render ────────────────────────────────────────────────────────────────────
let _allShots = []

function render(selStats) {
  const shots = filterShots(_allShots)
  const stats = selStats !== undefined ? selStats : (state.selectZone ? getSelectionStats() : null)
  updateStats(shots, stats)
  updateSelectStatus(stats)

  if (state.view === 'heatmap') {
    renderHeatmap(shots, state.metric, tooltip)
  } else {
    renderScatter(shots, tooltip)
  }
}

// ── Controls ──────────────────────────────────────────────────────────────────
function wireControls() {
  const keyMap = {
    'filter-shooter': 'shooter',
    'filter-season':  'season',
    'filter-view':    'view',
    'filter-metric':  'metric',
    'filter-grid':    'grid',
  }

  document.querySelectorAll('.btn-group').forEach(group => {
    if (group.id === 'filter-select') return  // handled separately
    group.addEventListener('click', e => {
      const btn = e.target.closest('.btn')
      if (!btn) return
      group.querySelectorAll('.btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const key = keyMap[group.id]
      if (key) {
        state[key] = btn.dataset.value
        if (key === 'view' && btn.dataset.value !== 'heatmap') {
          _setSelectZone(false)
        }
        if (key === 'grid') {
          toggleGrid(gridLayer, btn.dataset.value === 'on')
          return  // no data re-render needed for grid toggle
        }
        render()
      }
    })
  })

  // Zone select toggle
  document.getElementById('filter-select').addEventListener('click', e => {
    const btn = e.target.closest('.btn')
    if (!btn) return
    document.querySelectorAll('#filter-select .btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    _setSelectZone(btn.dataset.value === 'on')
  })

  // Clear selection button
  document.getElementById('btn-clear-selection').addEventListener('click', () => {
    clearSelection()
    render(null)
  })
}

function _setSelectZone(on) {
  state.selectZone = on
  setSelectMode(on, stats => render(stats))
  if (!on) {
    // Reset zone select button to Off
    document.querySelectorAll('#filter-select .btn').forEach(b => {
      b.classList.toggle('active', b.dataset.value === 'off')
    })
    render(null)
  } else {
    updateSelectStatus(null)
  }
}

// ── Mobile sheet ─────────────────────────────────────────────────────────────
function wireMobileMenu() {
  const menuBtn  = document.getElementById('mobile-menu-btn')
  const controls = document.getElementById('controls')
  const overlay  = document.getElementById('sheet-overlay')
  const closeBtn = document.getElementById('sheet-close')

  function openSheet() {
    controls.classList.add('open')
    overlay.classList.add('visible')
    menuBtn.classList.add('open')
  }
  function closeSheet() {
    controls.classList.remove('open')
    overlay.classList.remove('visible')
    menuBtn.classList.remove('open')
  }

  menuBtn.addEventListener('click', () =>
    controls.classList.contains('open') ? closeSheet() : openSheet()
  )
  overlay.addEventListener('click', closeSheet)
  closeBtn.addEventListener('click', closeSheet)
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Inject build version — values are replaced at build time by vite.config.js
const _sha = __BUILD_SHA__ ? ` · ${__BUILD_SHA__}` : ''
document.getElementById('build-info').textContent =
  `v${__APP_VERSION__}${_sha} · ${__BUILD_DATE__}`

drawRink(svg)
const gridLayer = drawGrid(svg)  // sits between rink and data layers
initLayers(svg)
wireMobileMenu()
wireControls()  // wire immediately — controls must work before data arrives

document.getElementById('filter-team').addEventListener('change', e => {
  loadTeam(e.target.value)
})

document.getElementById('filter-game').addEventListener('change', e => {
  state.game = e.target.value
  clearSelection()
  render()
})

Promise.all([
  d3.json(TEAMS_PATH),
  d3.json(GOALIES_PATH),
  d3.csv(GAMES_PATH),
]).then(([teams, goalies, games]) => {
  _teams    = teams
  _goalies  = goalies
  _allGames = games

  const teamSel = document.getElementById('filter-team')
  teams.forEach(t => {
    const opt = document.createElement('option')
    opt.value = t.abbrev
    opt.textContent = t.name
    teamSel.appendChild(opt)
  })

  const initial = teams[0]?.abbrev
  if (initial) {
    teamSel.value = initial
    loadTeam(initial)
  }
}).catch(err => {
  console.error('Failed to load team/goalie index:', err)
  svg.append('text')
    .attr('x', 0).attr('y', 0)
    .attr('text-anchor', 'middle')
    .attr('fill', '#2E6DB4')
    .attr('font-size', '5')
    .text('Could not load data — run process_data.py first')
})
