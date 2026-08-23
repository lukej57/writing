---
title: Scalability of Composition
nextjs:
  metadata:
    title: Scalability of Composition
    description: Composition mechanisms scale in inverse proportion to coupling. Fan-out is not the degree.
---

{% callout title="TL;DR" type="note" %}
How far a composition mechanism scales is inverse to the coupling it installs.
Fan-out is only the number of partners — it is not the degree.
Load is roughly directions × partners × surface.
That is why dependency injection plus small public APIs scales furthest, and mixin inheritance scales least.
{% /callout %}

Related: [A Taxonomy of Reuse](/docs/taxonomy-of-reuse), [The Dark Side of DRY](/docs/dark-side-of-dry), [Mix-Ins as Traits](/docs/mix-ins-as-traits).

Coupling has a *mechanism* and a *degree*.
Fan-out is only the number of partners.
Every technique can say "N", so N cannot be how we rank them.

## Load

```
load ≈ D × P × S
```

- **D** — directions: 2 if either side can break the other (shared implementation, hooks); 1 if the client depends on a published API and the provider does not know the client.
- **P** — partners: how many types share this relationship (the old "fan-out").
- **S** — surface width: how much of each partner is in the contract. Whole implementation / all ivars → large. A role of *k* method names → *k*.

N is P.
Mixins and DI can have the same P; they do not have the same load, because S and D differ.
Fan-out is *cheap* when S is small and D is 1.
Fan-out is *expensive* when S is "everything" and D is 2.

## Why the ceiling is where it is

| Technique | Mechanism | S (surface) | D | P (partners) | Load |
|---|---|---|---|---|---|
| Mixin inheritance | shared implementation, no boundary | unbounded: whole mixin + whole host | 2 | N unrelated hosts (by design) | 2 · N · (everything) |
| Multiple inheritance | shared implementation, many parents | whole of each parent + state diamond | 2 | N parents × M subclasses | worst when both grow |
| Single inheritance | shared implementation, one parent | whole parent | 2 | N subclasses of *one role* | 2 · N · \|parent\| |
| Traits | flattening; required methods are the contract | k required names (if you keep it so) | 2 | N hosts | 2 · N · k |
| Object composition (DI) | client → public API | k published names | 1 | N clients | N · k |

Which problems each technique *solves* is [A Taxonomy of Reuse](/docs/taxonomy-of-reuse).
This table is only how expensive the relationship is once you have chosen it.

## Same ten partners, different load

| | P | S | D | Load |
|---|---|---|---|---|
| 10 classes include a 40-method concern | 10 | ~40 + host internals | 2 | huge |
| 10 subclasses of one base controller | 10 | \|parent\| | 2 | large, but one role |
| 10 classes include `Enumerable` | 10 | 1 (`each`) | 2 | 20 |
| 10 callers of a one-method command | 10 | 1 (`call`) | 1 | 10 |

P=10 is identical; S and D are not.
Public interfaces win the ranking because they drop D to 1 *and* let you keep k small.
They win *again* when k stays small.
A 40-method service object is `N · 40` — still a lot of coupling, just unidirectional.

## Ranked least → most scalable

| | Technique | Scales to | Breaks when |
|---|---|---|---|
| least | Mixin inheritance | a small capability on a few hosts | many includes, or many methods per mixin |
| | Multiple inheritance | almost never worth it | diamond, named parents, state copied twice |
| | Single inheritance | one level of role variation | the hierarchy deepens, or the parent becomes a junk drawer |
| | Traits | orthogonal capabilities on a class | the required API grows; mixins pretending to be traits |
| most | Object composition (DI) | a system | the interface fattens into a god collaborator |

This is not a ladder you climb and never return to.
Pick the *least* coupling that still fits the job.
Mixins look more compositional than SI and rank *below* it because they spend the boundary *and* multiply the children.
DI is not always better; it pays once sharing an implementation has become the problem.

## Public interfaces are how DI earns that rank

Same rules apply to a trait's required methods (the interface to the host) and to a collaborator's API.

| Principle | Means | Violated when |
|---|---|---|
| Role interface, not header interface (Fowler; ISP) | Depend on a small role (`each`, `call`, `charge`), not the whole class dumped as methods | `UserConcern`, "the Payment class interface" |
| Depend on the role, not the class (DIP) | Inject `auditor`, not `PostgresAuditLog` | constructor takes a concrete type you cannot substitute |
| Tell, don't ask | Send a command; do not pull internals and decide | `if collaborator.status == :open; collaborator.save` |
| Don't reach through (Law of Demeter) | Talk to your collaborator, not its collaborator | `user.account.wallet.credit` |
| Hide what can change (Parnas) | If it isn't in the interface, clients must not need it | mixin reads `@foo`; trait that needs twelve host methods |

The traits paper already says traits should stay lean and focus on a small set of collaborating features.
That *is* ISP inside the class: `Enumerable` requires `each`; `Comparable` requires `<=>`.
A fat required set is a header interface wearing a trait costume.

Connascence (Page-Jones; Weirich in the Ruby world) is the finer vocabulary if we want it: prefer connascence of name over type over algorithm.
Optional, one aside, not a sixth table.

## Adjacent

*The Dark Side of DRY* is about rotating coupling from horizontal (duplication) to vertical (the shared abstraction).
This article is about *which* abstraction mechanism you reached for, and why some of them cannot take many partners.

## Rough draft

*(Prose begins here once the outline settles.)*
