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
Its one genuine job is grouping class-level Rails DSL **by capability**, because a plain module cannot host that machinery.
`included do` is glue for that DSL — not a licence to own ivars or `params`.
The macros that fire are the host's: ActiveRecord on `ApplicationRecord`, ActiveModel on a class you own.
A concern can also be the small role interface that collaborating POROs depend on — it is not the collaborator.
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

## You cannot put Rails persistence magic in a PORO

`has_many`, `scope`, `after_commit`, `enum` live on ActiveRecord.
A plain Ruby object will not grow them because you `include`d a concern that calls them.
`included do` is `class_eval` on the host: the macros that exist are the host's.

That is not a reason to keep the operation on the model.
It is a reason to split the *capability* from the *operation*.

## ActiveModel is concern-like machinery on a class you own

ActiveModel is how an object you own acquires Rails-facing interfaces without taking the `ApplicationRecord` parent:

| Include on *your* class | What you get | Still missing |
|---|---|---|
| `ActiveModel::API` / `ActiveModel::Model` | Naming, conversion, translations, validations, hash assign — `form_with`, `valid?`, `errors` | Persistence, associations, queries |
| `ActiveModel::Attributes` | `attribute :issued_on, :date` — casting, defaults | Columns, `scope` |
| `ActiveModel::Dirty` / `Callbacks` / `Serialization` | Change tracking, AM callbacks, `as_json` | `after_commit`, AR `has_many` |

Those modules *are* traits: a capability, required glue on the host, no table.
They do not occupy SI.

```
class ApplicationForm
  include ActiveModel::API
  include ActiveModel::Attributes
end

class InvoiceForm < ApplicationForm   # SI is yours
  attribute :invoice_id, :integer
  validates :invoice_id, presence: true
end
```

`ActiveSupport::Concern` works here.
`included do` may call `attribute`, `validates`, AM callbacks — anything the ActiveModel host already responds to.
It may not call `has_many` or `scope`.
A concern that mixes both is two hosts pretending to be one capability.

ActiveModel::Model is the recommended bundle when the PORO must sit in a form or a mailer the way a record does.
It is still an include list of capabilities, not a reason to jam the operation back onto `Invoice`.

## Concerns as the interface collaborators depend on

The other honest job is the role surface, not the work.

A `Billable` concern on the record groups that capability's DSL (`has_many :line_items`, `validates :currency`) *and* the small provided API (`#total`, `#currency`, `#billable?`).
`Issue.new(billable).call` depends on that role, not on `Invoice`.
The concern is how the record *admits itself* to a capability — the mixin half of [DI complementarity](/docs/scalability-of-composition).
The PORO is the collaborator.
Do not `include Billable` into `Issue`; do not put `Issue`'s charge logic in the concern.

Two directions, both legal:

| | Where the concern lives | What the PORO does |
|---|---|---|
| Role on the record | AR (or AM) host includes the capability | Takes the host (`Issue.new(billable)`) |
| Rails face on the PORO | PORO includes AM (+ an AM-only concern if one capability's DSL repeats) | *Is* the form / command; SI among forms is free |

The first is "many existing types become the collaborator."
The second is "this object I own needs `form_with`."
Neither is "put the operation in a module on the model."

## The usual failure

The concern ships trait + state + glue.
It reads ivars and `params`, so it dictates host shape.
The composer is no longer the class.
S becomes unbounded ([Scalability of Composition](/docs/scalability-of-composition)).

## Rules of thumb

- Small, atomic, composable; minimal state interaction; host decides state.
- `included do` only for **one** capability's class-level DSL — and only macros the host actually has (AR vs AM).
- Prefer a base class for same-role variation — on an object you own, not one layer deeper in `ApplicationRecord`. ActiveModel does not spend that slot.
- Prefer a collaborator for reusable behaviour with a real boundary; prefer a concern only for that leftover row of the [catalog](/docs/catalog-of-organizing-problems), or as the small role the collaborator depends on.
- The collaborator may *internally* be an SI family or wear a mixin — DI complements both; it does not replace them.
- Do not include the record's concern into the PORO. The PORO takes the role, or wears its own AM traits.

## Rough draft

*(Prose begins here once the outline settles.)*
