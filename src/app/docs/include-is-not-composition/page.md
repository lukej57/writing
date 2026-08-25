---
title: Include Is Not Composition
nextjs:
  metadata:
    title: Include Is Not Composition
    description: Rubyists pile mixins into a class and call it composition-over-inheritance. The mechanism is still inheritance.
---

{% callout title="TL;DR" type="note" %}
`include` is mixin inheritance, not composition-over-inheritance.
It looks compositional because you can mix many things.
It is composition **without a boundary** — no object identity, no private state, full access to the host.
The slogan people think they are following is a second object with a public API.
The mechanism they are using is a parent in the ancestor chain.
A God class split into several files is still one object.
{% /callout %}

Related: [A Taxonomy of Reuse](/docs/taxonomy-of-reuse), [The Dark Side of DRY](/docs/dark-side-of-dry), [Mix-Ins as Traits](/docs/mix-ins-as-traits).

## The category error

Rubyists pile mixins into a class and call it composition because it is more flexible than a single parent.
The traits paper names this *mixin inheritance*: mixins use the ordinary inheritance operator.
`include` inserts a module into the ancestor chain (`ancestors`, `is_a?`, `super`).

It looks compositional because you can mix many things.
It is composition **without boundaries**.
That is why it is a far less scalable form of composition than a collaborator.

Trait composition in the paper is the disciplined version of the same *inside-the-class* move (small, no state, explicit conflicts).
Object composition (DI) is a different move: a second object with a boundary.
DI does not replace SI or mixins; it complements both.
The host depends on a small role; SI and mixins are two ways to *produce* something that satisfies it — SI when you need cheap new variants of one role, mixins when you need cheap admission of many existing types to a capability.
See [Scalability of Composition](/docs/scalability-of-composition).
The slogan people think they are following is the second object.
The mechanism they are using is the first, without the discipline.

## The God class in several files

The same category error has a quieter form.
An 800-line `User` becomes `include UserAuthentication`, `include UserBilling`, `include UserNotifications`.
Each module has one client: `User`.
The class looks composed.
The instance is the same god object it was — every method, every ivar, no boundary.
`concerning` does this in one file; `app/models/concerns/` does it across files.
Neither is composition-over-inheritance.
It is a table of contents for a God class.

If the pieces are only used here, they were never a capability.
Leave them on the class, or give a piece its own object.
See [A Catalog of Organising Problems](/docs/catalog-of-organizing-problems).

A second mistake sits next to that one: using `include` for *role variation* when Ruby already has a parent.
SI + traits is the fundamental pair ([taxonomy](/docs/taxonomy-of-reuse)).
Rust still does both jobs inside one construct.
Ruby already filled the SI slot, so the module should be the trait — not a second inheritance system.

The inverse is also a category error.
Two controllers share a finder, so you drop the concern and write `EmployeeScopedController`.
That looks like "we used SI instead of a mixin."
It is the [shallow base class](/docs/taxonomy-of-reuse): you spent the parent on a capability.
The controllers were never variations of one role.
See the [catalog](/docs/catalog-of-organizing-problems) row.

## What `include` actually does

```
include M   ancestors: Class → M → Superclass     class wins over M; M wins over super
prepend M   ancestors: Class is wrapped by M      M sits in front; super in M hits the class
extend  M   eigenclass → M                        module methods become singleton methods
```

| Folk claim | What happens |
|---|---|
| "We composed in `Notifiable`" | `Notifiable` is a parent. `super` follows linearisation. Later include wins. |
| "Composition over inheritance" | No second object. No private state. The mixin may touch anything on the host. |
| "We split the God class into concerns" | Same instance, same methods, same ivars. Files are not a boundary. |
| "More flexible than a base class" | Yes — that is why mixins exist ([taxonomy](/docs/taxonomy-of-reuse): they win extraction). Flexibility is not a boundary. |
| "We used a base controller instead of a concern" | Only if they are one role and the parent is a template. A finder-holder parent is a shallow base — same spend, other operator. |

`prepend` is the one mixin job the paper said mixins do well: a generic wrapper with late-bound `super`.
That is still inheritance.
It is just the wrapper row of the matrix.

## Adjacent slogans

*The Dark Side of DRY* is about rotating coupling from copies to a shared abstraction.
This article is about reaching for the *wrong operator* when you DRY: `include` when you meant `initialize(collaborator)`, or `include` when you meant a parent of one role.

How expensive that operator is, once chosen, is [Scalability of Composition](/docs/scalability-of-composition).
What to do instead, row by row, is the [catalog](/docs/catalog-of-organizing-problems).

In Rails the category error is almost forced: the framework already spent SI on `ApplicationRecord` and friends, so `include` is the only operator left if the logic stays there.
The way out is an object you own, not a more clever concern.
See [Mix-Ins as Traits](/docs/mix-ins-as-traits).

## Rough draft

*(Prose begins here once the outline settles.)*
