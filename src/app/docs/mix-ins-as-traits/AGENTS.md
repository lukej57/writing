# Mix-Ins as Traits — working notes for agents

## What this folder is

- `page.md` — the article itself. This is the only file that becomes a route (`/docs/mix-ins-as-traits`).
- `AGENTS.md` — this file. The brief, and instructions for anyone (human or agent) working on the draft.
- `reference/` — the source papers. Never published; not referenced by the build.
- `examples/` — code resources for the story (naïve → concern soup → equation). Not published. Start with `examples/PLAN.md`.

Anything else dropped in here (outline scratch, cut sections) is inert as far as Next.js is concerned.

## The brief

*Luke's own words. This is the argument; edits should serve it.*

I'm writing a paper or an article for Ruby developers with advice on how to use modules. The gist is that I see people using modules inside Rails for absolutely everything. Everything is a module. Things that might be better off as a separate class just become a module. Common code gets dried up using modules. Everything is a module or a concern, and you wind up with God classes essentially.

And I'd like to make a few points based partly on my own experience and a couple of papers that are in this directory, the PDFs.

For common utility code. They should just be pure functions, and they can just sit in a module as a namespace and be referenced directly using, say, `module_function`. That's one point.

If a bunch of those utility functions cluster and depend on a common argument, it can become a class, and what's common can go into the constructor. That class can be referenced directly.

We can use the "vanilla rails" approach of using models as facades to delegate to separate objects and pass in their dependencies via the constructor.

And then we can save modules for things that are like traits, where you're including basically an API and a partial implementation that needs access to the internal state of the object to finish. Perfect examples here are enumerable and comparable. This creates classes whose include list is a small and compact high-signal list of object capabilities. Rather than a big grab bag of random things.

I want to communicate that mixins still use inheritance, so they don't separate concerns. They expose full internal implementations, and they just are a flawed but reasonable approach to the problem attempting to be solved by multiple inheritance. That is, they address the flexibility issues with single inheritance. But they are still vulnerable to the Fragile Base Class problem because they lack encapsulation. They expose their entire implementation. That's why their contents should be pure and a host class should decide all matters of state, and why they should be small and very, very easy to test. They should have kind of a minimal interaction with state.

These are just some off-the-top-of-the-head thoughts. I want to enrich them with the contents of the PDF papers in this directory.

I also want to climb the ladder of abstraction and provide both rules and a general explanation, substantiated by good and bad examples and why they're good or bad.

I think it's reasonable to include a good summary of the background and general ideas proposed in these papers, and then have the examples translate them into a Ruby and Rails context.

And then we'll move toward the end of the paper, where we see modules or mixins used as traits versus mixins used for absolutely everything. We should probably discuss concerns about the kind of Rails-specific manifestation of mixins and why they should be small, atomic, composable, etc.

Some other examples are controllers with similar functionality. Unless the controllers are truly different in their domain, they could probably share a base controller, rather than using mixins to deduplicate their internals. Mixins should add some sort of out-of-band capability to a controller. If the controllers can be siblings under a base class, we should reach for that before using mixins, unless it truly does add a non-specific capability to that controller.

On the other hand, concerns have one genuinely interesting role: co-locating and grouping together the many different kinds of Rails declarations — associations, validations, scopes, API methods, callbacks — that together implement a single capability of a Rails class. Normally those declarations are scattered by kind across a model; a concern lets them be grouped by capability instead. That is probably where concerns make sense.

The reason this needs concerns specifically is that those declarations are class-level Rails machinery. If you didn't have concerns and wanted to add a capability to a model that leveraged a lot of that machinery, you'd be stuck: a plain module can hold pure methods, but the associations, validations, and scopes just couldn't be extracted into it. The `included do` block is what makes the extraction possible at all. So concerns do make sense in Rails — but they can be overused just like any module, and they have all the same shortcomings (no encapsulation, full access to host state, still inheritance).

## Shape

Roughly the order to build toward:

1. The problem: everything is a concern; God classes by accumulation.
2. Background from the papers: why single, multiple, and mixin inheritance each fail; what a trait is.
3. The ladder down into Ruby/Rails — the escalation:
   - pure functions in a namespace module (`module_function`), called directly;
   - a class when those functions cluster around a shared argument (it goes in the constructor);
   - the "vanilla Rails" facade — model delegates to a collaborator, dependencies via constructor;
   - a mixin *only* when it is a trait: API plus partial implementation needing the host's internal state.
4. `Enumerable` / `Comparable` as the canonical traits.
5. Good and bad examples with the reasoning made explicit.
6. Rails-specific manifestation: concerns, why small/atomic/composable, what state discipline buys you;
   the legitimate case for concerns — grouping associations, validations, scopes, etc. by capability
   rather than by kind.

## Reference material

Both papers are by the same core group; the second supersedes and formalises the first.

- `reference/traits_paper.pdf` — Schärli, Ducasse, Nierstrasz & Black, *Traits: Composable Units
  of Behaviour*, ECOOP 2003 (LNCS 2743), 31pp. The readable one. Identifies the conceptual and
  practical problems with single, multiple, and mixin inheritance, then presents traits: groups of
  pure methods, composed into classes by glue code that connects them and supplies the state.
  Includes a refactoring experience report. Start here for the narrative and the critique.
- `reference/traits_paper_2.pdf` — Ducasse, Nierstrasz, Schärli, Wuyts & Black, *Traits: A Mechanism
  for Fine-grained Reuse*, TOPLAS 2006, 66pp. The journal-length treatment: formal model of trait
  composition (traits composing into traits as well as classes), plus a larger validation
  refactoring a non-trivial application. Go here for precise definitions and the composition
  operators (flattening, conflict resolution, aliasing/exclusion).

Cite specifics — section or page — when pulling from a paper. Do not paraphrase either from memory;
the terminology is precise and easy to get subtly wrong. Note especially that "trait" in the papers
means something stricter than a Ruby mixin: traits provide *no* state and conflicts are resolved
explicitly by the composing class rather than by linearisation. The gap between that and Ruby's
`include` is a large part of the article's substance.

## House style

Match the finished articles (`dark-side-of-dry`, `t-struct-in-context`) rather than the skeletons:

- Australian/British spelling — *factorisation*, *behavioural*, *synthesise*.
- One sentence per line. Semantic linefeeds keep diffs readable; never reflow a paragraph into one long line.
- Short declarative sentences. Make the claim, then support it. No throat-clearing intros.
- Open with a `{% callout title="TL;DR" type="note" %}` giving the argument away in two or three lines.
- `##` for sections. The title lives in frontmatter, so there is no `#` heading in the body.
- Prefer ASCII box diagrams in a plain fenced code block over images — that is the established idiom here.
  If a real image is needed it goes in `public/images/mix-ins-as-traits/` and is referenced with
  `{% figure src="/images/mix-ins-as-traits/....svg" alt="..." caption="..." /%}`.
- Code fences are Shiki-highlighted; tag the language (```ruby).

## Markdoc tags available

Defined in `src/markdoc/tags.js`:

- `{% callout title="..." type="note|warning" %}` — highlighted aside.
- `{% figure src="..." alt="..." caption="..." /%}` — image with caption.
- `{% quick-links %}` / `{% quick-link %}` — home page cards; not used inside articles.

## Publishing

The article is not linked anywhere until it is added to `src/lib/navigation.ts`. Leave it out
while it is a draft — several unfinished articles already sit unlinked in `src/app/docs/`.
