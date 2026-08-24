---
title: A Taxonomy of Reuse
nextjs:
  metadata:
    title: A Taxonomy of Reuse
    description: Single inheritance, multiple inheritance, mixins, and traits — scored on the problems they actually solve.
---

{% callout title="TL;DR" type="note" %}
Reuse has two halves: can you extract shared behaviour, and who is in control when you combine it?
Single inheritance, multiple inheritance, mixins, and traits fail different rows of that matrix.
Mixins exist because they win extraction — including generic wrappers — and then lose control to linearisation.
Keep them few and atomic, or they overwrite each other.
Traits plus a shallow parent is the only column that ticks both halves.
That pair is fundamental: Rust still does both jobs inside one construct.
Ruby already has the parent, so modules should fill the trait slot.
Base classes are **deep and thin** reuse; traits are **wide and shallow**.
The pathologies are the swap: a shallow base class, a deep trait.
{% /callout %}

Related: [Scalability of Composition](/docs/scalability-of-composition), [Include Is Not Composition](/docs/include-is-not-composition), [Mix-Ins as Traits](/docs/mix-ins-as-traits).

Primary reference: Schärli et al., *Traits: Composable Units of Behaviour* (ECOOP 2003).
Secondary / formal: Ducasse et al., *Traits: A Mechanism for Fine-grained Reuse* (TOPLAS 2006).

Axis is *problems × solutions*, not problems × languages.
TOPLAS splits reuse into **decomposition** (can you extract the shared behaviour at all?) and **composition** (when you combine the pieces, who is in control?).
The last column is **traits + single inheritance**, not traits alone.
The paper is explicit that they complement each other: `Class = Superclass + State + Traits + Glue` (ECOOP §3.3).
Languages are a footnote under the table.

Legend: `yes` addresses it; `no` fails; `hidden` looks solved because order / naming papered over it; `—` does not arise.

## Decomposition — can you extract the shared behaviour?

| Sub-problem | SI | MI | Mixins | Traits + SI |
|---|---|---|---|---|
| Share features across siblings (not inherited from the parent) | no | yes | yes | yes |
| Keep ancestors honest (don't push methods too high) | no | yes | yes | yes |
| Factor a generic wrapper (SyncReadWrite around unknown super) | no | no | yes | yes |

## Composition — when you combine, who is in control?

| Sub-problem | SI | MI | Mixins | Traits + SI |
|---|---|---|---|---|
| Diamond of methods (same name, different origin) | — | no | hidden | yes |
| Diamond of state (inherit the field once or twice?) | — | no | — | yes |
| Composer controls the combination (no total order / linearisation) | — | ~ | no | yes |
| Glue stays in the composing class | yes | ~ | no | yes |
| Adding a method does not silently change clients | ~ | no | no | yes |
| Access an override without naming an ancestor | yes | no | ~ | yes |

## What we still want SI for

Not a failure of SI — a job traits are not for.

| Sub-problem | SI | MI | Mixins | Traits + SI |
|---|---|---|---|---|
| Variation within a role (hefty parent, hierarchy depth one; child fills gaps) | yes | ~ | no | yes |
| Reuse unit ≠ instance generator | no | no | yes | yes |

How to read the last column: traits take every composition row; SI keeps `super`, role variation, and a single copy of state.
Together they tick the matrix.
The *hierarchy* stays depth one; the *shared body* of that parent can be deep.
See [Deep and thin vs wide and shallow](#deep-and-thin-vs-wide-and-shallow).
Mixins get decomposition (that is why they exist) and then fail composition.
MI gets sibling sharing and then loses the diamond, wrappers, and named-parent fragility.

Rust looks like a counterexample — a proper trait system as the *only* reuse mechanism, no superclass.
It is not.
The typeclass half of that system (`impl Trait for Type`, default methods, one impl per trait per type) is the SI job without a parent class.
See [Rust looks traits-only](#rust-looks-traits-only).

## The techniques

**Single inheritance.**
Decomposition: cannot share sibling features → duplicate, or pollute the parent ("inappropriate hierarchy").
Cannot factor a generic wrapper.
Composition: diamond does not arise; `super` is unambiguous; glue lives in the subclass.
Fragile base class if you go deep.
Retained job: *variation within a role* — a hefty parent as behavioural template; children fill gaps.
Hierarchy depth one; the reused body can be deep.
Travels thinly: one family, one use case.
As the number of children grows, the parent should tend toward a **template with slots**: the algorithm stays in the base, children only fill the blanks.
Less ad-hoc variation from the parent — not the parent growing new "real" behaviour, and not children rewriting it.
That is how the fragile base class stays in check while P grows.

**Multiple inheritance.**
Decomposition: sibling sharing, yes; generic wrappers, no (`super` / `A::read` bound to a named parent).
Composition: diamond of methods *and* of state; accessing an override means naming the ancestor, which tangles the hierarchy into call sites.
Cook via Snyder: "Multiple inheritance is good, but there is no good way to do it."

**Mixin inheritance.**
Decomposition: yes, including wrappers (late-bound `super`).
This is why mixins exist — and why they *look* like composition.
Composition: total order; later silently wins; glue disperses into intermediate classes (`Rectangle + MColor + MBorder`); adding a method to a mixin can clobber another with no alarm.
This is still inheritance.
Flexibility without a boundary is not the GoF slogan.
That is why mixin-as-trait discipline keeps the count small and the units atomic.
You cannot encapsulate, and you cannot see the clash.
A large shared body, or a long include list, is how one mixin overwrites another.
Paper traits signal the conflict at the composer; Ruby linearises.
See [Include Is Not Composition](/docs/include-is-not-composition).

**Traits + single inheritance.**
Provided methods, required methods as parameters, **no state**, host supplies state + glue.
Order irrelevant; conflicts explicit.
Flattening: composition is structure, not a second semantics.
No state diamond; method diamond is a conflict marker; glue in the composer; aliases instead of named parents; new methods surface as conflicts at the direct client.
Superclass is not leftover: traits do not replace deriving a class from a parent.
They replace using the parent (or a mixin chain) as the unit of fine-grained reuse.
A language can hide the parent inside a typeclass (`impl Trait for Type`) and still be doing this job — that is Rust, not a traits-only column.

Worked example of the *trait* shape (one required method, large provided API): paper `TMagnitude`; Ruby `Comparable` / `Enumerable`; Rust `Ord` / `Iterator`.
Worked example of the *SI* shape: a family of settings providers injected into applicable checks — variations on one hefty original.
Language snippets illustrate the *solution*, not a second axis.

## Deep and thin vs wide and shallow

The two jobs have opposite shapes.

| | Base class (SI) | Trait |
|---|---|---|
| Shape | **Deep and thin** | **Wide and shallow** |
| How much is shared | A hefty body — most of "what this role *is*" | A small provided API over a tiny required surface (`each`, `<=>`) |
| How far it travels | One family, one use case | Many unrelated types |
| Specificity | Very specific | Very generic |
| State | Parent owns the shared state of the role | Host owns state; trait needs internals |
| What you spend | The one superclass slot | A slot on the include list (you can have several) |
| Testability / ownership | Ordinary class tests; you own the hierarchy | Fake-host tests; no encapsulation — tolerable *because* it is shallow and pure |

**Deep and thin.**
Settings providers injected into applicable checks: variations on the original hefty provider.
A lot of code is reused; it does not travel.
A new check gets a new variant of the same role, not a new kind of object.
That family is a collaborator — DI already did the boundary; SI makes the variants cheap.
As more variants appear, the original should crystallize into slots the children fill — not a parent that keeps changing "real" behaviour for each new sibling.
Putting that body in a mixin would be a deep trait: wide fan-out of something that is not generic, with worse ownership.

**Wide and shallow.**
`Enumerable`, `Comparable` — and `Serializable` in the same spirit.
Usable everywhere, consequently not very deep.
Pure methods over one required hook.
They can tolerate the reduced testability and the missing boundary *because* they stay small.
They would not make sense as a base class.
It is not worth giving up your only superclass just to be enumerable, when you might also want to be comparable and serialisable — all of which need internal state.
Those are capabilities, not a role.

**Two pathologies — the swap.**

| Pathology | What it looks like | What it wanted to be |
|---|---|---|
| Shallow base class | `class Foo < EnumerableBase` with almost no body; or a "Base" that exists to share `#each` | A trait. You spent the parent on a capability. |
| Deep trait | A 40-method concern; a settings-provider-as-module; `UserConcern` | A base class on an object you own, or a collaborator. You spent the include list on a role. |

**Buys / pitfalls — stub, return to this.**
Pros = what the shape buys.
Pitfalls = what you still pay after the swap.
The swap is not a cheaper other tool.

| | Buys (when the shape matches) | Pitfall (after the swap) |
|---|---|---|
| SI | Hefty body, cheap variants, thin blast radius | Shallow base: spent the parent on a capability; still need mixins for a second one |
| Trait | Stack capabilities that need internals; cheap admission | Deep trait: S explodes; composer lost; specific logic travels too far |

"Shallow parent" in the matrix means hierarchy depth one, not an empty parent.

## Where the solutions landed

Under the table, not as columns:

- Single inheritance — the default OO model. Java, C#, Ruby classes, Smalltalk classes.
- Multiple inheritance — C++, Eiffel, Python, CLOS. Ruby does not have it; cover as a solution that was tried, not as a destination.
- Mixin inheritance — Strongtalk, Jam, C++ mixins-via-templates, Ruby `include` / `prepend`. Scala's "traits" belong here (linearisation), despite the name.
- Traits + single inheritance — Squeak 3.9 / Pharo (the paper's implementation). Rust looks like traits alone; the typeclass fusion is the missing parent ([below](#rust-looks-traits-only)). Pharo later allowed slots on traits — a retreat from "no state"; not the model.

## Rust looks traits-only

Rust has no class inheritance and no mixins.
For the problems in this matrix, a proper trait system is the only reuse mechanism the language needs.
That looks like the last column dropping SI.

It does not.
Rust fused paper traits with Haskell typeclasses.
A typeclass is "this type is a member of this role."
That is *variation within a role* — the job we still want SI for — without a superclass.

| Paper / SI | Rust typeclass analogue |
|---|---|
| Abstract parent as template | Trait with default methods (`Iterator`, `Ord`) |
| Child fills the gaps | `impl Trait for T` supplies the required methods |
| One parent for that role | Coherence: one impl per trait per type |
| Superclass owns state; subclass is glue | The type owns fields; the `impl` is glue |

The paper-trait half is still there: a type wears many traits, composition is unordered, required methods are the contract, no fields on the trait.
The typeclass half is why that can be the *only* reuse construct: `impl Trait for T` *is* the shallow parent.
One mechanism; both jobs.
The last column stays **traits + SI** even when a language never grew a superclass.

That is why the pair is fundamental — and why Ruby modules should be used like traits.
Ruby already has the parent.
The module is the remaining slot: orthogonal capabilities, not a second inheritance system and not a folder for every DRY.
`include DocumentBehaviour` instead of `< Document` is using the trait slot for the SI job.
See [Mix-Ins as Traits](/docs/mix-ins-as-traits).

Do not add a Rust column.
Snippets (`Ord` / `Iterator`) illustrate the *shape*, including this fusion.

## Caveats (prose, not cells)

- Mixins "avoid" the diamond by linearising. That is the total-ordering problem, not a solution. Mark `hidden`.
- SI's `~` on silent change is the fragile base class: innocuous if the hierarchy is depth one; lethal if deep. That is why we keep SI and cap its depth.
- Traits still impact clients when you add a method (new conflict). The win is the conflict is *signalled at the direct composer*, who can exclude to restore behaviour, with no ripple of glue mixins.
- Same-origin diamond (one trait arriving via two paths) is not a conflict, because traits have no state. That is the row SI/`—` cannot even see and MI botches.

## How this ranks (not this article)

The matrix says which problems a technique *solves*.
[Scalability of Composition](/docs/scalability-of-composition) says how far each technique *scales*, as a function of coupling.
Mixins rank *below* SI on that curve even though they win more decomposition rows — they spend the boundary and multiply the children.

Both jobs recur *behind* a public API.
A collaborator can be a shallow SI family (variation within a role, substantial base) or can wear a mixin (orthogonal capability on unrelated types).
The client depends on the role either way.
That complementarity is the scalability article's, not a new column here.

## Rough draft

*(Prose begins here once the outline settles.)*
