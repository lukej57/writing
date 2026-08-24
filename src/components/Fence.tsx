import { codeToHtml } from 'shiki'

import { Mermaid } from '@/components/Mermaid'

export async function Fence({
  children,
  language,
}: {
  children: string
  language?: string
}) {
  if (language === 'mermaid') {
    return <Mermaid chart={children} />
  }

  const html = await codeToHtml(children.trimEnd(), {
    lang: language || 'text',
    theme: 'github-dark',
  })

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
