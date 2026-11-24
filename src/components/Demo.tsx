'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// Embeds a static page from public/demos and sizes the frame to its content.
// The demo is same-origin, so the frame's document can be measured directly.
export function Demo({
  src,
  title,
  height = 320,
}: {
  src: string
  title?: string
  height?: number
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const [frameHeight, setFrameHeight] = useState(height)

  const watch = useCallback(() => {
    const body = frame.current?.contentDocument?.body
    if (!body) return

    const measure = () => {
      const next = Math.ceil(body.getBoundingClientRect().height)
      if (next > 0) setFrameHeight(next)
    }

    observer.current?.disconnect()
    observer.current = new ResizeObserver(measure)
    observer.current.observe(body)
    measure()
  }, [])

  useEffect(() => {
    if (frame.current?.contentDocument?.readyState === 'complete') watch()
    return () => observer.current?.disconnect()
  }, [watch])

  const base = process.env.NEXT_PUBLIC_BASE_PATH || ''

  return (
    <figure className="not-prose my-8">
      <iframe
        ref={frame}
        src={`${base}${src}`}
        title={title || 'Demo'}
        onLoad={watch}
        style={{ height: frameHeight }}
        className="w-full rounded-lg border border-slate-200 bg-white dark:border-slate-700"
      />
      {title && (
        <figcaption className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          {title}
        </figcaption>
      )}
    </figure>
  )
}
