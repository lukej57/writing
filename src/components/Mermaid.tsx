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
// arrowheads stack. Redraw each edge along the true centre line
// so it meets the circle at its own point.
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
    const from = svgPointLocal(
      path,
      source.x + ux * (source.r + gap),
      source.y + uy * (source.r + gap),
    )
    const to = svgPointLocal(
      path,
      target.x - ux * (target.r + gap),
      target.y - uy * (target.r + gap),
    )
    path.setAttribute('d', `M${from.x},${from.y} L${to.x},${to.y}`)
  }

  for (const marker of svg.querySelectorAll('marker')) {
    marker.setAttribute('markerWidth', '5')
    marker.setAttribute('markerHeight', '5')
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
