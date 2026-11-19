---
title: Dependencies in the Abstract
nextjs:
  metadata:
    title: Dependencies in the Abstract
    description: A node is anything you can depend on. Fan-in makes it harder to change; fan-out makes it harder not to change. The dual was found by flipping the arrows.
---

{% callout title="TL;DR" type="note" %}
A node is anything you can depend on: a class, a method, a package.
An arrow is a reference plus an invocation.
As more things depend on a node, unwanted ripples become more likely, so the node gets harder to change.
Flip the arrows — a move in the structure, not in the examples — and you get the inverse: harder *not* to change.
Both at once is a god object — hard to change and hard not to change.
Layers look like they attenuate ripples.
That frame is not locked yet.
{% /callout %}

Related: [The Dark Side of DRY](/docs/dark-side-of-dry), [Scalability of Composition](/docs/scalability-of-composition), [The Calculus of Maintainable Software](/docs/calculus-of-maintainable-sw), [Depending on Behaviour versus Depending on Data](/docs/depending-on-behaviour-versus-data).

This is a foundation article, not a Mix-Ins axiom.
The diagrams carry the cases.
The same arrows describe classes, methods, packages, services, teams.

## A node

A dot is a point on which you can depend.

```mermaid
flowchart
  A((A))
```

It might be a class.
It might be a method.
It might be a package, a service, a table, a team.
The shape does not care.
Anything that can be named and referenced is a node.

## An arrow

An arrow is the dependency relationship.

```mermaid
flowchart LR
  A((A))
  B((B))
  A --> B
```

`A → B` means *A depends on B*.
A has a reference to B and invokes it in some way.
That can be one method calling another.
It can be one class calling a method on another class.
Change in B may ripple to A, against the arrow.

## As dependants rise

Start with one thing depended on by one other thing.

```mermaid
flowchart BT
  A((A)) --> B((B))
```

A method depended on by one other method is a little harder to change.
You have one other site to think about.
The ripple has somewhere to go.

Three is already a crowd.

```mermaid
flowchart BT
  X((X)) --> L((L))
  Y((Y)) --> L
  Z((Z)) --> L
```

Now let the number keep rising.

```mermaid
flowchart BT
  A((A)) --> L((L))
  B((B)) --> L
  C((C)) --> L
  D((D)) --> L
  E((E)) --> L
  F((F)) --> L
  G((G)) --> L
```

Twenty-five dependants.
A hundred.
A thousand.
The node is now really hard to change.
It is hard even to understand the consequences.
As the number of dependants rises, the likelihood of unwanted ripple effects rises with it.
A node many others depend on tends to *freeze*: `ApplicationRecord`, a shared kernel, a published API.
A freeze pushes change into an additive form, and into a migration.
You would not make a breaking change to `link_to` in Rails.
You would deprecate it, add `new_link_to`, and allow time for the dependants to move.

## The move

So far the likeness came from the domain.
A node.
An arrow.
More things depending on one node, and that node getting harder to change.
That already looks like a directed graph.

Once the likeness holds, you step into the structure and reason there.
Then you map the result back into the domain.
That is how you find a relationship that was true in the software and not obvious from the examples alone.

## Flip the arrows

The structure lets you reverse every arrow.
What does the domain say then?

```mermaid
flowchart BT
  L((L)) --> A((A))
  L --> B((B))
  L --> C((C))
  L --> D((D))
  L --> E((E))
  L --> F((F))
  L --> G((G))
```

You get the inverse.
There are more pathways *into* that node where a ripple can arrive.
A change in any collaborator can force a change here.
The first shape made something harder to change.
This shape makes something harder *not* to change.
A controller that knows every model.
A facade that talks to everyone.
A test that stubs the world.

Depending on many others is close to having one class with many collaborators, or many concerns left unseparated.
That is equivalent, in form, to a very large object doing many things at once — each of which may change.

The only fan-out worth the attention is fan-out to volatile logic.
Draw an arrow to every piece of the Ruby standard library a class uses, and the graph looks huge.
Fan-out to something stable does no harm.
Elide those arrows.
Push them into the background.
What has the effect is fan-out to volatile logic.
Volatile means likely to change.
Application code you have written yourself is the usual case of that.

## Implicit fan-out

Those arrows are the explicit case.
The same fan-out can live inside the object, with no arrows drawn.
All the code is in the class.
One very large class has several other classes implemented inside it.
The pieces are distinct, and they are probably tangled.
That is internal fan-out: one god object, a large volume of code, harder not to change.

Dependency injection is the remedy.
It makes the dependencies swappable.
The effects are swappable.
One graph splits into many graphs, each with a smaller fan-out.
One object no longer depends on the whole volume.

A dot with five arrows out:

```mermaid
flowchart BT
  L((L)) --> A((A))
  L --> B((B))
  L --> C((C))
  L --> D((D))
  L --> E((E))
```

splits into five dots, one arrow each:

```mermaid
flowchart BT
  L1((L)) --> A((A))
  L2((L)) --> B((B))
  L3((L)) --> C((C))
  L4((L)) --> D((D))
  L5((L)) --> E((E))
```

Dependency injection is what an interface enables.

## Both

Now put both shapes on the same node.

```mermaid
flowchart TB
  A((A)) --> G((G))
  B((B)) --> G
  C((C)) --> G
  D((D)) --> G
  E((E)) --> G
  G --> P((P))
  G --> Q((Q))
  G --> R((R))
  G --> S((S))
  G --> T((T))
```

Depended on by many, and depending on many.
Hard to change, and hard not to change.
Ripples leave, ripples arrive, and the node is always in motion.
That is a god object.
It is a massive antipattern.
That pair is what the structure gave back.
Fan-in and fan-out are the same shape, opposite direction.

| Topology | Role | Tendency |
|---|---|---|
| High fan-in | Depended on by many | Harder to change — freezes |
| High fan-out | Depends on many | Harder *not* to change — volatile |
| Both | Hub | Hard to change *and* hard not to change — a god object |
| Long paths | Layered | Looks like attenuation — frame not locked |

DRY's vertical coupling ([Dark Side of DRY](/docs/dark-side-of-dry)) is a hub: many sites → one abstraction, short paths, ripples both ways.
Scalability's *P* is *degree*; this article is *paths* ([Scalability of Composition](/docs/scalability-of-composition)).
*S* — how wide the coupling is — is not in the dots yet.

## How does software work at all?

If depending on many things makes a node harder *not* to change, how does any real system survive?
A Rails app depends on hundreds of gems.
A service depends on a forest of packages.
Those are not small fan-outs.

The count of arrows is not the whole story.
Something about path length seems to matter.
The frame for that is not yet in hand.

## Insert a layer

The single arrow was one hop.

```mermaid
flowchart BT
  A((A)) --> B((B))
```

A change in B may reach A in one step.
If each hop carries a chance *p* less than one, one hop is about *p*.

Now put something in the middle.

```mermaid
flowchart BT
  A((A)) --> M((M))
  M --> B((B))
```

Two hops look like *p* × *p*.
The middle node is not just indirection.
It looks like attenuation.
It also looks like the start of a probability semiring on the paths.
Whether that is the right structure is still open.

A leaky layer is a short path with a longer name.

## The hop can be an interface

The middle node need not be another concrete.
It can be a thing that exists to be coupled to.
A role.
A published API.
An interface.

You do not insert it only to add a hop.
You insert it so the coupling has somewhere thin to land.
A depends on a few names, not on B.
The surface shrinks.

[Scalability of Composition](/docs/scalability-of-composition) writes load as *D × P × S*.
This article already has *P* as a count of arrows, and a candidate for path length.
It does not yet have *S*.
An interface is the usual name for a small *S*.
The model does not quite answer what coupling is.
It might, if a hop carried a width as well as a chance.

A fat interface is the leaky case again.
The path looks longer.
The surface did not shrink.

## Layers

A real stack repeats the same idea.

```mermaid
flowchart BT
  A((A)) --> B((B))
  B --> C((C))
  C --> D((D))
```

Many edges.
Few short paths from a frozen core to the edge.
A change in the data layer has more hops to cross to reach the UI.
That would drive the chance down if the hop model holds.

It is interesting.
It is not yet the same kind of find as flipping the arrows.

## Where Rails sits

Active Record models are depended on by a lot of code, and they depend on a lot of code.
Depended on by many is a high in-count: fan-in.
Depending on many is a high out-count: fan-out.
A node with both is a god object.
That is what the model is.

That is where Rails leads you.
You start with the MVC model.
For a long time you can do everything inside that box.
Eventually the models take the overload.

They are depended on by many, so fan-in freezes them.
They also do many things, and depend on many, so fan-out keeps them volatile.
Frozen and volatile at once is the hub: hard to change, and hard not to change.
Churn stays high.
Each change costs more, because ripples leave and ripples arrive.
That is what unmaintainable means here.

Piotr Solnica has been describing that turn for years.

[Making ActiveRecord Models Thin](https://solnic.dev/making-activerecord-models-thin/), 1 August 2011: anything more than “a blog written in 15 minutes” will “sooner or later become a huge mess” once domain behaviour is mixed into Active Record.

[TDD and ActiveRecord in Rails](https://solnic.dev/tdd-and-activerecord-in-rails/), 6 January 2014: models are among “the most complex elements in the rails stack” and are “simply hard to test.”
Being able to “quickly build something” does not change that.

[My time with Rails is up](https://solnic.dev/my-time-with-rails-is-up/), 22 May 2016: it is “nice and easy in the beginning,” and then it turns unmaintainable.
The simplicity is “a false sense of simplicity,” because “complexity is being hidden by convenient interfaces.”
Active Record, with “over 200 public methods” plus callbacks and concerns, “will not be able to handle growing complexity.”

[Abstractions and the role of a framework](https://solnic.dev/abstractions-and-the-role-of-a-framework/), 30 May 2016: the long-term risk is “hitting a wall,” because Rails assumes Active Record.

Models are detested, and they are why a true unit test is impossible in Rails.
A plain old Ruby object of your own is a shock to test: it is quick, because it is not full of database calls.

## Map to examples (stub)

- Rails `ApplicationRecord` — high fan-in, frozen.
- A concern included everywhere — high fan-in *and* no layer (D=2); ripples do not attenuate.
- A role interface / DI collaborator — the inserted M; the hop exists so the surface can be small.
- A controller that knows every model — high fan-out, volatile.
- A god class that everyone calls and that knows everyone — both.
- A deep package tree that is still calm — many edges, long paths.

Return to this with one diagram per example.

## Transferable

The same arrows describe classes, packages, services, teams.
Maintainability is a property of the graph's shape.

## Decisions already locked

- Title: Dependencies in the Abstract. Not a Mix-Ins splinter; a foundation piece under the Calculus.
- Arrow: depender → depended-on. Ripple travels the other way.
- A node is anything you can depend on; an arrow is a reference plus an invocation.
- Fan-in: harder to change. Fan-out: harder not to change. Both: a god object.
- The move: build the likeness from the domain; once it holds, reason in the structure; map back.
- Flip the arrows was the first payoff of that move.
- The working name for the structure is a probability semiring over the dependency graph.
- Layers as attenuation is interesting; that frame is not locked.
- A hop can be an interface: a node that exists to be coupled to, so *S* shrinks.
- The graph has *P* and a candidate for path length. *S* and *D* are not represented yet.
- Diagrams do the carrying; examples come after the shapes.
