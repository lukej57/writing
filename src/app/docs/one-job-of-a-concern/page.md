---
title: The One Job of a Concern
nextjs:
  metadata:
    title: The One Job of a Concern
    description: ActiveSupport::Concern is still mixin inheritance. Its one honest job is adding a capability to a model so PORO collaborators can depend on that role.
---

{% callout title="TL;DR" type="note" %}
A concern is a Rails-specific mixin, not a third composition model.
It has every shortcoming of `include`: no encapsulation, full host access, still inheritance.
Its one job is adding a **capability** to a model so collaborating POROs can depend on that role — `Issue.new(billable)`, not `include Billable` into `Issue`.
`included do` exists because admitting the model to the role needs class-level Rails DSL (`has_many`, `validates`, `scope`) that a plain module cannot host.
That grouping is the means, not a second purpose.
The macros that fire are the host's: ActiveRecord on the record, ActiveModel on a class you own.
A concern used only by one class is that class with a table of contents.
On a controller the same job is an **endpoint**, not a helper.
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
| Inline mixin | `concerning` | Concern defined inside the class file. Same rules; slightly less fan-out of the *file*, not of the coupling. The honest form of a single-use concern — still the God class. |

The important split in `included do`: **class-level DSL** (macros the host would have written) vs **instance internals** (`@foo`, `params`).
The first can be glue for a capability.
The second is the concern owning state.

## Why concerns exist at all

That is what they are *for*: adding a capability to a model so PORO collaborators can use it.

`Billable` on `Invoice` is how the record admits itself to a role (`#total`, `#currency`, the line items that make those true).
`Issue.new(billable).call` depends on that role, not on `Invoice`.
The PORO is the collaborator.
The concern is not the work.

The Rails-shaped half of the job is why this needs a concern at all.
Admitting a model to a capability usually means associations, validations, scopes — class-level machinery a plain module cannot hold.
`included do` is glue for that DSL.
Grouping declarations "by capability" is how you keep the role small, not an organisational end in itself.

So concerns do make sense in Rails — as traits on the record for collaborators — and they can be overused just like any module.
A concern used only by one class is that class with a table of contents.

## Why the soup is the path of least resistance

Rails already used the parent: `ApplicationRecord`, `ApplicationController`, the mailer base, the job base.
Jam every piece of logic into those classes and SI is gone.
The only reuse operator left on the object is `include`.
Every DRY that should have been a subclass or a collaborator becomes a concern.

The fix is not a better concern.
It is an object the framework does not own — one that can use inheritance freely.
The inverse reflex — replace the concern with a sibling base controller — is the [shallow base class](/docs/taxonomy-of-reuse) on a tree whose parent is already taken.
See [Mix-Ins as Traits](/docs/mix-ins-as-traits) and the [catalog](/docs/catalog-of-organizing-problems).

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

## The job, in one picture

A `Billable` concern on the record groups that capability's DSL (`has_many :line_items`, `validates :currency`) *and* the small provided API (`#total`, `#currency`, `#billable?`).
`Issue.new(billable).call` depends on that role, not on `Invoice`.
The concern is how the record *admits itself* to a capability — the mixin half of [DI complementarity](/docs/scalability-of-composition).
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

## Single-use concerns are still the God class

The other common failure is not a fat shared concern — it is a fat class disguised as several.
`User` includes `UserAuthentication`, `UserBilling`, `UserAdmin`; each module exists for `User` alone.
Or `concerning` does the same without leaving the file.
The file got shorter.
The object did not.
Every method is still on `User`.
Every concern still sees every ivar.
There is no encapsulation to lose, because there was never a second object.

That is not "separating concerns."
It is the god object with a table of contents.
A concern that is not a capability other types (or a PORO) actually depend on has no reason to be a module.
See [A Catalog of Organising Problems](/docs/catalog-of-organizing-problems).

## Rules of thumb

- Few concerns per host, each small and atomic. Mixins have no encapsulation and later include wins; a pile of shared code will overwrite itself. Minimal state interaction; host decides state.
- A concern used only by one class is still that class. Files are not a boundary.
- `included do` only for **one** capability's class-level DSL — and only macros the host actually has (AR vs AM).
- Prefer a base class for same-role variation — on an object you own, not one layer deeper in `ApplicationRecord` or `ApplicationController`. ActiveModel does not spend that slot.
- Two controllers sharing a finder is not same-role variation. A sibling `*Controller` that exists to hold `set_foo` / `*_params` is the shallow-base pathology. Pull the work into a collaborator; each host writes the glue. A one-liner may stay duplicated.
- Two controllers sharing a CanCan `authorize!` is not a trait and not a utility. Leave the one-liner. `Ability` is the policy. `AuthorizesX.call(self)` imported the host; a lambda is the same ceremony. A thicker procedure takes `user` + record.
- On a controller, a concern-as-trait adds an **endpoint** (`#export` + host glue). It does not extract helpers. The resource's CRUD is the role.
- Prefer a collaborator for the operation; prefer a concern only to admit the model to the role that collaborator depends on.
- The collaborator may *internally* be an SI family or wear a mixin — DI complements both; it does not replace them.
- Do not include the record's concern into the PORO. The PORO takes the role, or wears its own AM traits.

## Rough draft

*(Prose begins here once the outline settles.)*
