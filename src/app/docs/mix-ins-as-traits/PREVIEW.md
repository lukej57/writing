# Mix-Ins as Traits — chapter preview

Snapshot of the argument after the 21 Aug 2026 outlining session.
The dense working notes live in `page.md`. This file is the map so the next pass can start from the story, not from the tables.

Not published. Not the article.

## The claim in one breath

`include` is mixin inheritance, not "composition over inheritance."
It looks compositional because it is more flexible than a single parent.
It is composition **without a boundary**, so it is the least scalable of the reuse tricks.
Modules earn their keep as **traits**: a small capability, pure methods, host owns state and glue.
Everything else is a different organizing problem (namespace, class, SI, collaborator).
Send those home and the include list becomes a short capability list — which is how mixins scale at all.

`Class = Superclass + State + Traits + Glue` (ECOOP §3.3).
SI and traits complement each other inside a class.
Object composition (DI) complements *that* pair once reuse needs a public API.
None of them is always better.

## Three parts

**Part 1 — Theory.**
Problems × solutions, not problems × languages.
Decomposition (can you extract shared behaviour?) and composition (who is in control when you combine it?).
Columns: single inheritance, multiple inheritance, mixins, traits+SI.
Traits+SI is the only column that ticks both halves.
Languages are a footnote: Ruby shipped mixins; Squeak/Pharo shipped paper traits; Rust fused traits with typeclasses (coherence does not transfer).
Papers do not discuss DI; that rung is ours.

**Part 2 — Ruby.**
Dictionary: `include` / `prepend` / `extend` mapped onto the paper.
Catalog of organizing problems — modules only for the trait row (and the small capability-shaped Rails DSL).
Payoff: small P, small S, pure trait code, host owns state and glue. Fragile base class mitigated, not gone.

**Part 3 — Rails.**
God classes justified as composition-over-inheritance.
`included do` is glue for class-level DSL, legitimate for **one** capability, not a licence to own ivars/`params`.
Close on the short include list.

## Tables that should become slides

- Paper rubric (decomposition, composition, what SI is still for).
- Coupling load: `D × P × S` — N is partners, not degree. Same ten partners, different load.
- Scalability ranking (mixins *below* SI; DI at the top because of a public API, and again if that API is small).
- Interface principles (role vs header, DIP, tell-don't-ask, LoD, Parnas) — same list for trait required methods.
- Ownership: trait / state / glue.
- Theory → Ruby; theory → Rails.
- Catalog: problem → mechanism → include?

## Decisions already locked

- Axis of the paper matrix is solutions, not languages.
- Last column is traits **plus** SI; Superclass in the equation is deliberate.
- Glue lives on the composer; when that is a class, the class owns state **and** glue.
- Composite traits only if subtraits are an implementation detail of a real capability. Ruby: nest even less.
- DI is not the winner of every row; pick the least coupling that still fits.
- Story for the prose: naïve Invoice/Estimate → concern soup → equation. Plan in `examples/PLAN.md`. Build soup first. Excerpts into `page.md` only after snapshot 03 exists.

## Still to write

- The three snapshots under `examples/snapshots/`.
- Actual article prose in `page.md` (still an outline).
- Excerpts, TL;DR, nav link when it is no longer a draft.

## Reading order for the next session

1. This file.
2. `examples/PLAN.md` if picking up the story.
3. `page.md` for tables and wording already agreed.
4. Papers only when citing; ECOOP for narrative, TOPLAS for operators.
