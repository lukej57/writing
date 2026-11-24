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

## The argument
- We abstract to emphasise decisions while hiding mechanics
- We discover a family of problems over time
- The design that lasts tolerates shifting more of the mechanics into the foreground, making them tunable as we discover more and more variations of our problem
- The elements most likely to move from mechanics to decisions are effects
- Therefore separation along the functional core, imperative shell principle is the most maintainable: the likely path of change is the cheapest

## Naive starting point
- Effects and logic mixed together
- Easy to write for one concrete problem

## The family of problems
- It's never just the one thing
- You learn you need to solve a family of related but slightly different problems: commonality plus lots of differences
- Every reuse mechanism answers the same two questions: where does the commonality live, and how do the differences get in?
  - Single inheritance: the family is variations of one role. Commonality in the parent; children fill the gaps
  - Trait: the family is unrelated types sharing one capability. Commonality in the trait; differences arrive through the required methods the host supplies
  - Collaborator: the family is the callers of one piece of behaviour. Commonality behind a boundary; differences arrive as arguments and injected dependencies
- Handling the family by accumulation — every difference another branch, or another `include` on the one object — is how the naive code breaks down

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

## Decisions in the foreground, mechanics in the background
- The family of problems restated: the commonality is the mechanics, the differences are the decisions
- Explicitness isn't automatically better
  - It pays off when it exposes a decision someone might get wrong
  - It is noise when it spells out a stable convention
- The distinction is context-sensitivity
  - A mechanic has the same right answer in every context
  - A decision's answer varies, so it should be made by whoever holds the context, usually the caller
  - This is the same cut as differentiation: context-free from context-dependent
- The classification drifts both ways
  - Decisions harden into conventions as contexts converge
  - They resurface as usage grows to cover contexts where the answer differs
  - Each new member of the family is a new context
- Good designs let you promote one decision at a time
  - The failure mode is a cliff, where overriding one detail means owning the whole mechanism
- Ease of partial override trades against isolation
  - Scala's `super` chaining is smooth but coupled
  - Rust's all-or-nothing default methods are isolated but blunt
- Example: a trait is a mechanic with its decisions promoted to required methods
  - `map` in terms of `each` is a mechanic: the same in every host
  - What `each` yields is a decision: only the host knows, so the host writes the glue
  - Background on traits is in the mixins versus traits article (`src/app/docs/mix-ins-as-traits/page.md`)
- The smell test: code that makes a context-dependent choice where the context isn't available
  - It has to either guess or reach outward through globals and skip flags

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
  - Weakness: blind to the effects versus logic distinction
- Traits — true traits exist in a language like Rust; Ruby modules are fake traits, really just horizontal inheritance
  - Testability problem: a trait reused everywhere kind of becomes a fragile base class
  - Rust implements traits well
  - The traits paper details the pitfalls of inheritance really well — paper reference is in the mixins versus traits article (`src/app/docs/mix-ins-as-traits/page.md`), not cited here
  - Weakness: blind to the effects versus logic distinction
- Dependency injection / composition — dependency injection is a way of achieving composition
  - Aside: in a functional world you have monads, which are kind of the opposite
  - Monads thread values up to something that will interpret them as effects and execute them — thread data back up for execution
  - Dependency injection threads behavior down for execution within the logic
  - Differentiation creates the need for integration
  - Integration requires extra code to solve the integration problem
  - DI and composition adds that code, then creates new problems of how to manage it: factories, conventions for where factory code lives, or a dependency injection container (which has its own problems)
  - A container such as Spring abstracts that complexity and helps the codebase scale
  - The abstraction has costs: algorithmic inefficiency, memory problems, and competing schools of thought about how to scale, each with its own trade-offs
  - Inheritance, traits, and naive imperative code don't have this integration-cost problem
  - The problem they have: they don't achieve the differentiation all that well
  - Naive imperative code has none of it — extremely brittle, and doesn't really achieve maintainability
  - DI and composition does achieve the differentiation, but introduces these extra costs as well
  - Especially in Rails
  - DI and composition also lets you implement a separation along the lines of logic and effects
  - Inheritance and traits are essentially oblivious to that distinction
  - That blindness is a weakness of both
  - This distinction is not obvious, and requires quite dedicated thought
  - Broader: approaches to integrating differentiated code fall into a simplicity and power trade-off
  - That trade-off relies on understanding functional core, imperative shell, and translating it into your language — probably an object-oriented context
  - Pure functional languages do draw that distinction, as in Haskell, and there is a cultural understanding of logic versus effects
  - What you take on instead is monad transformers
  - None of these is perfect. Complexity grows, and the technique gets harder to understand: advanced, nuanced, tricky, boilerplate

## The progression

The approaches above, in the order you actually climb them.

- You encounter a problem and start with naive code
- A family of problems: inheritance lets you reuse the code and vary it
- Inheritance does not work that well
- The entire internal implementation is exposed to every child
- That exposure is the fragile base class problem
- Traits can help when you have cross-cutting concerns among classes
- Dependency injection scales further
- It adds interfaces and encapsulation boundaries between units
- Nothing about dependency injection is inherently about separating logic from effects
- Separating logic from effects is a principle you apply within the DI framework
- The full realization is the functional core, imperative shell insight
- Logic is pure and composable; effects are contextual and non-composable
- That step is the maximum in complexity and conceptual weight
- It is quite hard to do
- Each step buys more scale and costs more to hold in your head

- Tension, its own beat
  - The very thing that makes the approach scale is itself a problem
  - That thing is the refined intuition, and the many things to keep in your head

- Payoff: algebraic effects
  - A proper implementation would buy the separation of logic from effects, and the scaling benefits
  - It would take you back to the simplicity of naive code
  - You would no longer have to apply the functional core, imperative shell principle yourself
  - You would no longer have to carry the refined intuition about effects versus logic
  - The language handles the separation for you
  - Compiler-level and runtime-level support for something essentially equivalent to dependency injection and composition
  - A language-level feature, so the solution to that DI and composition complexity stays concise
  - That is the functional core, imperative shell principle: logic separate from effects, with the language doing the separation
  - Another point in their favour: the separation DI and composition can implement, which inheritance and traits never see, without taking on monad transformers

### Algebraic effects
- Begin from exceptions: make them resumable, and applicable to general programming rather than only error handling
- Seems like the ultimate approach: returns you to the naive imperative starting point without altering how you think, so you can swap effects later
- That would be revolutionary for maintainability
- Still experimental
- Forefront: Koka (koka-lang), with typed algebraic effects; also OCaml
- Possible example code: the dry-effects Ruby gem (Peter Solnica)
- React hooks are essentially a limited form of algebraic effects
  - A component performs an effect by calling a hook: state, context, a reducer
  - React is the handler. It resumes the component with the value, or schedules the real side effect
  - The render function stays closer to the logic. The runtime is the shell that supplies the effects
  - Limited, because it is not a language feature. It is a library convention on top of JavaScript
  - The effect is identified by call order, so the rules of hooks forbid the conditionals and loops a real effect system allows
  - The set of effects is closed: React's hooks, not an effect you declare and handle yourself
  - `useEffect` is the escape hatch back into imperative code, not a handled effect
  - Still the evidence that a limited encoding can ship, and that a lot of UI code now separates logic from effects this way

The React team knew about algebraic effects, and they said so when Hooks were proposed. Sebastian Markbåge designed Hooks. The Hooks RFC lists algebraic effects in Multicore OCaml as prior art, among several other sources. On the RFC he wrote that conceptually they are algebraic effects: the engine is a pointer to the current handler, it lives in the React package, and the implementation does not. Dan Abramov later wrote that Markbåge used algebraic effects as a mental model for things inside React, including Hooks and Suspense. JavaScript has no effects, so React keeps a current dispatcher instead. Abramov also noted that if JavaScript had algebraic effects, handling Hooks could be implemented in a pure way. The influence is explicit, and it is one of several. Hooks remain the limited encoding.

- [Hooks RFC, credits and prior art](https://github.com/reactjs/rfcs/blob/main/text/0068-react-hooks.md)
- [Markbåge on the RFC: "Conceptually they're algebraic effects"](https://github.com/reactjs/rfcs/pull/68#issuecomment-433158179)
- [The Multicore OCaml tutorial the RFC cites](https://github.com/ocamllabs/ocaml-effects-tutorial#2-effectful-computations-in-a-pure-setting)
- [Dan Abramov, Making Sense of React Hooks](https://medium.com/@dan_abramov/making-sense-of-react-hooks-fdbde8803889)
- [Dan Abramov, Algebraic Effects for the Rest of Us](https://overreacted.io/algebraic-effects-for-the-rest-of-us/)

Svelte was slated to make React obsolete by making reactivity implicit. The compiler hijacks `let` and `=`, so you never call a hooks API. That broke the hard way. Dependencies are fixed at compile time, so a function boundary hides them, and `let` is only reactive at the top of a component. Svelte 5 reimplemented the explicit call. `$state`, `$derived`, and `$effect` are runes: function-shaped marks the compiler treats as effects. That is React hooks again, a limited algebraic-effects mechanism, arrived at by hitting the wall. The announcement calls the syntax a step back and credits Knockout, signals, and Solid. It does not acknowledge that React had already got this right.

- [Introducing runes](https://svelte.dev/blog/runes)

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
- Rails as the case study for decisions versus mechanics
  - It handles naming and configuration deviations gracefully: `self.table_name =`, `foreign_key:`, one decision promoted at a time
  - Its cliffs are structural
  - It treats the fusion of row, validation, form, and resource as mechanics when it is a context-dependent decision
  - Callbacks, model validations, and `default_scope` give context-free answers to context-dependent questions
  - Should this save send the email? Is this record valid for this form? Does this query want the archived rows?
  - Those are where the family differs, and the differences cut along effects
  - The model cannot know, so it guesses, and callers reach outward: `unscoped`, `validate: false`, `skip_callback`, `Current`
  - Form, service, and query objects are teams manually promoting those hidden decisions
- The approaches for maintainability down the track, on a large Rails app, are not obvious
- Developing all your code within the Rails inheritance hierarchy eventually becomes an unacceptable constraint
- You have to break out into POROs to use composition and dependency injection, and you use the Rails framework classes to hang the factory code that dependency injection and composition requires
- Rails generally has no DI container, unless the project adopts something like the dry-system gem
- Hanami bakes dry-system in as its default container
- In Rails codebases like Tanda, models are where you hang that factory code
- Functional core, imperative shell: the Rails framework classes are all shell — effects, and effectful APIs for the logic you write within them
- Part of why it's easy to start: a massive library of effects behind pretty ergonomic APIs
- So you wind up writing the naive imperative approach, and you get its simplicity and initial speed
- You don't escape it fundamentally — you're kind of at top-shelf naive imperative
