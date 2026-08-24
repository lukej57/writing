'use client'

import { useEffect, useId, useState } from 'react'

let mermaidReady: Promise<typeof import('mermaid').default> | null = null

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
          padding: 8,
          nodeSpacing: 72,
          rankSpacing: 96,
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
          setSvg(svg)
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
