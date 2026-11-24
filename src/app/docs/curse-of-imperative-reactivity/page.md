---
title: The Curse of Imperative Reactivity
nextjs:
  metadata:
    title: The Curse of Imperative Reactivity
---

{% callout title="TL;DR" type="note" %}
Every piece of derived data on a screen is an edge in a dependency graph.
Stimulus makes you maintain that graph by hand, inside imperative handlers, and every edge you forget is a stale piece of UI.
That is the curse of imperative reactivity: the graph stays implicit, and once it outgrows your head it becomes a constant source of bugs.
React and Alpine take the graph off your hands, which is why a whole class of bug does not exist there.
{% /callout %}

Stimulus calls itself a modest JavaScript framework for the HTML you already have.
That modesty is the appeal.
You render HTML on the server, attach a controller, and write a few handlers.

The model holds up while each handler touches one thing.
It stops holding up when the screen shows data that is derived from other data.
From that point on you are no longer writing handlers.
You are maintaining a dependency graph that exists nowhere in your code.

## What Stimulus Gives You

A Stimulus controller has three moving parts.
*Targets* are named DOM elements.
*Actions* route DOM events to methods.
*Values* are typed data attributes, and they are the reactive part: change `frequencyValue` and Stimulus calls `frequencyValueChanged()`.

That callback is where the reactivity ends.
Stimulus tells you that something changed.
What should happen next is a method body, and you write it.

Here is a small form.
An employee sets their availability for each day of a pattern.
The pattern repeats weekly or fortnightly, and week two is only shown for a fortnightly pattern.
The Save button is enabled once a visible day differs from what is saved, and a hint counts the changes.

```js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["day", "hint", "submit"]
  static values = { frequency: String }

  connect() {
    this.updateSubmitButton()
  }

  frequencyValueChanged() {
    this.updateDayVisibility()
  }

  dayChanged() {
    this.updateSubmitButton()
  }

  updateDayVisibility() {
    const fortnightly = this.frequencyValue === "fortnightly"

    this.dayTargets
      .filter((day) => day.dataset.week === "2")
      .forEach((day) => day.classList.toggle("hidden", !fortnightly))
  }

  updateSubmitButton() {
    const visible = this.dayTargets.filter((day) => !day.classList.contains("hidden"))
    const changed = visible.filter((day) => day.querySelector("select").value !== day.dataset.saved)

    this.submitTarget.disabled = changed.length === 0
    this.hintTarget.textContent = `${changed.length} of ${visible.length} days changed`
  }
}
```

It reads well, and it is wrong.
Switch to fortnightly, change a day in week two, then switch back to weekly.
The hint still says *1 of 14 days changed*.
The Save button is still enabled, and the only change is on a row you can no longer see.

The fix is one line.

```js
frequencyValueChanged() {
  this.updateDayVisibility()
  this.updateSubmitButton()
}
```

Look at what that line is.
It adds no behaviour.
It is a note to the computer that the hint depends on the frequency.
The dependency was always true.
The code just had not been told.

The order of those two lines matters as well.
`updateSubmitButton` reads the `hidden` class that `updateDayVisibility` writes.
Swap them and the hint is one step behind.
You are now sorting the graph by hand too.

## The Graph You Cannot See

Draw what the form actually computes.

```
RAW                 DERIVED                SCREEN

frequency ────────▶ visible days ────────▶ rows shown
                         │       └──────┐
                         ▼              ▼
day states ───────▶ changed days ─────▶ "1 of 14 days changed"
saved states ─────▶      │
                         └────────────▶ Save enabled
```

Three raw inputs, two derived values, three things on screen.
Every arrow is a fact about the form.
None of the arrows appear in the controller.

What appears instead is the graph turned inside out.
Each place that *writes* an input carries a list of the things that *read* it.
`frequencyValueChanged` is a writer, and its body is a list of readers.
The bug was a reader missing from a writer's list.

This is the root of the curse.
Dependencies are properties of the readers.
The hint knows it needs the visible days.
Imperative reactivity stores each dependency at the writer, which is the one place that has no reason to know.

That inversion sets the cost of every change.

- **Add a derived value** and you must find every writer that affects it, including the ones that affect it through another derived value.
- **Add a writer** and you must know every reader downstream of it.
- **Get the order wrong** and a reader runs before the value it reads has been refreshed.

With *W* writers and *R* readers there are up to *W × R* calls to get right.
Nothing checks them.
A missing call does not throw.
It leaves a label showing yesterday's number until somebody notices.

Stimulus adds a twist of its own.
Much of the state is not in values at all.
It is in the DOM: which radio is checked, what an input holds, whether an element has the `hidden` class.
The example above reads `classList.contains("hidden")` to find out which days are visible.
The DOM is both the output and the database, so a derived value is often derived from another derived value's rendering.

## We Have Been Here Before

Anyone who wrote desktop software in the 2000s knows this shape.
It is the WinForms event handler.

```csharp
private void quantityBox_TextChanged(object sender, EventArgs e)
{
    UpdateLineTotal();
    UpdateOrderTotal();
    UpdateShippingLabel();
    // UpdateDiscountBanner();  ← added last sprint, not called here
}
```

The controls hold the state.
The handlers push changes from one control to the next.
Every form of any size grew a family of `Update…` and `Refresh…` methods, and every handler ended with a recital of them.

You have used the software this produced.
A total that does not change until you tab out of the field.
A button that stays greyed out after you fix the error.
A status bar describing the record you were on a minute ago.
Small pieces of the window going stale, one forgotten call at a time.

Developers coped the same way then as now.
When the recital got too long, they wrote one `RefreshEverything()` and called it from every handler.
That works, and it is worth noticing why.
It gives up on tracking the graph and recomputes all of it.
It is a declarative renderer, written by hand, without the discipline of one.

The industry moved on from this model for a reason.
Data binding, then MVVM, then React and its descendants all make the same move.
They stop asking the programmer to propagate changes.

## A Controller That Went Too Far

The example form is not invented.
It is cut down from a real one I work on: a single availability form that grew a feature at a time over six months.

Today it is two controllers and about 1,100 lines.
The per-day controller alone has 21 targets and 17 values.
A parent controller reaches into each day through outlets.
The days dispatch events back up to the parent.

The private methods tell the story.
There is an `updateState`, an `updateSubtitle`, an `updateToggleLabel`, an `updateStateBar`, and a `refreshSummary` that calls some of the others.
`refreshSummary` is invoked from six different handlers.
Each of those handlers ends with its own recital.

```js
timeChanged() {
  this.#nightTrims = []
  this.#refreshSummary()
  this.#announceNight()
}
```

The latest feature shows where this leads.
A time block that runs past midnight eats into the next day's availability.
So one day's inputs are now an input to its neighbour's display.
In a dependency graph that is one more arrow.
In Stimulus it took:

- an event dispatched from the day to the parent,
- a lookup in the parent to find the neighbouring day's controller,
- a public method on the neighbour to receive the change,
- an undo log, so the neighbour can restore the times it trimmed if the night is later removed,
- six separate places that clear the undo log, because six other handlers invalidate it,
- a replay of every night when a day connects, deferred with `setTimeout` so all the days exist first.

The undo log is the telling part.
It is a cache of derived data, and the six clears are hand-written cache invalidation.
The code is careful and well commented.
It is careful because it has to be.

The bug history reads as you would now expect.
I have paraphrased the commit subjects.

| Bug | Cause |
|-----|-------|
| Day count showed the fortnightly total for a weekly pattern | A handler did not call the update for the count. This is the bug in the example above, and the fix was the same one line. |
| Day headers were not redrawn in some forms | An early return in an update method skipped the redraw when there was no saved state to compare against. |
| Disabling a day reset the state the user had chosen | The disable path ticked the *Unavailable* radio to drive the display. The radio was also the user's answer. |
| A day with no times entered was saved as available all day | A check counted the time rows in the DOM, including rows already marked for deletion. |
| Client-side state was lost when the form reloaded | State that lived only in the controller did not survive a server re-render, so it is now mirrored into hidden fields. |

None of these is a logic error in the usual sense.
In each one the rule was right and some copy of the state had fallen out of step with it.
They are all one bug: a missing, misordered or doubled-up edge.

No one wrote this controller badly.
Each feature added a handful of reasonable lines.
The model made every one of those lines a place where the graph could be wrong.

## React: Derive Everything, Every Time

React's answer is blunt.
Keep the raw state.
Recompute everything else whenever any of it changes.

```jsx
function PatternForm({ savedDays }) {
  const [frequency, setFrequency] = useState("weekly")
  const [days, setDays] = useState(savedDays)

  const visible = days.filter((day) => day.week === 1 || frequency === "fortnightly")
  const changed = visible.filter((day) => day.state !== day.saved)

  const setDayState = (id, state) =>
    setDays(days.map((day) => (day.id === id ? { ...day, state } : day)))

  return (
    <form>
      <FrequencyPicker value={frequency} onChange={setFrequency} />

      {visible.map((day) => (
        <DayRow key={day.id} day={day} onChange={(state) => setDayState(day.id, state)} />
      ))}

      <p>{changed.length} of {visible.length} days changed</p>
      <button disabled={changed.length === 0}>Save</button>
    </form>
  )
}
```

There is no `updateSubmitButton`.
There is no `updateDayVisibility`.
The handlers set raw state and stop.

`visible` and `changed` are ordinary constants.
Their dependencies are written where they belong: at the reader, as the expressions that compute them.
The stale hint cannot be written, because nothing holds an old copy of it.
Order is settled by the order of the statements.

The cost is the one the parenthesis in every React discussion mentions.
React does not know which state a component read, so it re-runs the whole component and its children.
That is overeager.
Large trees need `memo`, `useMemo`, or the compiler to stay fast.

It matters which way each model fails, though.
React fails toward doing too much work and showing the right answer.
Stimulus fails toward doing too little work and showing the wrong one.
A performance problem shows up in a profiler.
A stale label shows up in a support ticket.

React is not immune.
Copy a prop into `useState`, or sync two pieces of state with `useEffect`, and you have rebuilt the handler model inside React, stale data and all.
That supports the argument.
The bugs come back exactly when you leave the declarative path.

## Alpine: The Same Idea, Smaller

React is a large answer to a form with two derived values.
Alpine is a fairer comparison for Stimulus.
It sits in the same niche: server-rendered HTML, a script tag, no build step.

```html
<form x-data="{
  frequency: 'weekly',
  days: [
    { id: 1, week: 1, saved: 'available', state: 'available' },
    { id: 8, week: 2, saved: 'unavailable', state: 'unavailable' },
  ],
  get visible() { return this.days.filter((day) => day.week === 1 || this.frequency === 'fortnightly') },
  get changed() { return this.visible.filter((day) => day.state !== day.saved) },
}">
  <label><input type="radio" value="weekly" x-model="frequency"> Weekly</label>
  <label><input type="radio" value="fortnightly" x-model="frequency"> Fortnightly</label>

  <template x-for="day in visible" :key="day.id">
    <select x-model="day.state">
      <option value="available">Available</option>
      <option value="unavailable">Unavailable</option>
    </select>
  </template>

  <p x-text="`${changed.length} of ${visible.length} days changed`"></p>
  <button :disabled="changed.length === 0">Save</button>
</form>
```

That is the whole form.
There are no handlers at all.
The two getters are the two derived nodes of the graph, and the attributes are its arrows to the screen.
In a Rails view the `days` array would be rendered from the server as JSON.

Alpine also avoids React's cost.
Its state is a reactive proxy, borrowed from Vue.
When `x-text` evaluates its expression, the runtime records which properties were read.
When one of them changes, only that expression runs again.
The graph is discovered by running the code, so it cannot disagree with the code.

| | Who maintains the graph | How it fails |
|--|--|--|
| **WinForms handlers** | You, in every handler | Stale UI |
| **Stimulus** | You, in every handler and callback | Stale UI |
| **React** | Nobody. Everything is re-derived. | Wasted renders |
| **Alpine** | The runtime, by tracking reads | Rarely |

## Where Stimulus Is Right

None of this makes Stimulus a bad tool.
It makes it a tool with a boundary.

A controller that toggles a menu, copies to the clipboard, or autosubmits a form has no derived data.
One event causes one effect.
There is no graph, so there is nothing to keep in sync, and the modest framework is the right amount of framework.

Stimulus also assumes a partner.
The intended source of derived data is the server.
Change an input, let Turbo fetch fresh HTML, and every derived value arrives correct because the server computed all of them from scratch.
That is React's model with a network hop in the middle.
The real form above already does this when the frequency or the dates change.

The network hop sets the grain.
Turbo is good at coarse updates: a new set of rows for a new frequency, a fresh list after a filter, a page section after a save.
It is a poor fit for fine ones: a label that tracks each keystroke, a total that moves as a time is typed, one row reacting to its neighbour.
Each of those would be a request, and each response replaces a whole frame that may hold half-typed input.
Client-side reactivity has no such floor, so it can update any value at any grain.
Turbo is the less flexible tool, and it is the right one when the change is coarse.

This gives a rule for staying inside the boundary.
Make the server render authoritative.
Any state the form can be in, the server must be able to draw, complete and correct, from the submitted fields alone.

The controllers get simpler as a direct result.
A controller no longer has to build the screen for a state.
It only has to move between states the server could have drawn, and it can hand back to the server whenever that gets hard.
Nothing needs initialising on connect, because the HTML arrived right.
Nothing needs mirroring, because the form fields already are the state.

It is also the test of what Stimulus can carry.
A small, local change to HTML that is already correct is the job it was built for.
A controller that must work out what correct means is doing the server's job, with handlers.

The rule is easy to state and hard to hold.
Nothing in Stimulus enforces it.
A controller will accept any state you give it, and it cannot tell you which of that state the server knows about.

The pressure comes from ephemeral data.
An open panel, a half-typed time, a pending undo: all of it is state the server never sees.
For each piece you have to decide whether to put it in a field so the server can redraw it, or to let it die on the next render.
Then you have to remember what you decided, in every handler that touches it.

Holding that line means running a framework in your head.
You emulate the reactive runtime you do not have: what is raw, what is derived, what survives a render, what must be refreshed after which change.

Rails developers know this feeling from another place.
Using partials as design components asks for the same emulation.
A partial has no declared interface, no required arguments, no slots.
You can still build a component library from partials, by keeping the view component in your head and applying its rules by hand.
It works while you are concentrating.

Discipline that lives in the programmer's head is the first thing to go when the form gets its tenth feature or its third author.
A little ephemeral state is fine.
A lot of it is the wrong job for Stimulus, however carefully it is done.

The trouble is the middle ground.
The form wants instant feedback, so the derivation moves to the client.
The client has only handlers, so the derivation becomes a web of update calls.
Then the server re-render wipes the client state, and the state gets mirrored into hidden fields to survive it.
Now there are two renderers and each can be stale relative to the other.

## Knowing When You Have Crossed the Line

A few signs that a controller is carrying a graph.

- It has methods named `update…`, `refresh…` or `sync…`.
- A handler calls more than one of them.
- The order of those calls matters.
- A bug was fixed by adding a call to one of them.
- State is read back out of the DOM: a class, a `checked`, a hidden field.
- Controllers call each other's methods to pass changes along.

One or two of these is normal.
All of them together is a hand-rolled reactive runtime, and it will keep producing stale-data bugs for as long as it grows.

At that point there are three honest options.

**Send the derivation back to the server.**
If the feedback can wait for a round trip, let Turbo re-render and delete the update methods.

**Write the `RefreshEverything()` on purpose.**
Hold all raw state in values.
Give the controller a single idempotent `render()` that derives everything and writes the whole DOM.
Call it from every value callback and nothing else.
This is the declarative model implemented by hand, and it is far better than a web of partial updates.

**Use a reactive library for that component.**
Alpine, or a React island, or anything else that owns the graph.
One form is allowed to need more than a modest framework.

What does not work is the fourth option, which is the default: keep adding handlers and keep fixing the stale label each time one appears.
The handlers are not the problem and neither is the programmer.
The problem is that the dependencies are real, and the code has nowhere to write them down.

That is the curse of imperative reactivity.
The dependency graph exists whether or not you write it down.
Left implicit, it grows with every feature, and each new node adds edges that every existing handler must now respect.
Small graphs fit in your head.
Grown ones do not, and from then on the graph is a steady source of bugs.
Each one is fixed with a single call, and each fix is followed by the next.
