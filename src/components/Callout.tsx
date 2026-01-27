import clsx from 'clsx'

import { Icon } from '@/components/Icon'

const styles = {
  note: {
    container:
      'bg-sky-50',
    title: 'text-sky-900',
    body: 'text-sky-800 [--tw-prose-background:var(--color-sky-50)] prose-a:text-sky-900 prose-code:text-sky-900',
  },
  warning: {
    container:
      'bg-amber-50',
    title: 'text-amber-900',
    body: 'text-amber-800 [--tw-prose-underline:var(--color-amber-400)] [--tw-prose-background:var(--color-amber-50)] prose-a:text-amber-900 prose-code:text-amber-900',
  },
}

const icons = {
  book: (props: { className?: string }) => <Icon icon="book" {...props} />,
  warning: (props: { className?: string }) => (
    <Icon icon="warning" color="amber" {...props} />
  ),
  lightbulb: (props: { className?: string }) => <Icon icon="lightbulb" {...props} />,
}

export function Callout({
  title,
  children,
  type = 'note',
  icon,
}: {
  title: string
  children: React.ReactNode
  type?: keyof typeof styles
  icon?: keyof typeof icons
}) {
  let IconComponent = type === 'warning' ? icons['warning'] : icons['lightbulb']

  return (
    <div className={clsx('my-8 flex rounded-3xl p-6', styles[type].container)}>
      <IconComponent className="h-8 w-8 flex-none" />
      <div className="ml-4 flex-auto">
        <p
          className={clsx('not-prose font-display text-xl', styles[type].title)}
        >
          {title}
        </p>
        <div className={clsx('prose mt-2.5', styles[type].body)}>
          {children}
        </div>
      </div>
    </div>
  )
}
