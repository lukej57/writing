---
title: Mix-Ins as Traits
nextjs:
  metadata:
    title: Mix-Ins as Traits
    description: TODO
---

{% callout title="TL;DR" type="note" %}
`include` is mixin inheritance, not composition-over-inheritance.
SI + traits is the fundamental pair — the papers put Superclass in the equation; Rust still does both jobs inside one construct.
Ruby already has SI, so modules should do the trait job: small capabilities, host owns state and glue.
Base classes are deep and thin (a hefty settings-provider family); traits are wide and shallow (`Enumerable`).
The pathologies are the swap: a shallow base class, a deep trait.
Collaborators when reuse outgrows a single host.
Rails occupies the SI slot on models, views, and controllers — if every piece of logic stays there, `include` is the only reuse operator left.
Pull work into objects you own so inheritance is free again.
ActiveModel is how those objects borrow Rails' face without borrowing the parent.
A concern is how you add a capability to a model for those POROs to depend on — not where the operation lives.
{% /callout %}

This article is the synthesis.
The axioms live elsewhere:

| Claim | Article |
|---|---|
| Which problems SI, MI, mixins, and traits actually solve | [A Taxonomy of Reuse](/docs/taxonomy-of-reuse) |
| Why mixins scale least and DI + small APIs scale most | [Scalability of Composition](/docs/scalability-of-composition) |
| Where each organising problem should live | [A Catalog of Organising Problems](/docs/catalog-of-organizing-problems) |
| `include` is still inheritance | [Include Is Not Composition](/docs/include-is-not-composition) |
| A concern adds a capability to a model for PORO collaborators | [The One Job of a Concern](/docs/one-job-of-a-concern) |

Primary reference: Schärli et al., *Traits: Composable Units of Behaviour* (ECOOP 2003).
Secondary / formal: Ducasse et al., *Traits: A Mechanism for Fine-grained Reuse* (TOPLAS 2006).

## Outline (working)

### The claim

`include` is mixin inheritance, not "composition over inheritance."
It looks compositional because it is more flexible than a single parent.
It is composition **without a boundary**, so it is the least scalable of the reuse tricks ([scalability](/docs/scalability-of-composition)).

Modules earn their keep as **traits**: a small capability, pure methods, host owns state and glue.
Everything else is a different organising problem — [the catalog](/docs/catalog-of-organizing-problems).
Send those home and the include list becomes a short capability list — which is how mixins scale at all.

`Class = Superclass + State + Traits + Glue` (ECOOP §3.3).
SI and traits complement each other inside a class ([taxonomy](/docs/taxonomy-of-reuse)).
That pair is **fundamental**, not a Smalltalk accident.
Object composition (DI) complements *that* pair once reuse needs a public API.
None of them is always better.

**The pair is fundamental — so Ruby modules should be traits.**
The papers put Superclass in the equation on purpose: traits do not replace deriving a class from a parent.
Rust looks like it dropped the parent; the typeclass half (`impl Trait for Type`, default methods, coherence) is still doing the SI job ([taxonomy](/docs/taxonomy-of-reuse)).
One mechanism; both jobs.
That is further evidence the pair is required.

Ruby already has the parent.
Using modules as a second inheritance system — `include DocumentBehaviour` instead of `< Document`, or a folder for every DRY — is doing the SI job twice, badly.
The module slot is the *trait* slot.
Use it for orthogonal capabilities.
Leave role variation to the superclass we already have.

**Smalltalk → Ruby.**
Traits were designed in Squeak.
Ruby sits in that lineage: single inheritance plus mixin modules.
The paper's critique of mixin inheritance is a direct critique of the composition model Ruby shipped with.
The lead-in is not "Ruby secretly has traits"; it is "Smalltalk researchers diagnosed the reuse problem Ruby inherited, and proposed traits as the fix — we can approximate that discipline with modules."
We *should* approximate it, because the SI half of the pair is already in the language.

**Coherence does not transfer.**
Do not conflate Rust's "one impl of a trait per type" with the paper's "conflicts are errors."
Ruby has neither uniqueness of assignment nor conflict markers.
`include` / `prepend` linearise; later wins; a gem can include into your class in another file.
Matz considered `Module#mix` (error on name clash) and shipped `prepend` instead.
He has said that if he had known about traits when designing Ruby, he would have chosen them over modules.

Rust's coherence is also a hint about the SI job.
One impl per trait per type is "one parent for this role."
That is why Rust can look like traits-only reuse: the typeclass half of the fusion (`impl Trait for Type`, default methods) *is* the shallow parent.
Ruby already has a real superclass for that job.
A module is not a typeclass, so it should not try to be the parent.
See [A Taxonomy of Reuse](/docs/taxonomy-of-reuse).

The mitigation is surface area: few mixins per class, few methods per mixin, and other rungs of the [catalog](/docs/catalog-of-organizing-problems) for internal reuse.
The paper's own Smalltalk advice is in the same spirit: design traits around abstractions, not reuse; avoid too-fine-grained traits; prefer classes, use traits to resolve design conflicts.

---

### Ownership: who owns state, traits, and glue

The equation is an *ownership* rule.
TOPLAS: glue always lives in the combining entity — the composer is in complete control of plugging the parts together.

| Piece | What it is | Who owns it |
|---|---|---|
| Trait | provided methods; required methods as parameters; no fields | the trait (a mixin, if we are emulating) |
| State | instance variables | the class (or its superclass). Never the trait. |
| Glue | accessors onto that state; methods that satisfy requirements; conflict resolution; wiring traits to each other | the **composer** |

When the composer is a class, the class owns **state and glue**.
`Enumerable` does not store a collection; the host does; `each` is glue the host writes.
When the composer is a composite trait, that trait may supply glue *between subtraits*.
Requirements it cannot satisfy — especially state accessors — propagate up until a class owns them.
Traits never own state; they never own the final glue onto state.

**Composite traits — use sparingly.**
The paper's reason is *aspects of one capability*, not a folder for includes.
Flattening is the test: a client of `TCircle` should not need to know about `TMagnitude`.
In Ruby the caution is sharper: `include` inside a module is another mixin chain, with no flattening browser and no conflict markers.
Nest only when the composite is itself a real capability.

The Rails anti-pattern is delivering all three in the mixin: the concern reads `@user`, `params`, sets ivars, calls `has_many`, implements the behaviour.
The concern now dictates the host's internals.
The host is no longer the composer.
In load terms, S is no longer *k* required names — it is "whatever the concern reached for."
See [The One Job of a Concern](/docs/one-job-of-a-concern).

---

### Roles of the tools (thesis)

- **Single inheritance:** variations *within a role* — **deep and thin**. A hefty parent; children fill gaps. Hierarchy depth one; travels one family, one use case (settings providers into applicable checks). Fragile base class if you stack parents. Rust absorbs this job into the trait system via typeclasses. Ruby already has it as `< Parent`, so modules should not.
- **Traits (emulated):** orthogonal *capabilities* — **wide and shallow**. `Enumerable`, `Comparable`: generic, pure, tiny required surface. This is the job Ruby modules are for — because the SI slot is filled, and you may want several capabilities that all need internals.
- **DI / collaborators:** *between* objects, once a piece of behaviour wants its own identity, state, and boundary. Complements **both** SI and mixins, not a third option that replaces them.
- **Multiple inheritance:** same problem space; Ruby does not offer it; historical attempt, not a destination.

The papers do not discuss dependency injection; that rung is ours.
"Composition" there means trait composition (flattening methods into a class), not object collaboration.

**Complementary in two directions.**
Inside a class: SI + traits scale *this* object (role variation plus capabilities); DI is what you reach for when the reused thing wants its own lifetime and boundary.
On the far side of that boundary the same two tools recur: the collaborator may be an SI family (cheap new *variants* of one role, sharing a substantial base) or may wear a mixin (cheap *admission* of many existing types to a small role interface).
The host depends on that minimum interface either way.
SI does not make injection easier — DI already did that — it makes writing the family of injectables cheaper.
Mixins do not get injected; objects that *have* the mixin do.

See [Scalability of Composition](/docs/scalability-of-composition) for the table.
See [A Taxonomy of Reuse](/docs/taxonomy-of-reuse) for deep-and-thin vs wide-and-shallow.
Pros are what the shape buys; pitfalls are what you still pay after the swap.
Shallow base class: you spent the parent on a capability and still need mixins for the second.
Deep trait: S explodes, the composer is lost, and fake-host tests become a second implementation.

DI is not always the better option.
It is what you reach for when inheritance has hit its scale limit.
A tiny `Enumerable`-shaped mixin is still the right tool *on the host*.
A second object for "the same role, slightly different" is usually the wrong one — that is still SI, possibly *behind* an injected role if some other class is the client.

---

### Part 2 — Ruby (emulating traits)

**What Ruby gives you.**
Modules + `include` / `prepend` = mixin inheritance.
Gap vs paper traits: state can leak into modules; conflicts resolved by ancestor order; no first-class exclude/alias; still inheritance → no encapsulation, fragile base class still applies.
Gap vs Rust: no coherence. Assignment of an implementation is "whoever included last."

**Dictionary: theory → Ruby**

```
include M   ancestors: Class → M → Superclass     class wins over M; M wins over super
prepend M   ancestors: M → Class → Superclass     M wraps the class; super in M hits the class
extend  M   eigenclass of the object/class → M    module methods become singleton methods
```

| Paper | Ruby | What it actually is |
|---|---|---|
| Use a trait on a class | `include M` | Mixin inheritance. Instance methods of `M` become instance methods of the class. |
| Generic wrapper (late-bound `super`) | `prepend M` | The one mixin job the paper said mixins do well. |
| Metatrait | `extend M` | Methods of `M` become class / singleton methods. |
| Provided methods | `def` in the module | The behaviour the trait adds. |
| Required methods | `self.foo` calls the module does not define | No language support. Convention + tests against a fake host. |
| State | instance variables | Must live on the host. Ivars assigned in the module = trait owning state (forbidden). |
| Glue | methods you write *on the class* | Host owns them. `params[:id]` → `record_id` lives here. |
| Alias / exclude | no real equivalent | Why Ruby cannot do paper composition. |
| Flattening | does not exist | You always see the ancestor chain. |
| Conflict | later `include`/`prepend` wins | Silent. |
| Namespace of functions (not a trait) | `module_function` / `extend self` | Catalog rung 1. Do not `include` these. |
| Object composition | `initialize(collaborator)` / `delegate` | Different column of the ranking table. |

**Using mixins as traits (when they earn a place).**
Discipline: provided methods + required methods (documented / tested); host owns **state and glue**; trait talks to the host only through the required API.
Test the trait against a fake host that implements those methods.
Canonical examples: `Enumerable`, `Comparable`.
This is **one row** in the [catalog](/docs/catalog-of-organizing-problems).

**Payoff.**
Once the other rows have somewhere to go, a class includes a handful of capabilities.
Fragile base class is mitigated, not gone: purity + a required-method surface is the substitute for a real boundary.

---

### Part 3 — Rails

God classes justified as composition-over-inheritance.
Name the mistake: mixin soup is inheritance without a single parent *or* an object boundary — the least scalable of the three.

**Rails occupies the SI slot.**
Jam every piece of logic into a model, view, or controller and you are always already inside the framework's inheritance hierarchy:

```
Invoice            < ApplicationRecord    < ActiveRecord::Base
InvoicesController < ApplicationController < ActionController::Base
InvoiceMailer      < ApplicationMailer    < ActionMailer::Base
```

The parent is taken.
You cannot write `Invoice < Document` or `EmailNotifier < Notifier` *on those classes* without fighting a hierarchy you do not own.
The only reuse operator left on the object is `include`.
That is why "everything is a concern" is the path of least resistance — not because mixins are the right tool, but because SI + traits is fundamental and Rails already spent SI.

`ApplicationController` / `ApplicationRecord` are the *one* SI step Rails gives you: "every X in this app."
Depth one.
Further role variation does not belong one layer deeper in the framework tree.

**Pull logic into objects you own.**
A PORO, a form, a notifier family, an exporter — these can use inheritance freely.
`class EstimateDocument < BillableDocument`, `class SlackNotifier < Notifier`, `Issue.new(invoice).call`.
The model or controller stays a thin host: persistence, HTTP, one capability's DSL, maybe a real trait.
The catalog rows that wanted a parent or a collaborator finally have somewhere to go.
Staying inside MVC and reaching for another concern is how the soup is made.

**ActiveModel is how a PORO borrows Rails' face without borrowing its parent.**
You cannot put `has_many` / `scope` / `after_commit` on a plain object — that magic is ActiveRecord's.
You *can* `include ActiveModel::API` (and `Attributes`, `Dirty`, …) on a class you own.
Those modules are traits: validations, naming, `form_with`, typed attributes.
SI stays yours (`InvoiceForm < ApplicationForm`).
A concern on that host may use AM macros, not AR macros.

**That is what concerns are for.**
Add a capability to a model so its PORO collaborators can depend on that role.
`Billable` groups the DSL *and* `#total` / `#currency`; `Issue.new(billable)` depends on the role, not on `Invoice`.
Grouping declarations by capability is the Rails means (plain modules cannot host `has_many`).
It is not a second job, and it is not the operation.
Do not include `Billable` into `Issue`.
The full split (AR vs AM, two directions) is [The One Job of a Concern](/docs/one-job-of-a-concern).

Almost every include was a different organising problem ([catalog](/docs/catalog-of-organizing-problems)).

**Close.**
SI + traits is the pair that ticks the matrix.
Rust still does both jobs inside one construct.
Ruby already has SI, so mixins-as-traits is not a taste — it is the remaining slot.
Rails spends that SI slot on `ApplicationRecord` and friends; objects you own get it back.
The destination is a short include list of capabilities on a thin host, and a graph of non-framework objects that can inherit.
Inheritance (SI + mixins-as-traits) and collaborators complement each other because they sit at different points on the coupling curve.
Traits decorate a host; they do not replace a second object, and a second object does not replace a trait.

---

### Story (still this article)

Naïve Invoice/Estimate → concern soup → equation.
Plan in `examples/PLAN.md`.
Build soup first.
Excerpts into `page.md` only after snapshot 03 exists.
The story *applies* the axioms; it does not re-derive them.

## Rough draft

*(Prose begins here once the outline settles.)*
