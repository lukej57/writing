import { useId } from 'react'

// A term with its definition. The definition is a native popover: click
// or tap opens it in every browser, and `interestfor` also opens it on
// hover and focus where interest invokers are supported.
export function Term({
  term,
  definition,
  children,
}: {
  term: string
  definition: string
  children: React.ReactNode
}) {
  const id = `term-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const anchor = { anchorName: `--${id}` } as React.CSSProperties
  const positioned = { positionAnchor: `--${id}` } as React.CSSProperties

  return (
    <>
      <button
        type="button"
        className="term"
        popoverTarget={id}
        popoverTargetAction="show"
        style={anchor}
        {...{ interestfor: id }}
      >
        {children}
      </button>
      <span id={id} popover="auto" className="term-definition" style={positioned}>
        <strong>{term}</strong>
        {definition}
      </span>
    </>
  )
}
