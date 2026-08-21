---
title: Mix-Ins as Traits
nextjs:
  metadata:
    title: Mix-Ins as Traits
    description: TODO
---

{% callout title="TL;DR" type="note" %}
TODO — `include` is mixin inheritance, not composition-over-inheritance. Mixins look compositional because they are flexible; they compose without boundaries, so they do not scale. Use them as traits (capabilities); SI for shallow role variation; collaborators when reuse outgrows a single host. Rails concerns earn their keep when grouping capability-shaped declarations.
{% /callout %}

## Outline (working)

Primary reference: Schärli et al., *Traits: Composable Units of Behaviour* (ECOOP 2003).
Secondary / formal: Ducasse et al., *Traits: A Mechanism for Fine-grained Reuse* (TOPLAS 2006).

---

### Framing notes (not section headings)

**The two papers.** Same research group. ECOOP 2003 is the readable narrative: diagnoses single / multiple / mixin inheritance, introduces traits, reports a Smalltalk-80 collection-hierarchy refactoring in Squeak. TOPLAS 2006 supersedes it — formal model of composition (flattening, conflict resolution, aliasing, exclusion), traits composing into traits, larger validation. Use ECOOP for Part 1 storytelling; pull precise operators and definitions from TOPLAS when needed.

**Smalltalk → Ruby bridge (intro material).** Traits were designed and implemented in Squeak (Smalltalk-80). Keywords on both papers include Smalltalk. Ruby sits in that lineage: single inheritance plus mixin modules, heavily Smalltalk-inspired. The paper's critique of mixin inheritance is therefore a direct critique of the composition model Ruby shipped with. The lead-in is not "Ruby secretly has traits"; it is "Smalltalk researchers diagnosed the reuse problem Ruby inherited, and proposed traits as the fix — we can approximate that discipline with modules."

**"Composition over inheritance" is the wrong slogan for `include`.** Rubyists pile mixins into a class and call it composition because it is more flexible than a single parent. The paper names this *mixin inheritance*: mixins use the ordinary inheritance operator; `include` inserts a module into the ancestor chain (`ancestors`, `is_a?`, `super`). It looks compositional because you can mix many things. It is composition **without boundaries** — no object identity, no private state, full access to the host. That is why it is a far less scalable form of composition than a collaborator. Trait composition in the paper is the disciplined version of the same *inside-the-class* move (small, no state, explicit conflicts). Object composition (DI) is a different move: a second object with a boundary. The slogan people think they are following is the second; the mechanism they are using is the first, without the discipline.

**Coherence vs conflict-at-compose (why mixin users must stay small).** Do not conflate Rust's "one impl of a trait per type" with the paper's "conflicts are errors."

- Rust coherence is a *typeclass* rule: in the whole program there is at most one `impl Trait for Type`, so generic code can pick an impl unambiguously. Orphan rules assign *who* may write that impl (you own the trait or the type). This does not transfer. Ruby has no trait-as-type and no single impl site.
- Squeak's analogue is weaker and more useful to us: the *class definition* is the composition site. Two traits that both provide `asString` do not linearise; they produce an explicit conflict (a marker method) until the class excludes, aliases, or overrides. Same method arriving twice from the *same* trait is not a conflict (flattening / diamond-from-one-origin). Adding a method to a trait used in many classes surfaces as new conflicts at those composition sites — the paper's answer to mixin fragility.
- Ruby has neither. `include` / `prepend` insert into the ancestor chain; later wins; `super` follows that order. Open classes mean a gem can include another mixin into your class in another file. Matz considered `Module#mix` (error on name clash, closer to traits) and shipped `prepend` instead. He has said that if he had known about traits when designing Ruby, he would have chosen them over modules.

So Ruby will not get uniqueness of assignment. The mitigation is surface area: few mixins per class, few methods per mixin, and other rungs of the ladder for internal reuse — so there is little to clobber, and the include list stays a high-signal capability list. The paper's own Smalltalk advice is in the same spirit: design traits around abstractions, not reuse; avoid too-fine-grained traits; prefer classes, use traits to resolve design conflicts.

**The equation (ECOOP §3.3).** `Class = Superclass + State + Traits + Glue`. The Superclass term is deliberate. An earlier technical report wrote `Class = State + Traits + Glue`; the published paper puts inheritance back in and says trait composition *complements rather than subsumes* single inheritance. Inheritance derives one class from another; traits structure reuse *inside* a class. TOPLAS §5.2: they kept SI because (1) inheriting *state* is uncomplicated with one parent, (2) a single `super` is enough to reach an override, (3) flattening lets you ignore traits when reading the class, while still using SI for the incremental difference from the parent, (4) a migration path for existing single-inheritance languages. They even recover partial order, when wanted, by putting T1 on a superclass and T2 on the subclass — composition stays unordered; SI supplies the override. So State + Traits + Glue would describe a class with no parent, or a language that had abandoned implementation inheritance (closer to Rust). The paper's actual claim is that you still want the parent for *role variation*; traits are for the orthogonal capabilities. That is the article's SI thesis, in their words.

**Who owns state, traits, and glue.** The equation is also an *ownership* rule. TOPLAS: glue always lives in the combining entity — the composer is in complete control of plugging the parts together.

| Piece | What it is | Who owns it |
|---|---|---|
| Trait | provided methods; required methods as parameters; no fields | the trait (a mixin, if we are emulating) |
| State | instance variables | the class (or its superclass). Never the trait. |
| Glue | accessors onto that state; methods that satisfy requirements; conflict resolution; wiring traits to each other | the **composer** |

When the composer is a class, the class owns **state and glue**. That is the usual picture: `Enumerable` does not store a collection; the host does; `each` is glue the host writes. When the composer is a composite trait, that trait may supply glue *between subtraits* (TCircle provides `bounds` that TDrawing requires). Requirements it cannot satisfy — especially state accessors — propagate up until a class owns them. Traits never own state; they never own the final glue onto state.

**Composite traits (ECOOP §3.4) — use sparingly.** The paper's reason is *aspects of one capability*, not a folder for includes. `TCircle` splits into geometry and comparison so `TEquality` can also be used by `TColor`. Flattening is the test: subtraits are an implementation detail of the composite; a client of `TCircle` should not need to know about `TMagnitude`. If they do, the structure has leaked (the thing flattening was supposed to prevent).

A recurring "these three always travel together" bundle is a weaker but honest justification — a named capability, not `DefaultUserIncludes`. The paper also says avoid traits that are too fine-grained; prefer classes. In Ruby the caution is sharper: `include` inside a module is another mixin chain, with no flattening browser and no conflict markers. Nest only when the composite is itself a real capability. Do not nest to tidy an include list.

The Rails anti-pattern is delivering all three in the mixin: the concern reads `@user`, `params`, sets ivars, calls `has_many`, implements the behaviour. The concern now dictates the host's internals. The host is no longer the composer. In load terms, S is no longer *k* required names — it is "whatever the concern reached for." Separation of state / trait / glue is how you keep S = k.

`included do` is the awkward Rails-only glue channel: class-level DSL (associations, validations, scopes) that a plain module cannot host. That is still glue, and it is still allowed only when it belongs to **one capability**. It is not a licence for the concern to own instance state or to rummage in `params`.

**Scalability is inverse to coupling.** Coupling has a *mechanism* and a *degree*. Fan-out is only the number of partners — it is not the degree. Every row can say "N", so N cannot be how we rank them.

Degree of coupling (sketch, for the table):

```
load ≈ D × P × S
```

- **D** — directions: 2 if either side can break the other (shared implementation, hooks); 1 if the client depends on a published API and the provider does not know the client
- **P** — partners: how many types share this relationship (the old "fan-out")
- **S** — surface width: how much of each partner is in the contract. Whole implementation / all ivars → large. A role of *k* method names → *k*. Ruby mixins: S is effectively unbounded (the mixin may touch anything on the host)

N is P. Mixins and DI can have the same P; they do not have the same load, because S and D differ. Fan-out is *cheap* when S is small and D is 1. Fan-out is *expensive* when S is "everything" and D is 2.

Why the ceiling is where it is:

| Technique | Mechanism | S (surface) | D | P (partners) | Load |
|---|---|---|---|---|---|
| Mixin inheritance | shared implementation, no boundary | unbounded: whole mixin + whole host | 2 | N unrelated hosts (by design) | 2 · N · (everything) |
| Multiple inheritance | shared implementation, many parents | whole of each parent + state diamond | 2 | N parents × M subclasses | worst when both grow |
| Single inheritance | shared implementation, one parent | whole parent | 2 | N subclasses of *one role* | 2 · N · \|parent\| |
| Traits | flattening; required methods are the contract | k required names (if you keep it so) | 2 | N hosts | 2 · N · k |
| Object composition (DI) | client → public API | k published names | 1 | N clients | N · k |

Same ten partners, different load (slide beat):

| | P | S | D | Load |
|---|---|---|---|---|
| 10 classes include a 40-method concern | 10 | ~40 + host internals | 2 | huge |
| 10 subclasses of one base controller | 10 | \|parent\| | 2 | large, but one role |
| 10 classes include `Enumerable` | 10 | 1 (`each`) | 2 | 20 |
| 10 callers of a one-method command | 10 | 1 (`call`) | 1 | 10 |

That is why "they all have N" was misleading: P=10 is identical; S and D are not. Public interfaces win the ranking because they drop D to 1 *and* let you keep k small. They win *again* when k stays small. A 40-method service object is `N · 40` — still a lot of coupling, just unidirectional.

Ranked by how far they scale (least → most):

| | Technique | Scales to | Breaks when |
|---|---|---|---|
| least | Mixin inheritance | a small capability on a few hosts | many includes, or many methods per mixin |
| | Multiple inheritance | almost never worth it | diamond, named parents, state copied twice |
| | Single inheritance | one level of role variation | the hierarchy deepens, or the parent becomes a junk drawer |
| | Traits | orthogonal capabilities on a class | the required API grows; mixins pretending to be traits |
| most | Object composition (DI) | a system | the interface fattens into a god collaborator |

Caption for slides: this is not a ladder you climb and never return to. Pick the *least* coupling that still fits the job. Mixins look more compositional than SI and rank *below* it because they spend the boundary *and* multiply the children. DI is not always better; it pays once sharing an implementation has become the problem.

**Public interfaces are how DI earns that rank — and they scale again if they stay small.** Same rules apply to a trait's required methods (the interface to the host) and to a collaborator's API. Slide table:

| Principle | Means | Violated when |
|---|---|---|
| Role interface, not header interface (Fowler; ISP) | Depend on a small role (`each`, `call`, `charge`), not the whole class dumped as methods | `UserConcern`, "the Payment class interface" |
| Depend on the role, not the class (DIP) | Inject `auditor`, not `PostgresAuditLog` | constructor takes a concrete type you cannot substitute |
| Tell, don't ask | Send a command; do not pull internals and decide | `if collaborator.status == :open; collaborator.save` |
| Don't reach through (Law of Demeter) | Talk to your collaborator, not its collaborator | `user.account.wallet.credit` |
| Hide what can change (Parnas) | If it isn't in the interface, clients must not need it | mixin reads `@foo`; trait that needs twelve host methods |

The paper already says traits should stay lean and focus on a small set of collaborating features. That *is* ISP inside the class: `Enumerable` requires `each`; `Comparable` requires `<=>`. A fat required set is a header interface wearing a trait costume. Connascence (Page-Jones; Weirich in the Ruby world) is the finer vocabulary if we want it: prefer connascence of name over type over algorithm. Optional, one aside, not a sixth table.

**Roles of the tools (thesis for Parts 1–2).**
- Single inheritance: variations *within a role* — shallow behavioural templating; child fills gaps / overrides hooks. Fragile base class → prefer depth one.
- Traits (emulated): orthogonal *capabilities* added to a host that owns state and glue.
- DI / collaborators: *between* objects, once a piece of behaviour wants its own identity, state, and boundary. Complements inheritance rather than replacing it — SI + traits scale a class; collaborators scale a system. Not always better; the wrong collaborator is as noisy as the wrong mixin. Most scalable form in the ranking *because of the public API* — and more so when that API is a role interface.
- Multiple inheritance: same problem space; Ruby does not offer it; cover lightly as historical attempt, not a destination.


---

**Rubric (spine of Part 1).** Axis is *problems × solutions*, not problems × languages. TOPLAS splits reuse into *decomposition* (can you extract the shared behaviour at all?) and *composition* (when you combine the pieces, who is in control?). Walk the rows with a concrete example each, then show the filled matrix. Last column is **traits + single inheritance**, not traits alone: the paper is explicit that they complement each other (`Class = Superclass + State + Traits + Glue`). Languages are a footnote under the table: which languages shipped which solution.

Legend: `yes` addresses it; `no` fails; `hidden` looks solved because order / naming papered over it; `—` does not arise.

Decomposition — can you extract the shared behaviour?

| Sub-problem | SI | MI | Mixins | Traits + SI |
|---|---|---|---|---|
| Share features across siblings (not inherited from the parent) | no | yes | yes | yes |
| Keep ancestors honest (don't push methods too high) | no | yes | yes | yes |
| Factor a generic wrapper (SyncReadWrite around unknown super) | no | no | yes | yes |

Composition — when you combine, who is in control?

| Sub-problem | SI | MI | Mixins | Traits + SI |
|---|---|---|---|---|
| Diamond of methods (same name, different origin) | — | no | hidden | yes |
| Diamond of state (inherit the field once or twice?) | — | no | — | yes |
| Composer controls the combination (no total order / linearisation) | — | ~ | no | yes |
| Glue stays in the composing class | yes | ~ | no | yes |
| Adding a method does not silently change clients | ~ | no | no | yes |
| Access an override without naming an ancestor | yes | no | ~ | yes |

What we still want SI for (not a failure of SI — a job traits are not for):

| Sub-problem | SI | MI | Mixins | Traits + SI |
|---|---|---|---|---|
| Variation within a role (shallow template; child fills gaps) | yes | ~ | no | yes |
| Reuse unit ≠ instance generator | no | no | yes | yes |

How to read the last column: traits take every composition row; SI keeps `super`, shallow role variation, and a single copy of state. Together they tick the matrix. Mixins get decomposition (that is why they exist) and then fail composition. MI gets sibling sharing and then loses the diamond, wrappers, and named-parent fragility.

Where the solutions landed (under the table, not as columns):

- Single inheritance — the default OO model. Java, C#, Ruby classes, Smalltalk classes.
- Multiple inheritance — C++, Eiffel, Python, CLOS. Ruby does not have it; cover as a solution that was tried, not as a destination.
- Mixin inheritance — Strongtalk, Jam, C++ mixins-via-templates, Ruby `include` / `prepend`. Scala's "traits" belong here (linearisation), despite the name.
- Traits + single inheritance — Squeak 3.9 / Pharo (the paper's implementation). Rust borrowed provided/required methods and unordered composition, then fused them with Haskell typeclasses (`impl Trait for Type`, coherence). Use Rust as an example of the *trait* column where a code snippet helps (`Iterator`, `Ord`); do not add a language axis. Pharo later allowed slots on traits — a retreat from "no state"; not the model.

Worked example of the trait shape (one required method, large provided API): paper `TMagnitude`; Ruby `Comparable` / `Enumerable` as the mixin approximation we actually have; Rust `Ord` / `Iterator` as the same shape in the trait column.

Caveats to keep in the prose, not the cells:
- Mixins "avoid" the diamond by linearising. That is the total-ordering problem, not a solution. Mark `hidden`.
- SI's `~` on silent change is the fragile base class: innocuous if the hierarchy is depth one; lethal if deep. That is why we keep SI and cap its depth.
- Traits still impact clients when you add a method (new conflict). The win is the conflict is *signalled at the direct composer*, who can exclude to restore behaviour, with no ripple of glue mixins.
- Same-origin diamond (one trait arriving via two paths) is not a conflict, because traits have no state. That is the row SI/`—` cannot even see and MI botches.

---

### Part 1 — Theory (the problem of code reuse)

1. **Opening: two roles, two kinds of failure**
   - Classes play two competing roles (paper): *generator of instances* (must be complete) vs *unit of reuse* (should be small, applicable anywhere).
   - That split produces the rubric: decomposition failures (cannot extract) and composition failures (cannot combine without losing control).
   - Show the empty matrix; fill it as the sections proceed.

2. **Single inheritance**
   - Decomposition: cannot share sibling features → duplicate, or pollute the parent ("inappropriate hierarchy"). Cannot factor a generic wrapper.
   - Composition: diamond does not arise; `super` is unambiguous; glue lives in the subclass. Fragile base class if you go deep.
   - Retained job: *variation within a role* — abstract parent as behavioural template; children fill gaps. Depth one.

3. **Multiple inheritance**
   - Decomposition: sibling sharing, yes; generic wrappers, no (`super` / `A::read` bound to a named parent).
   - Composition: diamond of methods *and* of state; accessing an override means naming the ancestor, which tangles the hierarchy into call sites.
   - Cook via Snyder: "Multiple inheritance is good, but there is no good way to do it."

4. **Mixin inheritance**
   - Decomposition: yes, including wrappers (late-bound `super`). This is why mixins exist — and why they *look* like composition.
   - Composition: total order; later silently wins; glue disperses into intermediate classes (`Rectangle + MColor + MBorder`); adding a method to a mixin can clobber another with no alarm.
   - Name it: this is still inheritance. Flexibility without a boundary is not the GoF slogan.

5. **Traits + single inheritance**
   - Definition (ECOOP): provided methods, required methods as parameters, **no state**, host supplies state + glue. Order irrelevant; conflicts explicit. Flattening: composition is structure, not a second semantics.
   - Fill the last column: no state diamond; method diamond is a conflict marker; glue in the composer; aliases instead of named parents; new methods surface as conflicts at the direct client.
   - Equation: `Class = Superclass + State + Traits + Glue` (ECOOP §3.3). Superclass is not leftover: traits do not replace deriving a class from a parent. They replace using the parent (or a mixin chain) as the unit of fine-grained reuse. State lives on the class because traits cannot have it. Glue is the required methods and conflict resolution, also on the class. A class with no interesting parent is the degenerate case Superclass = Object; the interesting case is a shallow template (role variation) plus traits (capabilities).
   - One worked example of the shape (required primitive, provided API). Language snippets are illustrations of the *solution*, not a second axis.

6. **The filled matrix, then where it landed, then the bridge**
   - Traits + SI is the only column that ticks both halves of the *paper* rubric.
   - Then our ranking table: scalability inverse to coupling. Mixins below SI. Traits as disciplined inside-the-class composition. DI at the top, not as "always use this."
   - Under the paper table: which languages shipped which solution. Ruby shipped mixins; Squeak shipped traits; Rust fused traits with typeclasses.
   - Inheritance and object composition complement each other in the same way SI and traits do. SI + traits (or mixins-as-traits) scale a *class* — role variation plus capabilities, glue and state on the host. Past that point, when the reused thing wants its own lifetime, state, and boundary, a collaborator via the constructor is the next complementary mechanism. The papers do not discuss dependency injection; that claim is ours. "Composition" there means trait composition (flattening methods into a class), not object collaboration. Related work mentions *delegation* (object-based inheritance) for *dynamic* component adaptation — different again.
   - DI is not always the better option. It is what you reach for when inheritance has hit its scale limit: God classes, include lists that no longer mean capabilities, behaviour that does not actually need the host's internals. A tiny `Enumerable`-shaped mixin is still the right tool. A second object for "the same role, slightly different" is usually the wrong one.
   - Part 2 is for a language stuck in the mixin column: emulate the *discipline* of traits + SI — small capabilities, explicit required API, refuse the mixin when another rung will do — because the language will not move you out of `hidden` / `no` on the composition rows.

---

### Part 2 — Ruby (emulating traits; the escalation ladder)

1. **What Ruby gives you**
   - Modules + `include` / `prepend` = mixin inheritance. Check `ancestors`. It is a parent, just a more flexible one.
   - The folk claim "composition over inheritance" is a category error: they wanted object composition (a boundary) and reached for method composition without one.
   - Gap vs paper traits: state can leak into modules; conflicts resolved by ancestor order; no first-class exclude/alias; still inheritance → no encapsulation, fragile base class still applies.
   - Gap vs Rust: no coherence, no orphan rules. Assignment of an implementation is "whoever included last, including a gem you do not control."

2. **Dictionary: theory → Ruby** *(hinge off Part 1; a slide of its own)*
   - Primer: where the module sits.

   ```
   include M   ancestors: Class → M → Superclass     class wins over M; M wins over super
   prepend M   ancestors: M → Class → Superclass     M wraps the class; super in M hits the class
   extend  M   eigenclass of the object/class → M    module methods become singleton methods
   ```

   | Paper | Ruby | What it actually is |
   |---|---|---|
   | Use a trait on a class | `include M` | Mixin inheritance. Instance methods of `M` become instance methods of the class. |
   | Generic wrapper (SyncReadWrite, late-bound `super`) | `prepend M` | `M` sits *in front of* the class; `super` in `M` calls the class. The one mixin job the paper said mixins do well. |
   | Metatrait (trait on the class-of-the-class) | `extend M` (or `class << self; include M`) | Methods of `M` become class methods (if you extend a class) or singleton methods (if you extend an object). |
   | Provided methods | `def` in the module | The behaviour the trait adds. |
   | Required methods | `self.foo` calls the module does not define | No language support. Convention + tests against a fake host. |
   | State | instance variables | Must live on the host. Ivars assigned in the module = trait owning state (forbidden). |
   | Glue (accessors, satisfy requirements, resolve conflicts) | methods you write *on the class* | Host owns them. `params[:id]` → `record_id` lives here, not in the module. |
   | Alias / exclude | no real equivalent (`alias_method`, nothing for exclude) | Why Ruby cannot do paper composition. |
   | Flattening | does not exist | You always see the ancestor chain. |
   | Conflict | later `include`/`prepend` wins | Silent. |
   | `super` in a trait | `super` in the module | Next ancestor — maybe another mixin, *not* necessarily the class's superclass. Linearisation. |
   | Namespace of functions (not a trait) | `module_function` / `extend self` | Ladder rung 1. Do not `include` these. |
   | Object composition | `initialize(collaborator)` / `delegate` | Different column of the ranking table. |

3. **Using mixins as traits (when they earn a place)**
   - Discipline: provided methods + required methods (documented / tested); host owns **state and glue**; trait talks to the host only through the required API. Test the trait against a fake host that implements those methods.
   - Glue on the host: accessors, adapters (`params[:id]` → `record_id`), conflict overrides. The mixin must not reach for ivars or `params`.
   - Canonical examples: `Enumerable`, `Comparable`.
   - This is **one row** in the catalog below. Everything else is a different organizing problem.

4. **Catalog: problems of organizing code**
   - Modules got used for every row. Only one row is theirs. Send the rest home so the include list can be a capability list.

   | Problem | Mechanism | `include` a module? |
   |---|---|---|
   | Share pure utilities (formatters, date math, `Utils`) | Namespace + `module_function`; call `Utils.foo(x)` | no |
   | Share behaviour clustered on one argument | A class; that argument in the constructor | no |
   | Variations of one role (controllers of this app, a kind of exporter) | Single inheritance, depth one. `ApplicationController`, `BaseExporter` | no — that's the parent |
   | Reuse that needs its own lifetime or state (notify, charge, generate) | Collaborator + DI; host delegates | no |
   | An operation *on* a record (`Billable`, `Onboardable`) | PORO / form / service that *takes* the model | no |
   | Model file is long (scopes, queries extracted by kind) | Query object, or leave them on the model | no — file length is not a capability |
   | Presentation / formatting | Decorator, presenter, helper function | no |
   | Side effects on save | Host keeps the callback; it calls a job or object | no |
   | Authorization | Policy object (`user` + `record`) | no |
   | "Every controller needs this" (`current_user`, authn) | That's the role — base controller | no |
   | Constants / config | Namespace module, or `Rails.configuration` | no |
   | Class-method utilities (`User.recent`) | Query object, or a dedicated class | no |
   | One capability's Rails DSL (assocs, validations, scopes *for that capability*) | Concern, `included do`, keep it small | yes, as a trait-shaped mixin |
   | Orthogonal capability that needs host internals (`Enumerable` / `Comparable` shape) | Mixin as trait; host owns state + glue | **yes — this is the job** |

   Test: `Thing.new(host).call` → never a trait. Child only fills gaps in a parent → never a mixin. Needs `each`, provides `map` → trait.

5. **Payoff: a short include list**
   - Once the other rows have somewhere to go, a class includes a handful of capabilities. The list is high-signal: `Comparable`, `Taggable`, `Notifiable` as a *real* trait — not `Utils`, `Scopes`, `Callbacks`.
   - That list **scales better as mixins** because you stopped using mixins to scale everything else:
     - **P is small** — few partners in the ancestor chain, so less silent override and less accidental interaction.
     - **S is small** — each trait talks through a tiny required API; the code in the module is pure.
     - **Host owns state and glue** — the mixin cannot dictate ivars or `params`. Changing a trait does not reshuffle host internals; changing host state does not require editing the trait. That is how we *mitigate* the fragile base class problem we cannot eliminate (Ruby mixins are still parents). Purity + a required-method surface is the substitute for a real boundary.
   - Understandability: `ancestors` means "what this object can do," not "every DRY we ever did."

6. **Good / bad examples**
   - Explicit reasoning for each catalog row: which problem, which mechanism, what went wrong when a module was used instead.


---

### Part 3 — Rails architecture and idioms

1. **The problem in the wild**
   - Everything is a concern; God classes by accumulation; include lists that no longer signal capabilities.
   - Often justified as "composition over inheritance." Name the mistake: mixin soup is inheritance without a single parent *or* an object boundary — the least scalable of the three.
   - Point back at the catalog: almost every include was a different organizing problem. The rest of Part 3 is the Rails-shaped rows (concerns, DSL, callbacks).

2. **Dictionary: theory → Rails** *(same hinge, Rails column)*

   | Paper / our terms | Rails | What it actually is |
   |---|---|---|
   | Mixin + a composition-time hook | `ActiveSupport::Concern` | Still mixin inheritance. Adds dependency tracking and a DSL. |
   | Glue run on the composer at composition time | `included do ... end` | `class_eval` on the host when included. Legitimate: `has_many`, `validates`, `scope` for **one** capability. Stolen glue: ivars, `params`, host-shape assumptions. |
   | Same, for wrappers | `prepended do ... end` | Same hook when `prepend` is used. |
   | Metatrait | `class_methods do` / `module ClassMethods` | Concern does `base.extend ClassMethods` (or prepends them if you prepend the concern). |
   | Composite trait | concern that `include`s another concern | Concern inserts dependencies onto the host. Still a mixin chain, not flattening. |
   | Inline mixin | `concerning` | Concern defined inside the class file. Same rules; slightly less fan-out of the *file*, not of the coupling. |

   The important split in `included do`: **class-level DSL** (macros the host would have written) vs **instance internals** (`@foo`, `params`). The first can be glue for a capability. The second is the concern owning state.

3. **Concerns as a Rails-specific mixin**
   - Same shortcomings as any mixin (no encapsulation, full host access, still inheritance).
   - The usual failure: concern ships trait + state + glue. It reads ivars and `params`, so it dictates host shape. Composer is no longer the class; S becomes unbounded.
   - Legitimate niche: co-locating Rails declarations (associations, validations, scopes, callbacks, API methods) that together implement **one capability** — grouping by capability instead of by kind. That `included do` block is glue for *class-level* DSL, still owned conceptually by the capability, not a back door to instance state.
   - Why concerns specifically: `included do` unlocks class-level Rails machinery that a plain module cannot host.

4. **Rules of thumb**
   - Small, atomic, composable; minimal state interaction; host decides state.
   - Prefer base class for same-role variation; prefer collaborator + DI for reusable behaviour with real boundaries; prefer concern/mixin only for trait-shaped capabilities (and for capability-grouped Rails declarations).

5. **Close**
   - Mixins-as-traits is a useful local discipline inside a language that will not grow paper traits.
   - The destination is a short include list of capabilities. That is how modules become understandable and *how they scale at all*: small P, small S, pure trait code, host owns state and glue. Fragile base class is mitigated, not gone.
   - Inheritance (SI + mixins-as-traits) and collaborators complement each other because they sit at different points on the coupling curve. Share an implementation while the coupling is still cheap (shallow SI, tiny trait). Give the reused thing a public API once fan-out or entanglement would dominate. Traits decorate a host; they do not replace a second object, and a second object does not replace a trait.


---

## Rough draft

*(Prose begins here once the outline settles.)*
