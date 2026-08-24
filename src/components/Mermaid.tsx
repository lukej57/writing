'use client'

import { useEffect, useId, useState } from 'react'

let mermaidReady: Promise<typeof import('mermaid').default> | null = null

function insetEdgeEnds(svgMarkup: string) {
  const holder = document.createElement('div')
  holder.innerHTML = svgMarkup
  const svg = holder.querySelector('svg')
  if (!svg) {
    return svgMarkup
  }

  const circle = svg.querySelector('circle, ellipse')
  let gap = 4
  if (circle instanceof SVGCircleElement) {
    const radius = Number(circle.getAttribute('r'))
    if (Number.isFinite(radius) && radius > 0) {
      gap = Math.max(3, radius * 0.4)
    }
  } else if (circle instanceof SVGEllipseElement) {
    const radiusX = Number(circle.getAttribute('rx'))
    if (Number.isFinite(radiusX) && radiusX > 0) {
      gap = Math.max(3, radiusX * 0.4)
    }
  }

  const paths = svg.querySelectorAll<SVGPathElement>(
    'path.flowchart-link, .edgePath .path',
  )
  for (const path of paths) {
    const length = path.getTotalLength()
    if (!Number.isFinite(length) || length <= gap * 2 + 2) {
      continue
    }

    const start = path.getPointAtLength(gap)
    const end = path.getPointAtLength(length - gap)
    path.setAttribute('d', `M${start.x},${start.y} L${end.x},${end.y}`)
  }

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
          nodeSpacing: 64,
          rankSpacing: 88,
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
          setSvg(insetEdgeEnds(svg))
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
