---
title: Mix-Ins as Traits
nextjs:
  metadata:
    title: Mix-Ins as Traits
    description: TODO
---

{% callout title="TL;DR" type="note" %}
TODO — `include` is mixin inheritance, not composition-over-inheritance. Use mixins as traits (capabilities); SI for shallow role variation; collaborators when reuse outgrows a single host. Rails concerns earn their keep when grouping capability-shaped declarations.
{% /callout %}

This article is the synthesis.
The axioms live elsewhere:

| Claim | Article |
|---|---|
| Which problems SI, MI, mixins, and traits actually solve | [A Taxonomy of Reuse](/docs/taxonomy-of-reuse) |
| Why mixins scale least and DI + small APIs scale most | [Scalability of Composition](/docs/scalability-of-composition) |
| Where each organising problem should live | [A Catalog of Organising Problems](/docs/catalog-of-organizing-problems) |
| `include` is still inheritance | [Include Is Not Composition](/docs/include-is-not-composition) |
| The one honest job of `ActiveSupport::Concern` | [The One Job of a Concern](/docs/one-job-of-a-concern) |

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
Object composition (DI) complements *that* pair once reuse needs a public API.
None of them is always better.

**Smalltalk → Ruby.**
Traits were designed in Squeak.
Ruby sits in that lineage: single inheritance plus mixin modules.
The paper's critique of mixin inheritance is a direct critique of the composition model Ruby shipped with.
The lead-in is not "Ruby secretly has traits"; it is "Smalltalk researchers diagnosed the reuse problem Ruby inherited, and proposed traits as the fix — we can approximate that discipline with modules."

**Coherence does not transfer.**
Do not conflate Rust's "one impl of a trait per type" with the paper's "conflicts are errors."
Ruby has neither uniqueness of assignment nor conflict markers.
`include` / `prepend` linearise; later wins; a gem can include into your class in another file.
Matz considered `Module#mix` (error on name clash) and shipped `prepend` instead.
He has said that if he had known about traits when designing Ruby, he would have chosen them over modules.

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

- **Single inheritance:** variations *within a role* — shallow behavioural templating; child fills gaps / overrides hooks. Fragile base class → prefer depth one.
- **Traits (emulated):** orthogonal *capabilities* added to a host that owns state and glue.
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

Almost every include was a different organising problem ([catalog](/docs/catalog-of-organizing-problems)).
The Rails-shaped leftover is [The One Job of a Concern](/docs/one-job-of-a-concern).

**Close.**
Mixins-as-traits is a useful local discipline inside a language that will not grow paper traits.
The destination is a short include list of capabilities.
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
