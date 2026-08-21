# Reading list

Unpublished workspace. Nothing here is routed; only `page.md` becomes an article.

Watch Bernhardt first. Everything else annotates it.

## The practical thesis

1. **Gary Bernhardt, "Boundaries" (2012 talk)** — the practical thesis whole: data across boundaries, behaviour within them, functional core with imperative shell. Watch first; everything else annotates it.

2. **Peter Naur, "Programming as Theory Building" (1985)** — twelve pages, and the source of the recoverability argument.

3. **Rich Hickey, "The Value of Values" (talk)** — why inert data decouples across time and identity in a way a live object can't.

4. **Wadler, "The Expression Problem" (1998 mailing list note)** — two pages, states the open/closed inversion exactly.

## The duality, properly

5. **William Cook, "On Understanding Data Abstraction, Revisited" (2009)** — the canonical treatment of ADTs vs objects as duals rather than variants.

6. **John Reynolds, "User-Defined Types and Procedural Data Structures..." (1975)** — the original observation, and worth reading after Cook to see how early it was known.

7. **Jacobs & Rutten, "A Tutorial on (Co)Algebras and (Co)Induction"** — the formal core: constructors vs observers as initial vs final. This is where the category theory work meets the architecture question, and it's the one that'll make the duality feel inevitable rather than analogical.

## Context, resolution, and why DI isn't the fix

8. **Kiselyov & Shan, "Functional Pearl: Implicit Configurations" (2004)** — literally about propagating ambient configuration without a global; the Current problem stated as a types problem.

9. **Wadler, "The Essence of Functional Programming" (1992)** — Reader/environment passing derived rather than presented, so you see why the plumbing takes that shape.

10. **Mark Seemann, "Dependency Rejection" (blog series)** — his own walk-back from injection toward pushing decisions to the edge. Closest thing to a written version of what we worked out about seams vs distance.

11. **Moseley & Marks, "Out of the Tar Pit" (2006)** — state and context as the accidental-complexity axis; the systems-level version of segment boundaries.

## Constructive answers

12. **Swierstra, "Data Types à la Carte"** — revisit specifically as an expression-problem resolution now that you have the duality framing.

13. **Kiselyov & Ishii, "Freer Monads, More Extensible Effects"** — plan-then-execute made first-class; the machinery behind hoisting all context to a construction phase.

14. **Page-Jones on connascence** — vocabulary for grading coupling (value, timing, execution). Least theoretically deep, most immediately usable for arguing about Rails code with colleagues.
