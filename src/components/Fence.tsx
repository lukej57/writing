import { codeToHtml } from 'shiki'

export async function Fence({
  children,
  language,
}: {
  children: string
  language?: string
}) {
  const html = await codeToHtml(children.trimEnd(), {
    lang: language || 'text',
    theme: 'github-dark',
  })

  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
