// Draws the NHL rink in SVG using broadcast coordinate space.
// NHL coordinates: x [-100, 100] = left end to right end (broadcast)
//                 y [-42.5, 42.5] = top boards to bottom boards
// Home bench: left side, bottom boards → x < 0, y ≈ +42.5

const RINK_DIMS = {
  cornerR:        28,
  blueLineX:      25,
  goalLineX:      89,
  centerCircleR:  15,
  faceoffCircleR: 15,
  faceoffDotR:    0.9,
  creaseR:        6,
  netW:           6,
  netD:           2,
}

export function drawRink(svg) {
  const g = svg.append('g').attr('class', 'rink-layer')
  const d = RINK_DIMS

  g.append('rect')
    .attr('class', 'rink-ice')
    .attr('x', -100).attr('y', -42.5)
    .attr('width', 200).attr('height', 85)
    .attr('rx', d.cornerR).attr('ry', d.cornerR)

  // Blue lines
  ;[-d.blueLineX, d.blueLineX].forEach(x => {
    g.append('rect')
      .attr('class', 'rink-blue-line')
      .attr('x', x - 0.6).attr('y', -42.5)
      .attr('width', 1.2).attr('height', 85)
  })

  // Red center line
  g.append('rect')
    .attr('class', 'rink-red-line')
    .attr('x', -0.6).attr('y', -42.5)
    .attr('width', 1.2).attr('height', 85)

  // Goal lines
  ;[-d.goalLineX, d.goalLineX].forEach(x => {
    g.append('line')
      .attr('class', 'rink-goal-line')
      .attr('x1', x).attr('y1', -36)
      .attr('x2', x).attr('y2', 36)
  })

  // Center circle + dot
  g.append('circle').attr('class', 'rink-circle')
    .attr('cx', 0).attr('cy', 0).attr('r', d.centerCircleR)
  g.append('circle').attr('class', 'rink-dot')
    .attr('cx', 0).attr('cy', 0).attr('r', d.faceoffDotR)

  // Offensive zone face-off circles at (±69, ±22)
  ;[[-69, -22], [-69, 22], [69, -22], [69, 22]].forEach(([x, y]) => {
    g.append('circle').attr('class', 'rink-circle')
      .attr('cx', x).attr('cy', y).attr('r', d.faceoffCircleR)
    g.append('circle').attr('class', 'rink-dot')
      .attr('cx', x).attr('cy', y).attr('r', d.faceoffDotR)
  })

  // Neutral zone face-off dots
  ;[[-20, -22], [-20, 22], [20, -22], [20, 22]].forEach(([x, y]) => {
    g.append('circle').attr('class', 'rink-dot')
      .attr('cx', x).attr('cy', y).attr('r', d.faceoffDotR)
  })

  // Creases and nets
  ;[-d.goalLineX, d.goalLineX].forEach(x => {
    const sweep = x < 0 ? 1 : 0
    const netOx = x < 0 ? 0 : -d.netD

    g.append('path').attr('class', 'rink-crease')
      .attr('d', `M ${x} ${-d.creaseR} A ${d.creaseR} ${d.creaseR} 0 0 ${sweep} ${x} ${d.creaseR} Z`)

    g.append('rect').attr('class', 'rink-net')
      .attr('x', x + netOx).attr('y', -d.netW / 2)
      .attr('width', d.netD).attr('height', d.netW)
  })

  // Home bench indicator — top boards (y = -42.5), left side (x: -28 to 2)
  // Broadcast camera is at the bottom, so the bench appears along the top edge.
  const by = -42.5, bx1 = -28, bx2 = 2
  g.append('line').attr('class', 'rink-bench-line')
    .attr('x1', bx1).attr('y1', by).attr('x2', bx2).attr('y2', by)
    .attr('stroke-width', 1.2)
  ;[bx1, bx2].forEach(x => {
    g.append('line').attr('class', 'rink-bench-line')
      .attr('x1', x).attr('y1', by).attr('x2', x).attr('y2', by + 2)
      .attr('stroke-width', 0.8)
  })
  g.append('text').attr('class', 'rink-bench-label')
    .attr('x', (bx1 + bx2) / 2).attr('y', by + 4.5)
    .attr('text-anchor', 'middle')
    .text('HOME BENCH')

  // Boards on top
  g.append('rect').attr('class', 'rink-boards')
    .attr('x', -100).attr('y', -42.5)
    .attr('width', 200).attr('height', 85)
    .attr('rx', d.cornerR).attr('ry', d.cornerR)

  return g
}
