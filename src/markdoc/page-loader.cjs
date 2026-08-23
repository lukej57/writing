const fs = require('fs')
const path = require('path')
const Markdoc = require('@markdoc/markdoc')

const SCHEMA_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']

function gatherPartials(ast, schemaDir, tokenizer, parseOptions) {
  const partials = {}

  for (const node of ast.walk()) {
    const file = node.attributes.file
    if (
      node.type === 'tag' &&
      node.tag === 'partial' &&
      typeof file === 'string' &&
      !partials[file]
    ) {
      const filepath = path.join(schemaDir, file)
      if (!fs.existsSync(filepath)) continue
      const content = fs.readFileSync(filepath, 'utf8')
      if (content) {
        const tokens = tokenizer.tokenize(content)
        const partialAst = Markdoc.parse(tokens, parseOptions)
        Object.assign(partials, { [file]: content }, gatherPartials(
          partialAst,
          schemaDir,
          tokenizer,
          parseOptions,
        ))
      }
    }
  }

  return partials
}

function importSchemaModule(schemaDir, variable) {
  for (const ext of SCHEMA_EXTENSIONS) {
    const file = path.join(schemaDir, `${variable}${ext}`)
    if (fs.existsSync(file)) {
      // Use the repo alias so Turbopack does not treat an absolute path as
      // relative to the .md file (it rewrites /workspace/... to ./workspace/...).
      return `import * as ${variable} from ${JSON.stringify(`@/markdoc/${variable}${ext}`)}`
    }
  }
  return `const ${variable} = {}`
}

module.exports = async function pageLoader(source) {
  const {
    dir = process.cwd(),
    schemaPath = './src/markdoc',
    options: { slots = false, ...options } = { allowComments: true },
    nextjsExports = ['metadata', 'revalidate'],
  } = (typeof this.getOptions === 'function' ? this.getOptions() : {}) || {}

  const resourcePath = this.resourcePath || this.resource
  const appDir = path.join(dir, 'src/app')
  const isPage = typeof resourcePath === 'string' && resourcePath.startsWith(appDir)
  const filepath = typeof resourcePath === 'string'
    ? resourcePath.split(`${path.sep}app`)[1]
    : '/'

  const tokenizer = new Markdoc.Tokenizer(options)
  const parseOptions = { slots }
  const schemaDir = path.resolve(dir, schemaPath)
  const tokens = tokenizer.tokenize(source)
  const ast = Markdoc.parse(tokens, parseOptions)
  const partials = gatherPartials(ast, path.resolve(schemaDir, 'partials'), tokenizer, parseOptions)

  if (typeof this.addContextDependency === 'function') {
    this.addContextDependency(schemaDir)
  }

  const nextjsExportsCode = nextjsExports
    .map((name) => `export const ${name} = frontmatter.nextjs?.${name};`)
    .join('\n')

  return `import React from 'react';
import yaml from 'js-yaml';
import Markdoc, {renderers} from '@markdoc/markdoc'
import {getSchema, defaultObject} from '@markdoc/next.js/runtime';

${importSchemaModule(schemaDir, 'config')}
${importSchemaModule(schemaDir, 'tags')}
${importSchemaModule(schemaDir, 'nodes')}
${importSchemaModule(schemaDir, 'functions')}
const schema = {
  tags: defaultObject(tags),
  nodes: defaultObject(nodes),
  functions: defaultObject(functions),
  ...defaultObject(config),
};

const tokenizer = new Markdoc.Tokenizer(${JSON.stringify(options)});
const source = ${JSON.stringify(source)};
const filepath = ${JSON.stringify(filepath)};
const tokens = tokenizer.tokenize(source);
const parseOptions = ${JSON.stringify(parseOptions)};
const ast = Markdoc.parse(tokens, parseOptions);
const frontmatter = ast.attributes.frontmatter
  ? yaml.load(ast.attributes.frontmatter)
  : {};
const {components, ...rest} = getSchema(schema)

async function getMarkdocData(context = {}) {
  const partials = ${JSON.stringify(partials)};
  Object.keys(partials).forEach((key) => {
    const tokens = tokenizer.tokenize(partials[key]);
    partials[key] = Markdoc.parse(tokens, parseOptions);
  });
  const cfg = {
    ...rest,
    variables: {
      ...(rest ? rest.variables : {}),
      markdoc: {frontmatter},
      ...(context.variables || {})
    },
    partials,
    source,
  };
  const content = await Markdoc.transform(ast, cfg);
  return JSON.parse(JSON.stringify({
    content,
    frontmatter,
    file: { path: filepath },
  }));
}

${isPage ? nextjsExportsCode : ''}
export const markdoc = {frontmatter};
export default async function MarkdocComponent(props) {
  const markdoc = await getMarkdocData();
  return renderers.react(markdoc.content, React, {
    components: {
      ...components,
      ...props.components,
    },
  });
}
`
}
