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
In Rails that same job is a concern: add a capability to a model so PORO collaborators can depend on the role.
Everything else on the include list is a different organising problem wearing a module.
{% /callout %}

Related: [Mix-Ins as Traits](/docs/mix-ins-as-traits), [The One Job of a Concern](/docs/one-job-of-a-concern), [Scalability of Composition](/docs/scalability-of-composition).

## The catalog

Modules got used for every row.
Only one row is properly theirs; the Rails leftover is the same row on a model — a capability for collaborators, not a second job.
Send the rest home so the include list can be a capability list.

| Problem | Mechanism | `include` a module? |
|---|---|---|
| Share pure utilities (formatters, date math, `Utils`) | Namespace + `module_function`; call `Utils.foo(x)` | no |
| Share behaviour clustered on one argument | A class; that argument in the constructor | no |
| Variations of one role (controllers of this app, a kind of exporter) | Single inheritance, depth one. `ApplicationController`, `BaseExporter` | no — that's the parent. Ruby already has SI; do not spend the module on it |
| Reuse that needs its own lifetime or state (notify, charge, generate) | Collaborator + DI; host delegates | no |
| An operation *on* a record (`Billable`, `Onboardable`) | PORO / form / service that *takes* the model | no |
| Model file is long (scopes, queries extracted by kind) | Query object, or leave them on the model | no — file length is not a capability |
| Presentation / formatting | Decorator, presenter, helper function | no |
| Side effects on save | Host keeps the callback; it calls a job or object | no |
| Authorization | Policy object (`user` + `record`) | no |
| "Every controller needs this" (`current_user`, authn) | That's the role — base controller | no |
| Constants / config | Namespace module, or `Rails.configuration` | no |
| Class-method utilities (`User.recent`) | Query object, or a dedicated class | no |
| Admit a model to a capability its POROs depend on (`Billable` → `Issue.new(billable)`) | Concern as trait: DSL + small provided API; operation stays in the PORO | **yes — this is the Rails job** |
| Orthogonal capability that needs host internals (`Enumerable` / `Comparable` shape) | Mixin as trait; host owns state + glue | **yes — this is the job** |

Test: `Thing.new(host).call` → never a trait.
Child only fills gaps in a parent → never a mixin.
Needs `each`, provides `map` → trait.

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
See [Mix-Ins as Traits](/docs/mix-ins-as-traits).

## Payoff of sending the rest home

Once the other rows have somewhere to go, a class includes a handful of capabilities.
The list is high-signal: `Comparable`, `Taggable`, `Notifiable` as a *real* trait — not `Utils`, `Scopes`, `Callbacks`.

That list **scales better as mixins** because you stopped using mixins to scale everything else:

- **P is small** — few partners in the ancestor chain, so less silent override and less accidental interaction.
- **S is small** — each trait talks through a tiny required API; the code in the module is pure.
- **Host owns state and glue** — the mixin cannot dictate ivars or `params`.

Understandability: `ancestors` means "what this object can do," not "every DRY we ever did."

The mixin-as-trait discipline itself is [Mix-Ins as Traits](/docs/mix-ins-as-traits).
The Rails DSL leftover is [The One Job of a Concern](/docs/one-job-of-a-concern).

## Rough draft

*(Prose begins here once the outline settles.)*
Good and bad examples: one per row, which problem, which mechanism, what went wrong when a module was used instead.
