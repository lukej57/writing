const fs = require('fs')
const path = require('path')
const Markdoc = require('@markdoc/markdoc')
const glob = require('fast-glob')

const cache = new Map()

function toString(node) {
  let str =
    node.type === 'text' && typeof node.attributes?.content === 'string'
      ? node.attributes.content
      : ''
  if ('children' in node) {
    for (const child of node.children) {
      str += toString(child)
    }
  }
  return str
}

function extractSections(node, sections, slugify, isRoot = true) {
  if (isRoot) {
    slugify.reset()
  }
  if (node.type === 'heading' || node.type === 'paragraph') {
    const content = toString(node).trim()
    if (node.type === 'heading' && node.attributes.level <= 2) {
      const hash = node.attributes?.id ?? slugify(content)
      sections.push([content, hash, []])
    } else {
      sections.at(-1)[2].push(content)
    }
  } else if ('children' in node) {
    for (const child of node.children) {
      extractSections(child, sections, slugify, false)
    }
  }
}

function collectSearchData(slugifyWithCounter) {
  const pagesDir = path.resolve('./src/app')
  const slugify = slugifyWithCounter()
  const files = glob.sync('**/page.md', { cwd: pagesDir })

  return {
    pagesDir,
    data: files.map((file) => {
      const url =
        file === 'page.md' ? '/' : `/${file.replace(/\/page\.md$/, '')}`
      const md = fs.readFileSync(path.join(pagesDir, file), 'utf8')

      let sections
      if (cache.get(file)?.[0] === md) {
        sections = cache.get(file)[1]
      } else {
        const ast = Markdoc.parse(md)
        const title = ast.attributes?.frontmatter?.match(
          /^title:\s*(.*?)\s*$/m,
        )?.[1]
        sections = [[title, null, []]]
        extractSections(ast, sections, slugify)
        cache.set(file, [md, sections])
      }

      return { url, sections }
    }),
  }
}

function renderSearchModule(data) {
  return `
    import FlexSearch from 'flexsearch'

    let sectionIndex = new FlexSearch.Document({
      tokenize: 'full',
      document: {
        id: 'url',
        index: 'content',
        store: ['title', 'pageTitle'],
      },
      context: {
        resolution: 9,
        depth: 2,
        bidirectional: true
      }
    })

    let data = ${JSON.stringify(data)}

    for (let { url, sections } of data) {
      for (let [title, hash, content] of sections) {
        sectionIndex.add({
          url: url + (hash ? ('#' + hash) : ''),
          title,
          content: [title, ...content].join('\\n'),
          pageTitle: hash ? sections[0][0] : undefined,
        })
      }
    }

    export function search(query, options = {}) {
      let result = sectionIndex.search(query, {
        ...options,
        enrich: true,
      })
      if (result.length === 0) {
        return []
      }
      return result[0].result.map((item) => ({
        url: item.id,
        title: item.doc.title,
        pageTitle: item.doc.pageTitle,
      }))
    }
  `
}

module.exports = async function searchLoader() {
  const { slugifyWithCounter } = await import('@sindresorhus/slugify')
  const { pagesDir, data } = collectSearchData(slugifyWithCounter)
  if (typeof this.addContextDependency === 'function') {
    this.addContextDependency(pagesDir)
  }
  return renderSearchModule(data)
}
