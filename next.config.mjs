import withMarkdoc from '@markdoc/next.js'

import withSearch from './src/markdoc/search.mjs'

// Work around a Next.js 16 webpack regression where Markdoc/MDX pages that
// export `metadata` are incorrectly treated as Client Components in the server
// bundle, failing the build with "You are attempting to export 'metadata' from
// a component marked with 'use client'". Pinning the Markdoc page rule's
// next-swc-loader to the React Server Components layer restores the pre-16.2
// behaviour. See https://github.com/vercel/next.js/issues/91735
const RSC_LAYER = 'rsc'

function pinMarkdocPagesToRscLayer(rules) {
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue

    const test = rule.test
    const isMarkdocRule =
      test instanceof RegExp && (test.test('page.md') || test.test('page.mdoc'))

    if (isMarkdocRule && rule.use) {
      const uses = Array.isArray(rule.use) ? rule.use : [rule.use]
      rule.use = uses.map((entry) => {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof entry.loader === 'string' &&
          entry.loader.includes('next-swc-loader') &&
          entry.options &&
          entry.options.bundleLayer == null
        ) {
          // Clone so the shared defaultLoaders.babel object is not mutated.
          return { ...entry, options: { ...entry.options, bundleLayer: RSC_LAYER } }
        }
        return entry
      })
    }

    if (Array.isArray(rule.oneOf)) pinMarkdocPagesToRscLayer(rule.oneOf)
    if (Array.isArray(rule.rules)) pinMarkdocPagesToRscLayer(rule.rules)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
  pageExtensions: ['js', 'jsx', 'md', 'ts', 'tsx'],
  webpack(config, { isServer }) {
    if (isServer && Array.isArray(config.module?.rules)) {
      pinMarkdocPagesToRscLayer(config.module.rules)
    }
    return config
  },
}

export default withSearch(
  withMarkdoc({ schemaPath: './src/markdoc' })(nextConfig),
)
