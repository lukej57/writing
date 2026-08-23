import withMarkdoc from '@markdoc/next.js'

import withSearch from './src/markdoc/search.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
  pageExtensions: ['js', 'jsx', 'md', 'ts', 'tsx'],
  // @markdoc/next.js only emits Turbopack .md rules when this key is present.
  turbopack: {},
}

export default withSearch(
  withMarkdoc({ schemaPath: './src/markdoc', dir: process.cwd() })(nextConfig),
)
