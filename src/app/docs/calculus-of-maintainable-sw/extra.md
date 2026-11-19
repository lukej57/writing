---
title: The Calculus of Maintainable Software
nextjs:
  metadata:
    title: The Calculus of Maintainable Software
    description: Foundations and principles for building maintainable systems.
---

# Calculus of Maintainable Software

## Introduction

I do not see this kind of technical wisdom staying in the consciousness of future generations of programmers.
It tends to be offloaded into AI context.
It is not something the programmer wants to keep in mind.
It does not change.
Because it is invariant, it is perfect for that context.
Conceptual discussion of this sort is a dying art.
I wanted to document it and move on.

## Naive starting point
- Effects and logic mixed together
- Easy to write for one concrete problem

## The family of problems
- It's never just the one thing
- You learn you need to solve a family of related but slightly different problems: commonality plus lots of differences

## Where the differences come from
- Differences cut along the lines of effects
- The things the software actually does: how it interacts with data, the database, and the real world

## What we fundamentally need to do
- Solve families of problems

## The maintainable way: functional core, imperative shell
- Functional cores tend to be fairly stable
- Variation across the family tends to be in the effects: sending emails, hitting the database
- Stable functional core, volatile effects
- Differentiation separates context-dependent from context-free code — in practice, pure logic and effects
- Integration reunites the pure logic and the effectful code so the program actually runs

## Differentiation and integration
- Differentiating separates the functional core from the imperative shell (the effectful code)
- Integration is the techniques for recombining core and effects so the software runs and does everything it needs
- While staying maintainable for developers, so they maintain velocity as things get more complicated and confusing

## Aside: Exceptions and error handling
- An example of this pattern: exceptions in error handling
- An error usually shows up deep in the stack, where context has degraded and is mostly gone
- The low-level message is cryptic and inscrutable because it arrives without context
- Exceptions throw that error up to a higher-context handler, which can add context and make it understandable
- That also centralizes handling: one high-level handler, instead of handling in low-level code where you often can't, because you can't understand the error
- Exceptions are relevant because algebraic effects are like resumable exceptions
- They are a partial solution to the integration problem, scoped only to error handling
- Side point, worth mentioning even though it isn't really about maintainability: context degradation — high-context and low-context code
- Maps onto functional core, imperative shell: the core tends to be low context, the shell tends to be high context
- The context-dependent bits are what change a lot, which leads to the family of problems

## Approaches, from simple to powerful

- Trade-off from simple and intuitive up to conceptual and powerful
- Conceptual is not intuitive: you have to build an unnatural intuition, and hone your craft to use the technique

- Naive imperative code — effects and logic mixed together, easy to start, breaks down across a family of problems
- Inheritance (and its limits: brittle, variations on a particular role, hard to build an entire system that way) — probably the more limited approach of the ones discussed
  - OO language designers' thesis: inheritance is how you scalably manage code
  - That didn't turn out to be true — it was actually composition
  - That's why dependency injection and composition is not a language feature
  - When you need communication between high-context and low-context code, there's no great way to do it
  - You end up with the fragile base class problem
  - You end up with actually imperative code
  - You can kind of create more children, so you have variations of imperative code
  - As you add those variations, the fragile base class problem is compounded massively by multiple levels of inheritance
- Traits — true traits exist in a language like Rust; Ruby modules are fake traits, really just horizontal inheritance
  - Testability problem: a trait reused everywhere kind of becomes a fragile base class
  - Rust implements traits well
  - The traits paper details the pitfalls of inheritance really well — paper reference is in the mixins versus traits article (`src/app/docs/mix-ins-as-traits/page.md`), not cited here
- Dependency injection / composition — dependency injection is a way of achieving composition
  - Aside: in a functional world you have monads, which are kind of the opposite
  - Monads thread values up to something that will interpret them as effects and execute them — thread data back up for execution
  - Dependency injection threads behavior down for execution within the logic
  - Differentiation creates the need for integration
  - Integration requires extra code to solve the integration problem
  - DI and composition adds that code, then creates new problems of how to manage it: factories, conventions for where factory code lives, or a dependency injection container (which has its own problems)
  - Inheritance, traits, and naive imperative code don't have this integration-cost problem
  - The problem they have: they don't achieve the differentiation all that well
  - Naive imperative code has none of it — extremely brittle, and doesn't really achieve maintainability
  - DI and composition does achieve the differentiation, but introduces these extra costs as well
  - Especially in Rails
  - This distinction is not obvious, and requires quite dedicated thought
  - Broader: approaches to integrating differentiated code fall into a simplicity and power trade-off
  - That trade-off relies on understanding functional core, imperative shell, and translating it into your language — probably an object-oriented context
  - Or functional languages, which aren't perfect either: monad transformers increase the complexity again
  - None of these is perfect. Complexity grows, and the technique gets harder to understand: advanced, nuanced, tricky, boilerplate

### Algebraic effects
- Begin from exceptions: make them resumable, and applicable to general programming rather than only error handling
- Seems like the ultimate approach: returns you to the naive imperative starting point without altering how you think, so you can swap effects later
- That would be revolutionary for maintainability
- Still experimental
- Forefront: Koka (koka-lang), with typed algebraic effects; also OCaml
- Possible example code: the dry-effects Ruby gem (Peter Solnica)
- Overcomes the trade-off between simplicity and power
- Language features let you address maintainability problems very concisely
- DI and composition is verbose and high overhead because languages don't have a feature that directly enables it — it's a composite of lower-level features: argument passing, threading behavior down into logic, or threading values up for interpretation into effects
- Especially bulky because it isn't leveraging bespoke language features
- A truly great, off-the-shelf, production-ready algebraic effects implementation could hit the same maintainability with much less code: concise and simple like naive imperative code, because it is a language feature
- Inheritance and traits don't seem so bad because they are language features

## Where Rails sits
- Rails primarily uses inheritance, and effects and logic are mixed in
- It tries to provide large, comprehensive APIs that at least let you leverage pre-built effects
- You write naive imperative code for the most part, but Rails gets you a lot of mileage out of it
- Once that mileage runs out, you cop the opposite side of the trade-off — a cliff of complexity
- The approaches for maintainability down the track, on a large Rails app, are not obvious
- Developing all your code within the Rails inheritance hierarchy eventually becomes an unacceptable constraint
- You have to break out into POROs to use composition and dependency injection, and you use the Rails framework classes to hang the factory code that dependency injection and composition requires
- Functional core, imperative shell: the Rails framework classes are all shell — effects, and effectful APIs for the logic you write within them
- Part of why it's easy to start: a massive library of effects behind pretty ergonomic APIs
- So you wind up writing the naive imperative approach, and you get its simplicity and initial speed
- You don't escape it fundamentally — you're kind of at top-shelf naive imperative
