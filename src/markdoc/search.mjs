import { createRequire } from 'module'
import * as url from 'url'

const require = createRequire(import.meta.url)
const loaderPath = require.resolve('./search-loader.cjs')
const searchModulePath = url.fileURLToPath(import.meta.url)

export default function withSearch(nextConfig = {}) {
  const searchLoader = {
    loader: loaderPath,
  }

  return Object.assign({}, nextConfig, {
    turbopack: {
      ...nextConfig.turbopack,
      rules: {
        ...nextConfig.turbopack?.rules,
        // Only this module is rewritten into the FlexSearch index. next.config
        // still imports the real withSearch() export via Node, not Turbopack.
        '**/search.mjs': {
          loaders: [searchLoader],
          as: '*.js',
        },
      },
    },
    webpack(config, options) {
      config.module.rules.push({
        test: searchModulePath,
        use: [searchLoader],
      })

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options)
      }

      return config
    },
  })
}
