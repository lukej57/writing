---
title: A Catalog of Organising Problems
nextjs:
  metadata:
    title: A Catalog of Organising Problems
    description: Modules got used for every row. Only one or two rows are theirs.
---

{% callout title="TL;DR" type="note" %}
Most "where does this code go?" questions are not mixin questions.
Pure utilities, clustered arguments, role variation, operations on a record, presentation, side effects — each has a home.
`include` is for an orthogonal capability that needs the host's internals.
Keep that list short and each mixin atomic: mixins have no encapsulation, and later include silently overwrites.
In Rails that same job is a concern: add a capability to a model so PORO collaborators can depend on the role.
A God class split into concerns that only that class includes is still a god object.
A sibling base controller is not the inverse of a controller concern: a parent that exists to share a finder is the shallow-base pathology.
A called module that takes the controller (`AuthorizesX.call(self)`) is rung 1 misapplied — you passed the host because the function was not pure.
A controller trait adds an **endpoint**; helpers and `authorize!` are not endpoints.
Everything else on the include list is a different organising problem wearing a module.
{% /callout %}

Related: [Mix-Ins as Traits](/docs/mix-ins-as-traits), [The One Job of a Concern](/docs/one-job-of-a-concern), [Include Is Not Composition](/docs/include-is-not-composition), [Scalability of Composition](/docs/scalability-of-composition).

## The catalog

Modules got used for every row.
Only one row is properly theirs; the Rails leftover is the same row on a model — a capability for collaborators, not a second job.
Send the rest home so the include list can be a capability list.

| Problem | Mechanism | `include` a module? |
|---|---|---|
| Share pure utilities (formatters, date math, `Utils`) | Namespace + `module_function`; call `Utils.foo(x)` — values, not `self` | no |
| Share behaviour clustered on one argument | A class; that argument in the constructor | no |
| Variations of one role (a kind of exporter; Invoice and Estimate as one document family) | Single inheritance, depth one, on an object you own. `BaseExporter`. A `DocumentsController` only if it is a hefty template, not a finder-holder | no — that's the parent. Ruby already has SI; do not spend the module on it |
| Reuse that needs its own lifetime or state (notify, charge, generate) | Collaborator + DI; host delegates | no |
| An operation *on* a record (`Billable`, `Onboardable`) | PORO / form / service that *takes* the model | no |
| Model file is long (scopes, queries extracted by kind) | Query object, or leave them on the model | no — file length is not a capability |
| God class carved into concerns used only here (`UserAuthentication`, `UserBilling`, `concerning`) | Leave the methods on the class, or extract collaborators / an SI family that other types actually use | no — files are not a boundary; the object is unchanged |
| Presentation / formatting | Decorator, presenter, helper function | no |
| Side effects on save | Host keeps the callback; it calls a job or object | no |
| Authorization | Policy object (`user` + `record`). CanCan: `Ability` is the policy; `authorize!` stays on the controller | no — `include AuthorizesX` for one call is include-list clutter, not a trait. `AuthorizesX.call(self)` imported the host |
| "Every controller needs this" (`current_user`, authn) | That's the app-wide role — `ApplicationController`. Depth one. | no |
| Two controllers share internals (a finder, `*_params`, a `before_action`, the same `authorize!`) | Collaborator that takes *data*, or leave the one-liner on each host. A sibling base only if they are the same role *and* the parent is a hefty template | no — `EmployeeScopedController` is a shallow base. `AuthorizesX.call(self)` is a utility that imported the host. A concern that reads `params` is stolen glue |
| Constants / config | Namespace module, or `Rails.configuration` | no |
| Class-method utilities (`User.recent`) | Query object, or a dedicated class | no |
| Admit a model to a capability its POROs depend on (`Billable` → `Issue.new(billable)`) | Concern as trait: DSL + small provided API; operation stays in the PORO | **yes — this is the Rails job** |
| Orthogonal capability that needs host internals (`Enumerable` / `Comparable` shape) | Mixin as trait; host owns state + glue | **yes — this is the job** |
| Orthogonal *endpoint* on many controllers (`CsvExport#export`) | Same row: the action is the provided API; host writes `export_scope` | **yes — the controller form of a trait**. Not the resource's CRUD. Not a helper. |

Test: `Thing.new(host).call` → never a trait.
`Foo.call(self)` / you had to pass the controller → never a pure utility (rung 1). The function needed the host, so it was glue.
Child only fills gaps in a hefty parent → never a mixin (deep and thin → SI).
As that family grows, the parent should be a template with slots, not a moving target.
Needs `each`, provides `map` → trait (wide and shallow).
Needs `export_scope`, provides `#export` → trait (a controller endpoint).
Extracts `authorize!` / `set_foo` / `*_params` → never a trait (not an endpoint).
Empty parent / one-method "Base" → shallow base class: you wanted a trait.
`FooController < SharedInternalsController` → shallow base on the Rails tree: you wanted a collaborator, or glue on each host.
Fat concern / settings-provider-as-module → deep trait: you wanted a base class or a collaborator.
Concern used only here → a heading, not a trait. Still the God class.

## Escalation (same catalog, as a ladder)

This is not "always prefer a higher number."
DI is the *boundary* between objects.
SI and mixins are how you *produce* objects — or how you structure *this* object.

1. Pure functions in a namespace module (`module_function`), called directly.
2. A class when those functions cluster around a shared argument (it goes in the constructor).
3. Depend on a small role and inject a collaborator when reuse wants its own lifetime.
   The thing you inject may itself be an SI family (cheap new variants of one role) or may wear a mixin (cheap admission of many existing types to a capability).
4. Single inheritance, depth one, when *this* type is a variation of one role.
5. A mixin on *this* object *only* when it is a trait: API plus partial implementation needing the host's internal state.

The ranking of how far those mechanisms *scale* — and why DI complements both SI and mixins rather than replacing them — is [Scalability of Composition](/docs/scalability-of-composition).
This article is only *which problem you are in*.

## When the parent slot is already taken

Rails occupies SI on `ApplicationRecord`, `ApplicationController`, the mailer base, the job base.
If the behaviour stays on those classes, `include` is the only operator left — that is the mixin-for-everything style.
Steps 3 and 4 of the ladder (collaborator; SI for role variation) need an object the framework does not own.
Pull the work out and the SI slot opens.
Keep it in the model and you will `include` a concern for a job that wanted a parent.
Keep it in the controller and the inverse reflex is just as bad: an intermediate `*Controller` that exists to share internals.
See [Mix-Ins as Traits](/docs/mix-ins-as-traits) and [A sibling base controller is not the inverse of a concern](#a-sibling-base-controller-is-not-the-inverse-of-a-concern).

## A file split is not a smaller object

Taking one God class and cutting it into `UserAuthentication`, `UserBilling`, `UserNotifications` — each included only by `User` — is still a god object.
The methods landed back on the same instance.
There is still no encapsulation: every concern sees every ivar.
There is still no second object, no public API, no lifetime.
`concerning` is the honest form of this move: the module never even leaves the file.
Extracting it to `app/models/concerns/` only changes where the reader looks.
The coupling did not move.

A concern earns a file when a *capability* is worn by more than one host, or when a PORO needs that role as an interface.
A concern that has one client is a heading.

See [The One Job of a Concern](/docs/one-job-of-a-concern) and [Include Is Not Composition](/docs/include-is-not-composition).

## A sibling base controller is not the inverse of a concern

The reflex this catalog is trying to break: two controllers share a finder, so `include SetsEmployee`.
The mechanical inverse is `class AwardsController < EmployeeScopedController`.
That is the [shallow base class](/docs/taxonomy-of-reuse): you spent the parent on a capability.
Awards and leave requests are not variations of one role.
The parent has almost no body — `set_employee`, maybe `employee_params`.
Rails already used the SI slot on `ApplicationController`.
Another layer on that tree is the same spend.

Three different controller problems:

| What you actually have | Mechanism |
|---|---|
| Every controller in this app (`current_user`, authn) | `ApplicationController` — that is the role |
| Invoice and Estimate as the same resource family; hefty shared body; children fill slots | `DocumentsController` as a template — rare; the parent must be deep and thin |
| A finder / params / callback / the same `authorize!` two unrelated controllers both write | Collaborator that takes data, or the one-liner stays. Not a concern. Not a sibling base. Not `Foo.call(self)`. |

A concern that reaches for `params` and sets `@employee` is still stolen glue ([The One Job of a Concern](/docs/one-job-of-a-concern)).
Mixin-as-trait discipline would push that glue onto each host (`employee_id`, `employee_scope`) and leave a one-method trait.
For a finder that is ceremony.
The object you own (`EmployeeFinder.new(organisation).find(id)`) is the DRY.
The controller writes `before_action` and assigns the ivar — host-owned glue.

If the duplication is a one-liner, [The Dark Side of DRY](/docs/dark-side-of-dry) applies: keep the copies.
The awkwardness is the signal that you forced an inheritance operator onto a problem that wanted a collaborator, or no DRY at all.

## Passing the controller is not a utility

The other extract, once you have refused the concern: a namespace module with `module_function`, called directly — catalog rung 1.

```ruby
module RosterAuth
  def self.call(controller)
    controller.authorize! :read, controller.roster
  end
end

# in each controller
RosterAuth.call(self)
```

That feels awkward because it is.
Rung 1 is for *pure* functions: `Formatting.currency(amount)`.
`authorize!` is a side effect on CanCan's controller API.
You had to pass the host, so it was never a utility.
A lambda the method can fire (`-> { authorize! :read, roster }`) is the same ceremony: you parameterised the side effect to make the extract look less coupled.

The shared *decision* already has a home: CanCan's `Ability` (`user` + subject).
`authorize!` on the controller is the glue that asks it.
Two controllers writing the same one-liner are not missing a module.
They are each writing glue.

If the procedure grows past a call — resolve the subject, extra checks, a fallback — that is the [authorization](#the-catalog) row: a policy that takes `current_user` (or `current_ability`) and the record.

```ruby
RosterAccess.new(current_user, @roster).authorize!
```

Never the controller.
The host still writes the one line that triggers it.
Wrapping `ability.authorize! :read, roster` and stopping there has not won anything; keep `authorize!`.

## A controller trait adds an endpoint

A controller's public API is its actions.
Embodying mixin-as-trait there means the module **adds an endpoint**.
`include CsvExport` and the controller now has `#export` — an orthogonal capability, wide and shallow, host writes `export_scope` / `export_filename` as glue.
That is `Enumerable` with an HTTP face: required hook, provided action.

```ruby
module CsvExport
  def export
    send_data csv_for(export_scope), filename: export_filename
  end
end

class InvoicesController < ApplicationController
  include CsvExport
  def export_scope = current_org.invoices
  def export_filename = "invoices.csv"
end
```

The resource's own `index` / `show` / `create` are the role.
They belong on the class, or on a hefty `DocumentsController` template — not in a mixin.

`authorize!`, `set_employee`, `invoice_params` are not endpoints.
They do not change what the controller is toward the router.
Putting them on the include list is how you get the huge grab-bag: capabilities mixed with internals.
The include list should read as endpoints and model roles, not as a drawer of helpers.

## Payoff of sending the rest home

Once the other rows have somewhere to go, a class includes a handful of capabilities.
The list is high-signal: `Comparable`, `Taggable`, `Notifiable` as a *real* trait — not `Utils`, `Scopes`, `Callbacks`.

Aim for a **small number** of **atomic** mixins.
Mixins have no encapsulation, and names resolve by ancestor order — later `include` / `prepend` silently wins.
A fat shared module, or a long include list of overlapping modules, is how one capability overwrites another.
Huge shared bodies do not belong on the include list; they belong on a parent (deep and thin) or behind a collaborator, where there is a boundary.
A parent that exists to share a finder is not that parent — it is the shallow-base swap.

That list **scales better as mixins** because you stopped using mixins to scale everything else:

- **P is small** — few partners in the ancestor chain, so less silent override and less accidental interaction.
- **S is small** — each trait talks through a tiny required API; the code in the module is pure.
- **Host owns state and glue** — the mixin cannot dictate ivars or `params`.

Understandability: `ancestors` means "what this object can do," not "every DRY we ever did," and not a table of contents for one God class.

The mixin-as-trait discipline itself is [Mix-Ins as Traits](/docs/mix-ins-as-traits).
The Rails job — a capability on the model for PORO collaborators — is [The One Job of a Concern](/docs/one-job-of-a-concern).

## Rough draft

*(Prose begins here once the outline settles.)*
Good and bad examples: one per row, which problem, which mechanism, what went wrong when a module was used instead.
