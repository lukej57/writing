import clsx from 'clsx'

export function Prose<T extends React.ElementType = 'div'>({
  as,
  className,
  ...props
}: React.ComponentPropsWithoutRef<T> & {
  as?: T
}) {
  let Component = as ?? 'div'

  return (
    <Component
      className={clsx(
        className,
        'prose max-w-none prose-slate',
        // headings
        'prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-34',
        // lead
        'prose-lead:text-slate-500',
        // links
        'prose-a:font-semibold',
        // link underline
        'prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,var(--color-sky-300))] prose-a:hover:[--tw-prose-underline-size:6px]',
        // pre
        'prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg',
        // hr
        'prose-hr:border-slate-200',
      )}
      {...props}
    />
  )
}
