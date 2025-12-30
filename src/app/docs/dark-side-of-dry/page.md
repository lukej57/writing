Software developers all know the slogan Don't Repeat Yourself (DRY). It is a standard remedy for an obvious problem: the technical debt created by duplicate code. The fatal flaw with DRY is that it picks one side of a hidden tradeoff. This intellectual shortcut plays itself out as trading one kind of technical debt for another.

# Implicit Horizontal Coupling

Suppose you write similar functionality in a few different places. This creates duplicate code with some minor differences. When you need to change one instance of the solution, you may need to change all of the others in lockstep. You are at constant risk of missing something. That’s tech debt.

```
DUPLICATION: Horizontal Coupling

┌─────────┐   ┌─────────┐   ┌─────────┐
│ Site A  │   │ Site B  │   │ Site C  │
│┌───────┐│   │┌───────┐│   │┌───────┐│
││ logic ││ ← ─ ─ ─ ─ ─ ─ → ││ logic ││
│└───────┘│   │└───────┘│   │└───────┘│
└─────────┘   └─────────┘   └─────────┘

Invariant changes must be repeated
```

The DRY slogan tells you to pull the duplicate code back into a common abstraction.
At first glance, that solves the problem.
Now you can change the code in one place.
This is where the dark side of DRY begins.

# Implicit Vertical Coupling

It turns out that not every difference is incidental.
Some differences are essential.
The path of least resistance here is to parameterise the abstraction and let each caller pass an argument for their use case.
Then, when the next essential difference arises, you have to write the new call site and change the common code in lockstep.
That’s a problem you didn’t have when the code was duplicated.
Over time, the common code grows large branches or becomes overly generic to manage all of its uncommon behaviour.
It is easier to find, but harder to understand than the duplicated code.
Now you are at constant risk of unintended ripple effects.
That’s tech debt too—the thing you were trying to eliminate with DRY.

```
NAIVE DEDUPLICATION: Vertical Coupling

┌─────────┐   ┌─────────┐   ┌─────────┐
│ Site A  │   │ Site B  │   │ Site C  │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     │    flags    │    flags    │
     │             │             │
     └─────────────┼─────────────┘
                   │
                   ▼
           ┌───────────────┐
           │  Abstraction  │
           │┌─────────────┐│
           ││ if flag_a   ││
           ││ if flag_b   ││
           ││ if flag_c   ││
           │└─────────────┘│
           └───────────────┘

Variant changes ripple up and down
```

# DRY Alone Only Rotates Coupling

We have obeyed the *Don't Repeat Yourself* slogan only to transform horizontal coupling into vertical coupling. This presents the following lose-lose tradeoff.

|  | Add invariant | Add variant |
|--|---------------|-------------|
| **Duplication** | Change **N** places, if you can find them all. | Change **1** place |
| **Naive deduplication** | Change **1** place | Change **2** places, but risk rippling into **N** clients. |

# Transforming the Tradeoff with DRY+DI
The problem on each side of the duplication-abstraction tradeoff comes down to displacing code from its natural context.
Duplicated code anchors copies of general behaviour to specific contexts unnecessarily.
Conversely, deduplicated code separates unique behaviours from their origin.
We need to put everything back where it belongs by pulling invariants down into a class, while pushing variants back up to the call site.
You can achieve this by having your class accept behaviour from the callers, not just data.
That generally means passing an instance of another cladarss through the constructor.
This makes both axes of change maintainable.
The technique is called dependency injection and it is fundamental for developing maintainable, object-oriented systems.