# Writing

A personal blog focused on principled software development, Ruby, and Rails. Built with [Next.js](https://nextjs.org), [Markdoc](https://markdoc.io), and [Tailwind CSS](https://tailwindcss.com).

## Getting started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site locally.

## Writing articles

Articles are written in Markdoc (Markdown with custom components) and stored in `src/app/docs/`. Each article is a folder with a `page.md` file.

### Available components

- `{% callout %}` - Highlighted callout boxes
- `{% quick-link %}` - Card-style links for the home page
- Code blocks with syntax highlighting via Shiki

## Features

- **Global search** - Powered by [FlexSearch](https://github.com/nextapps-de/flexsearch), accessible via the search input or `⌘K` shortcut
- **Dark mode** - Theme switching via [next-themes](https://github.com/pacocoursey/next-themes)
- **Static export** - Deploys to GitHub Pages as a static site

## Tech stack

- [Next.js](https://nextjs.org) - React framework with static export
- [Markdoc](https://markdoc.io) - Markdown-based content authoring
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [Shiki](https://shiki.style) - Syntax highlighting
- [FlexSearch](https://github.com/nextapps-de/flexsearch) - Full-text search
