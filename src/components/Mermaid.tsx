'use client'

import { useEffect, useId, useState } from 'react'

let mermaidReady: Promise<typeof import('mermaid').default> | null = null

type Dot = { x: number; y: number; r: number }

function svgPoint(element: SVGGraphicsElement, x: number, y: number) {
  const point = new DOMPoint(x, y)
  const ctm = element.getCTM()
  return ctm ? point.matrixTransform(ctm) : point
}

function svgPointLocal(element: SVGGraphicsElement, x: number, y: number) {
  const point = new DOMPoint(x, y)
  const ctm = element.getCTM()
  return ctm ? point.matrixTransform(ctm.inverse()) : point
}

function nearestDot(dots: Dot[], x: number, y: number) {
  let closest: Dot | undefined
  let best = Infinity
  for (const dot of dots) {
    const distance = Math.hypot(dot.x - x, dot.y - y)
    if (distance < best) {
      best = distance
      closest = dot
    }
  }
  return closest
}

// Mermaid docks every edge to the same node port, so fan-in/out
// arrowheads stack. Redraw each edge toward a unique point on the
// circle, with a slight cubic bow so fans look like natural paths.
function routeEdgesBetweenDots(svgMarkup: string) {
  const holder = document.createElement('div')
  holder.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden'
  holder.innerHTML = svgMarkup
  document.body.appendChild(holder)

  const svg = holder.querySelector('svg')
  if (!svg) {
    holder.remove()
    return svgMarkup
  }

  const dots: Dot[] = [
    ...svg.querySelectorAll<SVGCircleElement>('.node circle'),
  ].flatMap((circle) => {
    const box = circle.getBBox()
    const centre = svgPoint(
      circle,
      box.x + box.width / 2,
      box.y + box.height / 2,
    )
    const radius = box.width / 2
    if (!Number.isFinite(radius) || radius <= 0) {
      return []
    }
    return [{ x: centre.x, y: centre.y, r: radius }]
  })

  const gap = dots[0] ? Math.max(4, dots[0].r * 0.55) : 4

  const paths = svg.querySelectorAll<SVGPathElement>(
    'path.flowchart-link, .edgePath .path',
  )
  for (const path of paths) {
    const length = path.getTotalLength()
    if (!Number.isFinite(length) || length < 2) {
      continue
    }

    const start = path.getPointAtLength(0)
    const end = path.getPointAtLength(length)
    const startSvg = svgPoint(path, start.x, start.y)
    const endSvg = svgPoint(path, end.x, end.y)
    const source = nearestDot(dots, startSvg.x, startSvg.y)
    const target = nearestDot(dots, endSvg.x, endSvg.y)
    if (!source || !target || source === target) {
      continue
    }

    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.hypot(dx, dy)
    const clearance = source.r + target.r + gap * 2
    if (distance <= clearance) {
      continue
    }

    const ux = dx / distance
    const uy = dy / distance
    const fromX = source.x + ux * (source.r + gap)
    const fromY = source.y + uy * (source.r + gap)
    const toX = target.x - ux * (target.r + gap)
    const toY = target.y - uy * (target.r + gap)
    const spanX = toX - fromX
    const spanY = toY - fromY
    const span = Math.hypot(spanX, spanY)
    if (span < 2) {
      continue
    }

    const sux = spanX / span
    const suy = spanY / span
    const lateral = source.x - target.x
    const mostlyHorizontal = Math.abs(suy) < 0.4
    let bow = 0
    let bowX = 0
    let bowY = 0
    if (mostlyHorizontal) {
      bow = span * 0.12
      bowY = -1
    } else if (Math.abs(lateral) > 1) {
      bow = span * 0.16
      bowX = Math.sign(lateral)
    }

    const from = svgPointLocal(path, fromX, fromY)
    const to = svgPointLocal(path, toX, toY)

    if (bow === 0) {
      path.setAttribute('d', `M${from.x},${from.y} L${to.x},${to.y}`)
    } else {
      const c1 = svgPointLocal(
        path,
        fromX + sux * span * 0.4 + bowX * bow,
        fromY + suy * span * 0.4 + bowY * bow,
      )
      const c2 = svgPointLocal(
        path,
        toX - sux * span * 0.28 + bowX * bow * 0.35,
        toY - suy * span * 0.28 + bowY * bow * 0.35,
      )
      path.setAttribute(
        'd',
        `M${from.x},${from.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${to.x},${to.y}`,
      )
    }
  }

  for (const marker of svg.querySelectorAll('marker')) {
    marker.setAttribute('markerWidth', '5')
    marker.setAttribute('markerHeight', '5')
  }

  const viewBox = svg.getAttribute('viewBox')
  if (viewBox && dots[0]) {
    const parts = viewBox.split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
      const pad = dots[0].r * 2.5
      svg.setAttribute(
        'viewBox',
        `${parts[0] - pad} ${parts[1] - pad} ${parts[2] + pad * 2} ${parts[3] + pad * 2}`,
      )
    }
  }

  const html = holder.innerHTML
  holder.remove()
  return html
}

const TARGET_DOT_RADIUS = 9

function fitSvgToDotSize(svgMarkup: string) {
  const holder = document.createElement('div')
  holder.innerHTML = svgMarkup
  const svg = holder.querySelector('svg')
  if (!svg) {
    return svgMarkup
  }

  const circle = svg.querySelector('circle')
  const radius =
    circle instanceof SVGCircleElement ? Number(circle.getAttribute('r')) : NaN
  if (!Number.isFinite(radius) || radius <= 0) {
    return holder.innerHTML
  }

  const scale = TARGET_DOT_RADIUS / radius
  const viewBox = svg.getAttribute('viewBox')
  let width = Number(svg.getAttribute('width'))
  let height = Number(svg.getAttribute('height'))
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((part) => Number.isFinite(part))) {
      width = parts[2]
      height = parts[3]
    }
  }
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return holder.innerHTML
  }

  svg.setAttribute('width', String(Math.round(width * scale)))
  svg.setAttribute('height', String(Math.round(height * scale)))
  svg.style.maxWidth = '100%'
  svg.style.height = 'auto'
  svg.style.width = 'auto'

  return holder.innerHTML
}

function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        look: 'classic',
        themeVariables: {
          darkMode: false,
          background: 'transparent',
          primaryColor: '#111111',
          primaryTextColor: '#111111',
          primaryBorderColor: '#111111',
          lineColor: '#111111',
          secondaryColor: '#ffffff',
          tertiaryColor: '#ffffff',
          clusterBkg: 'transparent',
          clusterBorder: '#111111',
          fontFamily:
            'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
          fontSize: '16px',
        },
        flowchart: {
          curve: 'linear',
          htmlLabels: false,
          padding: 10,
          nodeSpacing: 48,
          rankSpacing: 64,
          useMaxWidth: false,
        },
      })
      return mermaid
    })
  }

  return mermaidReady
}

export function Mermaid({ chart }: { chart: string }) {
  const reactId = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadMermaid()
      .then((mermaid) => mermaid.render(`mermaid-${reactId}`, chart.trim()))
      .then(({ svg }) => {
        if (!cancelled) {
          setSvg(fitSvgToDotSize(routeEdgesBetweenDots(svg)))
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      })

    return () => {
      cancelled = true
    }
  }, [chart, reactId])

  if (error) {
    return (
      <pre className="not-prose my-8 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        {error}
      </pre>
    )
  }

  return (
    <figure
      className="dependency-graph not-prose my-10 flex justify-center text-slate-950 dark:text-slate-100"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      aria-label="Dependency diagram"
    />
  )
}
