import * as d3 from 'd3'
import { hexbin as d3Hexbin } from 'd3-hexbin'

const HEX_RADIUS = 4.5  // NHL coordinate units
const MIN_SHOTS  = 4    // minimum shots in a hex before rendering

let hexLayer     = null
let scatterLayer = null

export function initLayers(svg) {
  hexLayer     = svg.append('g').attr('class', 'hex-layer')
  scatterLayer = svg.append('g').attr('class', 'scatter-layer')
}

// ── Color scales ──────────────────────────────────────────────────────────────

function buildRateScale(bins) {
  const rates = bins.filter(b => b.shots >= MIN_SHOTS).map(b => b.rate)
  if (!rates.length) return () => 'transparent'
  const sorted = [...rates].sort(d3.ascending)
  return d3.scaleSequential(
    [d3.quantile(sorted, 0.05), d3.quantile(sorted, 0.95)],
    d3.interpolateYlOrRd
  )
}

function buildVolumeScale(bins) {
  const vols = bins.filter(b => b.shots >= MIN_SHOTS).map(b => b.shots)
  if (!vols.length) return () => 'transparent'
  const sorted = [...vols].sort(d3.ascending)
  return d3.scaleSequential([0, d3.quantile(sorted, 0.95)], d3.interpolatePlasma)
}

// ── Hexbin aggregation ────────────────────────────────────────────────────────

function computeBins(shots) {
  const hexbin = d3Hexbin()
    .x(d => d.x)
    .y(d => d.y)
    .radius(HEX_RADIUS)

  return hexbin(shots).map(bin => ({
    x:     bin.x,
    y:     bin.y,
    path:  hexbin.hexagon(),
    shots: bin.length,
    goals: bin.filter(d => d.isGoal).length,
    rate:  bin.length > 0 ? bin.filter(d => d.isGoal).length / bin.length : 0,
  }))
}

// ── Legend ────────────────────────────────────────────────────────────────────

function renderLegend(colorScale, metric) {
  const bar   = document.getElementById('legend-bar')
  const title = document.getElementById('legend-title')

  if (!colorScale.domain) { bar.style.background = ''; return }

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

// ── Heatmap ───────────────────────────────────────────────────────────────────

export function renderHeatmap(shots, metric, tooltip) {
  scatterLayer.selectAll('*').remove()

  const bins       = computeBins(shots.filter(d => d.isOnGoal))
  const colorScale = metric === 'rate' ? buildRateScale(bins) : buildVolumeScale(bins)
  renderLegend(colorScale, metric)

  hexLayer.selectAll('.hex-cell').data(bins).join(
    enter => enter.append('path')
      .attr('class', 'hex-cell')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('d',       d => d.path)
      .attr('fill',    d => d.shots >= MIN_SHOTS ? colorScale(metric === 'rate' ? d.rate : d.shots) : 'transparent')
      .attr('opacity', d => d.shots >= MIN_SHOTS ? 0.82 : 0)
      .on('mouseover', (event, d) => {
        if (d.shots < MIN_SHOTS) return
        tooltip.style('opacity', 1)
          .html(`<strong>${(d.rate * 100).toFixed(1)}% conversion</strong>${d.goals} goals / ${d.shots} shots`)
      })
      .on('mousemove', event => tooltip
        .style('left', (event.clientX + 14) + 'px')
        .style('top',  (event.clientY - 28) + 'px'))
      .on('mouseout', () => tooltip.style('opacity', 0)),

    update => update
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('fill',    d => d.shots >= MIN_SHOTS ? colorScale(metric === 'rate' ? d.rate : d.shots) : 'transparent')
      .attr('opacity', d => d.shots >= MIN_SHOTS ? 0.82 : 0),

    exit => exit.remove()
  )
}

// ── Scatter ───────────────────────────────────────────────────────────────────

export function renderScatter(shots, tooltip) {
  hexLayer.selectAll('*').remove()
  document.getElementById('legend-bar').style.background = ''
  document.getElementById('legend-title').textContent    = ''

  scatterLayer.selectAll('.shot-dot').data(shots.filter(d => d.isOnGoal)).join(
    enter => enter.append('circle')
      .attr('class',  'shot-dot')
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
      .on('mousemove', event => tooltip
        .style('left', (event.clientX + 14) + 'px')
        .style('top',  (event.clientY - 28) + 'px'))
      .on('mouseout', () => tooltip.style('opacity', 0)),

    update => update.attr('cx', d => d.x).attr('cy', d => d.y),
    exit   => exit.remove()
  )
}
