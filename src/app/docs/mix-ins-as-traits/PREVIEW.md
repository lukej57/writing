# Mix-Ins as Traits — chapter preview

The long outline was split (23 Aug 2026).
This file is the map for the *synthesis* article.
The axioms are now their own drafts.

Not published. Not the article.

## The claim in one breath

`include` is mixin inheritance, not "composition over inheritance."
Modules earn their keep as **traits**: a small capability, pure methods, host owns state and glue.
Everything else is a different organising problem.
`Class = Superclass + State + Traits + Glue`.
None of SI, traits, or DI is always better.

## Axioms (write these first)

| Article | What it must establish |
|---|---|
| [A Taxonomy of Reuse](/docs/taxonomy-of-reuse) | Problems × SI / MI / mixins / traits+SI. Mixins win extraction, lose control. |
| [Scalability of Composition](/docs/scalability-of-composition) | `load ≈ D × P × S`. Mixins least, DI + small API most. |
| [A Catalog of Organising Problems](/docs/catalog-of-organizing-problems) | Where each job lives. `include?` for two rows only. |
| [Include Is Not Composition](/docs/include-is-not-composition) | Category error. Ancestor chain ≠ collaborator. |
| [The One Job of a Concern](/docs/one-job-of-a-concern) | `included do` is class-level DSL glue for one capability. |

This article assumes those and does: ownership of the equation, the Ruby dictionary, mixin-as-trait discipline, the Invoice/Estimate story, the close.

## What stays here

- Ownership table (trait / state / glue) and composite-trait warning.
- Coherence vs conflict-at-compose (why Ruby will not get uniqueness of assignment).
- Theory → Ruby dictionary (`include` / `prepend` / `extend`).
- Discipline: required API, fake-host tests, `Enumerable` / `Comparable`.
- Story: naïve → soup → equation (`examples/PLAN.md`).
- Close: short include list; SI + traits scale a class; collaborators scale a system.

## Decisions already locked

- Axis of the paper matrix is solutions, not languages — lives in the taxonomy article.
- Last column is traits **plus** SI; Superclass in the equation is deliberate.
- Glue lives on the composer; when that is a class, the class owns state **and** glue.
- Composite traits only if subtraits are an implementation detail of a real capability.
- DI is not the winner of every row; pick the least coupling that still fits.
- DI complements **both** SI and mixins: it is the boundary; they are how you *produce* injectables (SI family vs capability on many types).
- Story for the prose: naïve Invoice/Estimate → concern soup → equation. Build soup first.

## Still to write

- The axiom articles' prose (outlines already extracted).
- The three snapshots under `examples/snapshots/`.
- Actual synthesis prose in `page.md`.
- Nav links when a piece is no longer a draft.

## Reading order for the next session

1. This file.
2. The five axiom `page.md` files if picking up a splinter.
3. `examples/PLAN.md` if picking up the story.
4. This folder's `page.md` for ownership, dictionary, and the close.
5. Papers only when citing; ECOOP for narrative, TOPLAS for operators.
