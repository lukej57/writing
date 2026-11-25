import { Tag } from '@markdoc/markdoc'

import { Callout } from '@/components/Callout'
import { Demo } from '@/components/Demo'
import { QuickLink, QuickLinks } from '@/components/QuickLinks'
import { Term } from '@/components/Term'
import { glossary } from '@/lib/glossary'

import { articleGlossaries } from './nodes'

const tags = {
  callout: {
    attributes: {
      title: { type: String },
      type: {
        type: String,
        default: 'note',
        matches: ['note', 'warning'],
        errorLevel: 'critical',
      },
      hideIcon: { type: Boolean },
    },
    render: Callout,
  },
  figure: {
    selfClosing: true,
    attributes: {
      src: { type: String },
      alt: { type: String },
      caption: { type: String },
    },
    render: ({ src, alt = '', caption }) => (
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} />
        <figcaption>{caption}</figcaption>
      </figure>
    ),
  },
  demo: {
    selfClosing: true,
    attributes: {
      src: { type: String, required: true },
      title: { type: String },
      height: { type: Number },
    },
    render: Demo,
  },
  // {% term "key" %}text{% /term %}. The article's own glossary, under
  // `glossary:` in its frontmatter, wins over the shared one.
  term: {
    attributes: {
      primary: { type: String, required: true },
    },
    render: Term,
    transform(node, config) {
      let key = node.attributes.primary
      let entry = articleGlossaries.get(config)?.[key] ?? glossary[key]

      if (!entry?.term || !entry?.definition) {
        throw new Error(
          `{% term "${key}" %} needs a term and a definition, in the article's frontmatter glossary or in src/lib/glossary.ts`,
        )
      }

      return new Tag(
        this.render,
        { term: entry.term, definition: entry.definition },
        node.transformChildren(config),
      )
    },
  },
  'quick-links': {
    render: QuickLinks,
  },
  'quick-link': {
    selfClosing: true,
    render: QuickLink,
    attributes: {
      title: { type: String },
      description: { type: String },
      icon: { type: String },
      href: { type: String },
    },
  },
}

export default tags
