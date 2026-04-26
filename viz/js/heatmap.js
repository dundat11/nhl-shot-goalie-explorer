import * as d3 from 'd3'
import { hexbin as d3Hexbin } from 'd3-hexbin'

const HEX_RADIUS  = 4.5
const MIN_SHOTS   = 4   // full-season threshold
const MIN_SHOTS_1 = 1   // single-game threshold

let hexLayer        = null
let scatterLayer    = null
let currentBins     = []       // bins with raw shot data attached, used for selection stats
let selectedKeys    = new Set()
let isSelectMode    = false
let onChangeCb      = null     // called whenever selection changes

const binKey = d => `${d.x.toFixed(1)},${d.y.toFixed(1)}`

export function initLayers(svg) {
  hexLayer     = svg.append('g').attr('class', 'hex-layer')
  scatterLayer = svg.append('g').attr('class', 'scatter-layer')
}

// ── Selection API ─────────────────────────────────────────────────────────────

export function setSelectMode(on, onChange) {
  isSelectMode = on
  onChangeCb   = onChange || null
  if (!on) clearSelection(false)
}

export function clearSelection(notify = true) {
  selectedKeys.clear()
  _refreshSelectionVisuals()
  if (notify && onChangeCb) onChangeCb(null)
}

export function getSelectionStats() {
  if (!selectedKeys.size) return null

  const selBins  = currentBins.filter(b =>  selectedKeys.has(binKey(b)))
  const restBins = currentBins.filter(b => !selectedKeys.has(binKey(b)))

  const selShots  = selBins.flatMap(b => b.data)
  const restShots = restBins.flatMap(b => b.data)

  const selGoals  = selShots.filter(d => d.isGoal).length
  const restGoals = restShots.filter(d => d.isGoal).length
  const selRate   = selShots.length  ? selGoals  / selShots.length  : 0
  const restRate  = restShots.length ? restGoals / restShots.length : 0

  return {
    zones: selectedKeys.size,
    selected: { shots: selShots.length,  goals: selGoals,  rate: selRate },
    rest:     { shots: restShots.length, goals: restGoals, rate: restRate },
    diff:     selRate - restRate,
  }
}

// ── Color scales ──────────────────────────────────────────────────────────────

function buildRateScale(bins, minShots = MIN_SHOTS) {
  const rates = bins.filter(b => b.shots >= minShots).map(b => b.rate)
  if (!rates.length) return null
  const sorted = [...rates].sort(d3.ascending)
  return d3.scaleSequential(
    [d3.quantile(sorted, 0.05), d3.quantile(sorted, 0.95)],
    d3.interpolateYlOrRd
  )
}

function buildVolumeScale(bins, minShots = MIN_SHOTS) {
  const vols = bins.filter(b => b.shots >= minShots).map(b => b.shots)
  if (!vols.length) return null
  const sorted = [...vols].sort(d3.ascending)
  return d3.scaleSequential([0, d3.quantile(sorted, 0.95)], d3.interpolatePlasma)
}

// ── Hexbin aggregation ────────────────────────────────────────────────────────

function computeBins(shots) {
  const hexbin = d3Hexbin().x(d => d.x).y(d => d.y).radius(HEX_RADIUS)
  return hexbin(shots).map(bin => ({
    x:     bin.x,
    y:     bin.y,
    path:  hexbin.hexagon(),
    shots: bin.length,
    goals: bin.filter(d => d.isGoal).length,
    rate:  bin.length > 0 ? bin.filter(d => d.isGoal).length / bin.length : 0,
    data:  [...bin],  // keep raw shots for selection stats
  }))
}

// ── Legend ────────────────────────────────────────────────────────────────────

function renderLegend(colorScale, metric) {
  const bar   = document.getElementById('legend-bar')
  const title = document.getElementById('legend-title')
  if (!colorScale) { bar.style.background = ''; title.textContent = ''; return }

  const canvas = document.createElement('canvas')
  canvas.width = 160; canvas.height = 10
  const ctx = canvas.getContext('2d')
  const [lo, hi] = colorScale.domain()
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = colorScale(lo + (i / 159) * (hi - lo))
    ctx.fillRect(i, 0, 1, 10)
  }
  bar.style.background     = `url(${canvas.toDataURL()})`
  bar.style.backgroundSize = '100% 100%'
  title.textContent = metric === 'rate' ? 'Conversion Rate' : 'Shot Volume'
}

// ── Selection visuals ─────────────────────────────────────────────────────────

function _refreshSelectionVisuals() {
  if (!hexLayer) return
  hexLayer.selectAll('.hex-cell')
    .classed('selected', d => selectedKeys.has(binKey(d)))
    .classed('dimmed',   d => isSelectMode && selectedKeys.size > 0 && !selectedKeys.has(binKey(d)))
}

function _toggleHex(d) {
  const key = binKey(d)
  if (selectedKeys.has(key)) {
    selectedKeys.delete(key)
  } else {
    selectedKeys.add(key)
  }
  _refreshSelectionVisuals()
  if (onChangeCb) onChangeCb(getSelectionStats())
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

export function renderHeatmap(shots, metric, tooltip) {
  scatterLayer.selectAll('*').remove()

  const onGoal   = shots.filter(d => d.isOnGoal)
  const minShots = onGoal.length < 150 ? MIN_SHOTS_1 : MIN_SHOTS
  const bins       = computeBins(onGoal)
  currentBins      = bins
  const colorScale = metric === 'rate' ? buildRateScale(bins, minShots) : buildVolumeScale(bins, minShots)
  renderLegend(colorScale, metric)

  // Clear stale selections when data refreshes
  if (selectedKeys.size) {
    const validKeys = new Set(bins.map(binKey))
    for (const k of selectedKeys) {
      if (!validKeys.has(k)) selectedKeys.delete(k)
    }
  }

  hexLayer.selectAll('.hex-cell').data(bins, binKey).join(
    enter => enter.append('path')
      .attr('class', 'hex-cell')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('d',       d => d.path)
      .attr('fill',    d => d.shots >= minShots && colorScale ? colorScale(metric === 'rate' ? d.rate : d.shots) : 'transparent')
      .attr('opacity', d => d.shots >= minShots ? 0.82 : 0)
      .on('click', (event, d) => {
        if (!isSelectMode || d.shots < minShots) return
        _toggleHex(d)
      })
      .on('mouseover', (event, d) => {
        if (d.shots < minShots) return
        const label = isSelectMode
          ? (selectedKeys.has(binKey(d)) ? 'Click to deselect' : 'Click to select')
          : `${(d.rate * 100).toFixed(1)}% conversion`
        tooltip.style('opacity', 1)
          .html(`<strong>${label}</strong>${d.goals} goals / ${d.shots} shots`)
      })
      .on('mousemove', e => tooltip.style('left', (e.clientX+14)+'px').style('top', (e.clientY-28)+'px'))
      .on('mouseout',  () => tooltip.style('opacity', 0)),

    update => update
      .attr('fill',    d => d.shots >= minShots && colorScale ? colorScale(metric === 'rate' ? d.rate : d.shots) : 'transparent')
      .attr('opacity', d => d.shots >= minShots ? 0.82 : 0),

    exit => exit.remove()
  )

  _refreshSelectionVisuals()

  // Toggle crosshair cursor on rink container
  const rink = document.getElementById('rink')
  rink?.closest('.rink-container')?.classList.toggle('select-mode', isSelectMode)
}

// ── Scatter ───────────────────────────────────────────────────────────────────

export function renderScatter(shots, tooltip) {
  hexLayer.selectAll('*').remove()
  currentBins = []
  document.getElementById('legend-bar').style.background = ''
  document.getElementById('legend-title').textContent    = ''

  scatterLayer.selectAll('.shot-dot').data(shots.filter(d => d.isOnGoal)).join(
    enter => enter.append('circle')
      .attr('class',        'shot-dot')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 1.4)
      .attr('fill',         d => d.isGoal ? '#ff4d00' : 'rgba(255,255,255,0.22)')
      .attr('stroke',       d => d.isGoal ? '#ff6b35' : 'none')
      .attr('stroke-width', 0.4)
      .on('mouseover', (event, d) => {
        tooltip.style('opacity', 1).html(
          `<strong>${d.isGoal ? 'GOAL' : 'Shot on goal'}</strong>
           ${d.shootingTeam} &bull; ${d.date}<br>
           Period ${d.period} &bull; (${(+d.x).toFixed(0)}, ${(+d.y).toFixed(0)})`
        )
      })
      .on('mousemove', e => tooltip.style('left', (e.clientX+14)+'px').style('top', (e.clientY-28)+'px'))
      .on('mouseout',  () => tooltip.style('opacity', 0)),

    update => update.attr('cx', d => d.x).attr('cy', d => d.y),
    exit   => exit.remove()
  )
}
