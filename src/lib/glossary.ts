// Definitions shared by every article, shown by the {% term %} tag. One
// entry per term, a sentence or two each. A term that belongs to a single
// article goes under `glossary:` in that article's frontmatter instead.
export const glossary: Record<string, { term: string; definition: string }> = {
  mechanic: {
    term: 'Mechanic',
    definition:
      'Work with the same right answer in every context. It can be automated and kept in the background.',
  },
  decision: {
    term: 'Decision',
    definition:
      'A choice whose right answer varies with context. It should be made explicitly, by whoever holds the context.',
  },
  'incidental-complexity': {
    term: 'Incidental complexity',
    definition:
      'Complexity that comes from the tools and the approach, not from the problem being solved.',
  },
}
