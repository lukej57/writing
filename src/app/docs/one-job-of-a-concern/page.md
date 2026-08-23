---
title: The One Job of a Concern
nextjs:
  metadata:
    title: The One Job of a Concern
    description: ActiveSupport::Concern is still mixin inheritance. Its one honest job is class-level DSL glue for a single capability.
---

{% callout title="TL;DR" type="note" %}
A concern is a Rails-specific mixin, not a third composition model.
It has every shortcoming of `include`: no encapsulation, full host access, still inheritance.
Its one genuine job is grouping associations, validations, scopes, and callbacks **by capability**, because a plain module cannot host that class-level machinery.
`included do` is glue for that DSL — not a licence to own ivars or `params`.
{% /callout %}

Related: [A Catalog of Organising Problems](/docs/catalog-of-organizing-problems), [Mix-Ins as Traits](/docs/mix-ins-as-traits), [Include Is Not Composition](/docs/include-is-not-composition).

## What a concern actually is

| Paper / our terms | Rails | What it actually is |
|---|---|---|
| Mixin + a composition-time hook | `ActiveSupport::Concern` | Still mixin inheritance. Adds dependency tracking and a DSL. |
| Glue run on the composer at composition time | `included do ... end` | `class_eval` on the host when included. Legitimate: `has_many`, `validates`, `scope` for **one** capability. Stolen glue: ivars, `params`, host-shape assumptions. |
| Same, for wrappers | `prepended do ... end` | Same hook when `prepend` is used. |
| Metatrait | `class_methods do` / `module ClassMethods` | Concern does `base.extend ClassMethods` (or prepends them if you prepend the concern). |
| Composite trait | concern that `include`s another concern | Concern inserts dependencies onto the host. Still a mixin chain, not flattening. |
| Inline mixin | `concerning` | Concern defined inside the class file. Same rules; slightly less fan-out of the *file*, not of the coupling. |

The important split in `included do`: **class-level DSL** (macros the host would have written) vs **instance internals** (`@foo`, `params`).
The first can be glue for a capability.
The second is the concern owning state.

## Why concerns exist at all

Normally Rails declarations are scattered by kind across a model.
A concern lets them be grouped by capability instead.

The reason this needs concerns specifically is that those declarations are class-level Rails machinery.
A plain module can hold pure methods; the associations, validations, and scopes could not be extracted into it.
The `included do` block is what makes the extraction possible at all.

So concerns do make sense in Rails — and they can be overused just like any module.

## Why the soup is the path of least resistance

Rails already used the parent: `ApplicationRecord`, `ApplicationController`, the mailer base, the job base.
Jam every piece of logic into those classes and SI is gone.
The only reuse operator left on the object is `include`.
Every DRY that should have been a subclass or a collaborator becomes a concern.

The fix is not a better concern.
It is an object the framework does not own — one that can use inheritance freely.
See [Mix-Ins as Traits](/docs/mix-ins-as-traits).

## The usual failure

The concern ships trait + state + glue.
It reads ivars and `params`, so it dictates host shape.
The composer is no longer the class.
S becomes unbounded ([Scalability of Composition](/docs/scalability-of-composition)).

## Rules of thumb

- Small, atomic, composable; minimal state interaction; host decides state.
- `included do` only for **one** capability's class-level DSL.
- Prefer a base class for same-role variation — on an object you own, not one layer deeper in `ApplicationRecord`.
- Prefer a collaborator for reusable behaviour with a real boundary; prefer a concern only for that leftover row of the [catalog](/docs/catalog-of-organizing-problems).
- The collaborator may *internally* be an SI family or wear a mixin — DI complements both; it does not replace them.

## Rough draft

*(Prose begins here once the outline settles.)*
