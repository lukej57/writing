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

  if (language === 'dataflow') {
    return <Mermaid chart={children} variant="dataflow" />
  }

  const html = await codeToHtml(children.trimEnd(), {
    lang: language || 'text',
    theme: 'github-dark',
  })

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
