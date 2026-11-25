---
title: The Curse of Imperative Reactivity
nextjs:
  metadata:
    title: The Curse of Imperative Reactivity
glossary:
  dependency-graph:
    term: Dependency graph
    definition: The values on a screen drawn as nodes, with an arrow from each value to the values computed from it.
  derived-data:
    term: Derived data
    definition: A value computed from other values, such as a total or a count. Nobody edits it directly.
---

{% callout title="TL;DR" type="note" %}
Every piece of {% term "derived-data" %}derived data{% /term %} on a screen is an edge in a {% term "dependency-graph" %}dependency graph{% /term %}.
Pushing a change along those edges is {% term "mechanic" %}mechanics{% /term %}: the right answer is always the same, so it belongs in the background.
Alpine and React keep it there, and the runtime does it for you.
Stimulus brings it into the foreground, as a {% term "decision" %}decision{% /term %} you make in every handler, over and over, until you get one wrong.
That is the curse of imperative reactivity: it is backwards.
The mechanics of data flow have become a decision you must remember to make, and every one you forget is a stale piece of UI.
{% /callout %}

Stimulus calls itself a modest JavaScript framework for the HTML you already have.
That modesty is the appeal.
You render HTML on the server, attach a controller, and write a few handlers.

A controller has three moving parts.
*Targets* are named DOM elements.
*Actions* route DOM events to methods.
*Values* are typed data attributes, and they are the reactive part: change `frequencyValue` and Stimulus calls `frequencyValueChanged()`.

That callback is where the reactivity ends.
Stimulus tells you that something changed.
What should happen next is a method body, and you write it.

The model holds up while each handler touches one thing.
It stops holding up when the screen shows data that is derived from other data.
From that point on you are no longer just writing handlers.
You are carrying each change through a dependency graph by hand, one call at a time.

## A Simple UI

{% demo src="/demos/curse-of-imperative-reactivity/simple.html" title="The simple UI. Change a day, or switch to fortnightly." height=400 /%}

An employee sets their availability for each day of a pattern.
The pattern repeats weekly or fortnightly, and week two is only shown for a fortnightly pattern.
A hint counts the visible days that differ from what is saved.

Here is what the form computes.

```dataflow
flowchart LR
  frequency(["weekly / fortnightly radio"]) --> visible[visible days]
  state(["availability dropdown"]) ---> changed[changed days]
  saved(["last saved values"]) ---> changed
  visible --> changed
  visible ---> rows["rows shown"]:::screen
  changed --> hint["1 of 7 days changed"]:::screen
  classDef screen stroke-dasharray: 4 3
```

Rounded nodes are raw inputs, boxes are derived values, and dashed boxes are what the screen shows.
Three raw inputs, two derived values, two things on screen.
Every arrow is a fact about the form.
The hint needs the changed days.
The changed days need the visible days.
The visible days need the frequency.

### Stimulus

```js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["day", "hint"]
  static values = { frequency: String }

  connect() {
    this.updateHint()
  }

  frequencyChosen(event) {
    this.frequencyValue = event.target.value
  }

  frequencyValueChanged() {
    this.updateDayVisibility()
    this.updateHint()
  }

  stateChanged() {
    this.updateHint()
  }

  updateDayVisibility() {
    const fortnightly = this.frequencyValue === "fortnightly"

    this.dayTargets
      .filter((day) => day.dataset.week === "2")
      .forEach((day) => day.classList.toggle("hidden", !fortnightly))
  }

  updateHint() {
    const visible = this.dayTargets.filter((day) => !day.classList.contains("hidden"))
    const changed = visible.filter((day) => day.querySelector("select").value !== day.dataset.saved)

    this.hintTarget.textContent = `${changed.length} of ${visible.length} days changed`
  }
}
```

This is the controller behind the form at the top of this section.
It is Stimulus doing what it is good at.
Forty-odd lines and two update methods.
You can hold all of it in your head.

Two details are worth a look before moving on.
The second line of `frequencyValueChanged` adds no behaviour.
It is there because the hint depends on which days are visible.
It is an arrow from the diagram, written as a call.

The order of those two lines matters as well.
`updateHint` reads the `hidden` class that `updateDayVisibility` writes.
Swap them and the hint is one step behind.

Neither detail is a problem at this size.

## A Complex UI

{% demo src="/demos/curse-of-imperative-reactivity/complex.html" title="The complex UI. Switch to weekly, or change the second Sunday's finish, and watch Monday." height=720 /%}

Now a feature.
A day can be *specific times*, with a start and a finish.
A shift that finishes before it starts runs overnight.
A night takes up the start of the next day, so the next day shows a notice and counts from when the night ends.

The form above opens on a fortnightly pattern with a night on the second Sunday.
That night runs into the first Monday, because the pattern wraps.

The graph gains two raw inputs, three derived values and three things on screen.

```dataflow
flowchart LR
  frequency(["weekly / fortnightly radio"]) --> visible[visible days]
  visible ----> rows["rows shown"]:::screen
  state(["availability dropdown"]) -----> fields["time fields shown"]:::screen
  state --> night[night]
  start(["start time field"]) --> night
  finish(["finish time field"]) --> night
  visible --> morning[morning taken]
  night --> morning
  morning ---> busy["Busy until 06:00"]:::screen
  morning --> from[starts from]
  start ---> from
  from --> range["06:00 – 13:00"]:::screen
  state ---> changed[changed days]
  start ---> changed
  finish ---> changed
  saved(["last saved values"]) ---> changed
  visible --> changed
  changed ---> hint["2 of 7 days changed"]:::screen
  classDef screen stroke-dasharray: 4 3
```

Follow one path through it.
`weekly / fortnightly radio → visible days → morning taken → "Busy until"`.
Switching from fortnightly to weekly changes which day comes before Monday, because the pattern wraps a week sooner.
So the frequency radio affects the notice on a day row, three steps away.

### Stimulus

```js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["day", "hint"]
  static values = { frequency: String }

  connect() {
    this.dayTargets.forEach((day) => this.updateTimeFields(day))
    this.updateNights()
    this.updateHint()
  }

  frequencyChosen(event) {
    this.frequencyValue = event.target.value
  }

  frequencyValueChanged() {
    this.updateDayVisibility()
    this.updateNights()
    this.updateHint()
  }

  stateChanged(event) {
    this.updateTimeFields(event.target.closest("[data-pattern-target='day']"))
    this.updateNights()
    this.updateHint()
  }

  timeChanged() {
    this.updateNights()
    this.updateHint()
  }

  updateDayVisibility() {
    const fortnightly = this.frequencyValue === "fortnightly"

    this.dayTargets
      .filter((day) => day.dataset.week === "2")
      .forEach((day) => day.classList.toggle("hidden", !fortnightly))
  }

  updateTimeFields(day) {
    day.querySelector(".times").hidden = this.#state(day) !== "specific_times"
  }

  updateNights() {
    const visible = this.#visibleDays

    visible.forEach((day, index) => {
      const before = visible.at(index - 1)
      const taken = this.#isNight(before) ? this.#finish(before) : ""
      const start = taken > this.#start(day) ? taken : this.#start(day)

      day.querySelector(".busy").hidden = taken === ""
      day.querySelector(".busy").textContent = `Busy until ${taken} from the night before`
      day.querySelector(".range").textContent = `Counts as ${start} – ${this.#finish(day)}`
    })
  }

  updateHint() {
    const visible = this.#visibleDays
    const changed = visible.filter((day) => this.#current(day) !== day.dataset.saved)

    this.hintTarget.textContent = `${changed.length} of ${visible.length} days changed`
  }

  get #visibleDays() {
    return this.dayTargets.filter((day) => !day.classList.contains("hidden"))
  }

  #state(day) {
    return day.querySelector("select").value
  }

  #start(day) {
    return day.querySelector("[name$='[start]']").value
  }

  #finish(day) {
    return day.querySelector("[name$='[finish]']").value
  }

  #isNight(day) {
    return this.#state(day) === "specific_times" && this.#finish(day) < this.#start(day)
  }

  #current(day) {
    return [this.#state(day), this.#start(day), this.#finish(day)].join()
  }
}
```

This version is correct.
It is also the version you arrive at, not the one you write first.

**Staleness is one missing line away.**
Here is the natural first attempt at the feature.
You add the time inputs, write `timeChanged`, and extend `stateChanged`.
You do not touch the frequency handler, because the feature has nothing to do with frequency.

```js
frequencyValueChanged() {
  this.updateDayVisibility()
  this.updateHint()
}
```

Set a fortnightly pattern with a night on the second Sunday.
The first Monday correctly says *Busy until 06:00 from the night before*.
Switch to weekly.
The second week disappears, the first Sunday is now the day before Monday, and it has no night.
Monday still says *Busy until 06:00*.

That is the three-step path from the diagram.
Nothing failed and nothing was logged.
The notice is simply out of date, and it stays that way until someone edits a time.
The fix is one line, `this.updateNights()`, in a method the feature gave you no reason to open.

There are more of these waiting.
Put `updateNights` before `updateDayVisibility` and it reads last frequency's rows.
Leave it out of `connect` and a form that loads with a night draws no notice.
Each one is a single line, and each one passes a quick manual test.

**The handlers are a table you keep by hand.**
Laid out, the controller is this.

| When this changes | visibility | time fields | nights | hint |
|--|:--:|:--:|:--:|:--:|
| **connect** | | ✅ | ✅ | ✅ |
| **frequency** | ✅ | | ✅ | ✅ |
| **state** | | ✅ | ✅ | ✅ |
| **time** | | | ✅ | ✅ |

Eleven ticks.
Each tick is a line that somebody had to know to write.
Each blank is a decision too: somebody had to be sure it was not needed.
Visibility must also be called first in its row, because nights and the hint both read which days are visible.

Yet none of the sixteen cells is a judgement call.
The graph settles every one of them.
You are asked to make sixteen decisions that each have exactly one right answer.

The feature added one row and two columns.
The next feature adds another column, and every existing row must be revisited to decide tick or blank.
The work for a feature grows with the size of the controller it is added to.

**The state lives in the DOM.**
Six private methods at the bottom do nothing but read values back out of elements.
Which days are visible is the `hidden` class.
The current state is whatever the `select` holds.
The DOM is both the output and the database, so a derived value is often derived from another derived value's rendering.

**It gets worse than this.**
The example is cut down from a real form I work on, which grew a feature at a time over six months.
Today it is two controllers and about 1,100 lines.
The per-day controller alone has 21 targets and 17 values.

The example above redraws every day from one controller.
The real form has a controller per day, and it rewrites the next day's start time in its input instead of only displaying it.
So the night took:

- an event dispatched from the day to a parent controller,
- a lookup in the parent to find the neighbouring day's controller,
- a public method on the neighbour to receive the change,
- an undo log, so the neighbour can restore the times it trimmed if the night is later removed,
- six separate places that clear the undo log, because six other handlers invalidate it,
- a replay of every night when a day connects, deferred with `setTimeout` so all the days exist first.

The undo log is a cache of derived data, and the six clears are hand-written cache invalidation.

The bug history reads as you would now expect.
I have paraphrased the commit subjects.

| Bug | Cause |
|-----|-------|
| Day count showed the fortnightly total for a weekly pattern | The frequency handler did not call the update for the count. The fix was one line. |
| Day headers were not redrawn in some forms | An early return in an update method skipped the redraw when there was no saved state to compare against. |
| Disabling a day reset the state the user had chosen | The disable path ticked the *Unavailable* radio to drive the display. The radio was also the user's answer. |
| A day with no times entered was saved as available all day | A check counted the time rows in the DOM, including rows already marked for deletion. |
| Client-side state was lost when the form reloaded | State that lived only in the controller did not survive a server re-render, so it is now mirrored into hidden fields. |

None of these is a logic error in the usual sense.
In each one the rule was right and some copy of the state had fallen out of step with it.
No one wrote this controller badly.
The code is careful and well commented, and it is careful because it has to be.

### React

React's answer is blunt.
Keep the raw state.
Recompute everything else whenever any of it changes.

```jsx
function PatternForm({ savedFrequency, savedDays }) {
  const [frequency, setFrequency] = useState(savedFrequency)
  const [days, setDays] = useState(savedDays)

  const visible = days.filter((day) => day.week === 1 || frequency === "fortnightly")
  const changed = visible.filter((day) =>
    ["state", "start", "finish"].some((field) => day[field] !== day.saved[field])
  )

  const isNight = (day) => day.state === "specific_times" && day.finish < day.start

  const morningTaken = (day) => {
    const before = visible.at(visible.indexOf(day) - 1)
    return isNight(before) ? before.finish : null
  }

  const startsFrom = (day) => {
    const taken = morningTaken(day)
    return taken > day.start ? taken : day.start
  }

  const update = (id, fields) =>
    setDays(days.map((day) => (day.id === id ? { ...day, ...fields } : day)))

  return (
    <form>
      <FrequencyPicker value={frequency} onChange={setFrequency} />

      {visible.map((day) => (
        <DayRow
          key={day.id}
          day={day}
          busyUntil={morningTaken(day)}
          startsFrom={startsFrom(day)}
          onChange={(fields) => update(day.id, fields)}
        />
      ))}

      <p>{changed.length} of {visible.length} days changed</p>
    </form>
  )
}
```

Compare it to the diagram.
`visible`, `changed`, `isNight`, `morningTaken` and `startsFrom` are the five derived values, by name.
They are constants and functions, rebuilt on every render, so none of them can be stale.

React does not work out what changed.
It re-runs the whole component, and its children, whenever any state changes.
That is overeager, and large trees need `memo`, `useMemo` or the compiler to stay fast.
For a form inside a Rails page it also means a build step and a component tree, which is a lot to take on for one screen.

### Alpine

Alpine is the fair comparison for Stimulus.
It sits in the same niche: server-rendered HTML, a script tag, no build step.
It attaches behaviour to markup with attributes, as Stimulus does.
The difference is what those attributes say.

```js
Alpine.data("patternForm", (frequency, days) => ({
  frequency,
  days,

  get visible() {
    return this.days.filter((day) => day.week === 1 || this.frequency === "fortnightly")
  },

  get changed() {
    return this.visible.filter((day) =>
      ["state", "start", "finish"].some((field) => day[field] !== day.saved[field])
    )
  },

  isNight(day) {
    return day.state === "specific_times" && day.finish < day.start
  },

  // The pattern wraps, so the day before the first day is the last day.
  morningTaken(day) {
    const before = this.visible.at(this.visible.indexOf(day) - 1)
    return this.isNight(before) ? before.finish : null
  },

  startsFrom(day) {
    const taken = this.morningTaken(day)
    return taken > day.start ? taken : day.start
  },
}))
```

```erb
<form x-data="patternForm('<%= @pattern.frequency %>', <%= @pattern.days.to_json %>)">
  <label><input type="radio" name="frequency" value="weekly" x-model="frequency"> Weekly</label>
  <label><input type="radio" name="frequency" value="fortnightly" x-model="frequency"> Fortnightly</label>

  <template x-for="day in visible" :key="day.id">
    <fieldset>
      <legend x-text="day.name"></legend>

      <select :name="`days[${day.id}][state]`" x-model="day.state">
        <option value="available">Available</option>
        <option value="specific_times">Specific times</option>
        <option value="unavailable">Unavailable</option>
      </select>

      <div x-show="day.state === 'specific_times'">
        <input type="time" :name="`days[${day.id}][start]`" x-model="day.start">
        <input type="time" :name="`days[${day.id}][finish]`" x-model="day.finish">
        <p x-text="`Counts as ${startsFrom(day)} – ${day.finish}`"></p>
      </div>

      <p x-show="morningTaken(day)" x-text="`Busy until ${morningTaken(day)} from the night before`"></p>
    </fieldset>
  </template>

  <p x-text="`${changed.length} of ${visible.length} days changed`"></p>
</form>
```

That is the whole form, and there are no handlers in it.
It is the code running in the form at the top of this section.
The same five derived values are here, as getters and methods.
The `x-for`, `x-show` and `x-text` attributes are the arrows to the screen.

The stale notice cannot be written here.
There is no handler for the frequency radio, so there is nowhere to forget a call.
`morningTaken` reads `visible`, `visible` reads `frequency`, and the notice follows.
Nobody wrote the three-step case.
It falls out of the getters.

There is no table of ticks, and no order of calls.
There is no undo log either.
`startsFrom` is derived, so the user's own start time is never overwritten and there is nothing to put back.

It is still an ordinary Rails form.
The inputs have names, so it submits the usual `params`.
The server renders the starting state as JSON, so it stays the authority on what was saved.

Where React re-runs everything, Alpine knows what to update, because it watches the code run.
Its state is a reactive proxy, borrowed from Vue.
When an attribute's expression runs, the runtime records every property it reads.
When one of those is written, that expression and only that expression runs again.
The graph is discovered by running the code, so it cannot disagree with the code.

## Stimulus: The Wrong Abstraction for Reactive UI

All three versions implement the same graph.
None of them writes it down.
You will not find the diagram in the Alpine getters or the React component, any more than in the Stimulus controller.
The graph is implicit in all three.

They differ in who has to act on it.

In Alpine and React you say what each value is.
`changed` is the visible days that differ from what was saved.
`visible` is week one, plus week two for a fortnightly pattern.
The runtime works out what to recompute, and when.
That is declarative reactivity.
The data flow is implicit in the good way: it is handled, and you never think about it.

In Stimulus the data flow is the code you write.
`frequencyValueChanged` does not say what anything is.
Its body is a list of what to update, and in what order.
That is imperative reactivity: you are told that something changed, and you issue the updates yourself.
Every handler puts the same question to you again.
What depends on this, and in what order?

That question should never have been yours.
In [The Calculus of Maintainable Software](/docs/calculus-of-maintainable-sw) I separate decisions from mechanics.
A decision has an answer that varies with context, so it belongs in the foreground, made by whoever holds the context.
A mechanic has the same right answer in every context, so it belongs in the background, where nobody can get it wrong.

Data flow is a mechanic.
When an input changes, everything derived from it updates, in dependency order.
There is no form where the right answer is to leave the hint stale.
The decisions in this form are the definitions: what counts as a night, what counts as changed.

Stimulus has this backwards.
The mechanics sit in the foreground of every handler, as a choice you must remember to make.
You make it over and over, and sooner or later you make it wrong.
The definitions, which are the real decisions, end up buried inside update methods, between the DOM reads and the DOM writes.

This is fundamentally what an abstraction does.
It automates the mechanics, and leaves the decisions manual and explicit.
Alpine and React abstract the data flow completely.
You never write it, so what is left to write is declarative: what each value is.
Stimulus abstracts the wiring: finding elements, routing events, noticing that a value changed.
The data flow it leaves manual and imperative, a list of updates in every handler.
That is why it is the wrong abstraction for a reactive UI.

The choice is also put to the wrong place.
Dependencies are properties of the readers.
The notice knows it needs the morning taken.
The frequency handler has no reason to know the notice exists.
Imperative reactivity asks each question at the one place that cannot see the answer.

| | Stimulus | Alpine |
|--|--|--|
| **Simple UI** | 3 handlers, 2 updates, 4 calls | 2 getters |
| **Complex UI** | 4 handlers, 4 updates, 11 calls | 2 getters, 3 methods |
| **Existing code edited for the feature** | Every handler | One getter, because its own meaning changed |
| **What a new derived value costs** | A column, checked against every row | The value |
| **How a mistake shows up** | Stale UI, silently, after one sequence of clicks | A wrong value, every time it is read |

None of this is new.
Anyone who wrote desktop software in the 2000s knows the Stimulus shape.
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

The industry moved on from that model for a reason.
Data binding, then MVVM, then React and its descendants all make the same move.
They stop asking the programmer to propagate changes.

The declarative tools are not free of cost, and it matters which way each one fails.
React fails toward doing too much work and showing the right answer.
Stimulus fails toward doing too little work and showing the wrong one.
A performance problem shows up in a profiler.
A stale label shows up in a support ticket.

They can also be dragged back.
Alpine has `$watch` and `x-effect`, and React has `useEffect`.
Each runs code when a value changes, which is a handler by another name.
Use one to copy a piece of state into another and the stale data returns.
The bugs come back exactly when you leave the declarative path.

| | Who carries a change through the graph | How it fails |
|--|--|--|
| **WinForms handlers** | You, in every handler | Stale UI |
| **Stimulus** | You, in every handler and callback | Stale UI |
| **Alpine** | The runtime, by tracking reads | Rarely, unless you use watchers to copy state |
| **React** | Nobody. Everything is re-derived. | Wasted renders |

## Stimulus, Turbo and SSR

If Stimulus is the wrong abstraction for reactive data flow, the answer inside its own frame is to stop giving it any.
That needs no new library.
Stimulus assumes a partner.
The intended source of derived data is the server.

The handlers, the table of ticks and the undo log are {% term "incidental-complexity" %}incidental complexity{% /term %}.
None of it is the problem the form solves.
Used well, Turbo and server rendering keep it from forming.

So do not fix the client-side graph.
Remove it.
Put the rules in Ruby.

```ruby
class Pattern
  def visible_days = days.select { |day| day.week == 1 || fortnightly? }
  def changed_days = visible_days.select(&:changed?)

  # The pattern wraps, so the day before the first day is the last day.
  def morning_taken(day)
    before = visible_days[visible_days.index(day) - 1]
    before.finish if before.night?
  end

  def starts_from(day) = [morning_taken(day), day.start].compact.max
end
```

Render the whole form from it, inside a Turbo Frame.

```erb
<%= turbo_frame_tag "pattern" do %>
  <%= form_with model: @pattern, data: { controller: "pattern", action: "change->pattern#refresh" } do |form| %>
    <% @pattern.visible_days.each do |day| %>
      <%= render "day", form:, day:, pattern: @pattern %>
    <% end %>

    <p><%= @pattern.changed_days.size %> of <%= @pattern.visible_days.size %> days changed</p>

    <%= form.button "Refresh", formaction: preview_pattern_path, hidden: true,
          data: { pattern_target: "refresh" } %>
  <% end %>
<% end %>
```

```ruby
def preview
  @pattern = Pattern.new(pattern_params)
  render :edit
end
```

The controller is what is left.

```js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["refresh"]

  refresh() {
    this.element.requestSubmit(this.refreshTarget)
  }
}
```

Any change posts the form to `preview`.
The server builds a `Pattern` from the fields, renders the form, and Turbo swaps the frame.
The four handlers, the four update methods and the table of eleven ticks are gone.

It works for the same reason Alpine does.
The Ruby methods are the getters.
`morning_taken` asks for `visible_days`, and `visible_days` asks for the frequency.
Every render derives everything from the raw fields, so nothing can be stale.
The server render is declarative, and Turbo is how it reaches the page.

Front-end developers will recognise the shape.
It is a store and a render function, kept on the server.
There is one source of truth, and the DOM is not it.
Data flows one way: an event becomes a request, the request produces state, the state produces HTML, and Turbo applies it.
Redux draws the same loop, with the request as the action and the template as the view.

Turbo gives three ways to deliver it.
A *frame* replaces one region, as above.
*Streams* update several named regions from one response, for changes that reach outside the frame.
*Morphing* patches the new HTML into the old instead of replacing it, which keeps focus and scroll.

**It rests on one rule.**
The server render must be authoritative.
Any state the form can be in, the server must be able to draw, complete and correct, from the submitted fields alone.

Hold to that and the controllers get simpler.
A controller no longer has to build the screen for a state.
It only has to move between states the server could have drawn, and it can hand back to the server whenever that gets hard.
Nothing needs initialising on connect, because the HTML arrived right.
Nothing needs mirroring, because the form fields already are the state.

That is also the limit of what Stimulus can carry.
A small, local change to HTML that is already correct is the job it was built for: toggle a menu, copy to the clipboard, submit a form.
A controller that must work out what correct means is doing the server's job, with handlers.

**It is coarse.**
The network hop sets the grain.
Turbo is good at a new set of rows for a new frequency, a fresh list after a filter, a page section after a save.
It is a poor fit for a label that tracks each keystroke or a total that moves as a time is typed.
The form above refreshes on `change`, when you leave a field.
Monday's notice updates after you finish typing Sunday's time, not while you type it.
Refreshing on every keystroke would mean a request each time, and morphing softens the swap but not the round trip.
Client-side reactivity has no such floor.

**It takes a substantial mental model.**
The rule is easy to state and hard to keep.
Nothing in Stimulus enforces it.
This is where the comparison with a store stops.
A Redux component can only read from the store.
A controller will accept any state you give it, and it cannot tell you which of that state the server knows about.

The pressure comes from ephemeral data.
An open panel, a half-typed time, a pending undo: all of it is state the server never sees.
For each piece you have to decide whether to put it in a field so the server can redraw it, or to let it die on the next render.
Then you have to remember what you decided, in every handler that touches it.
You also have to choose, for each interaction, between a frame, a stream and a morph, and know what each one does to the state already on the page.

Holding that line means running a framework in your head.
You emulate the reactive runtime you do not have: what is raw, what is derived, what survives a render, what must be refreshed after which change.

Rails developers know this feeling from another place.
Using partials as design components asks for the same emulation.
A partial has no declared interface, no required arguments, no slots.
You can still build a component library from partials, by keeping the view component in your head and applying its rules by hand.
It works while you are concentrating.

Discipline that lives in the programmer's head is the first thing to go when the form gets its tenth feature or its third author.
The real form shows what happens next.
It wants instant feedback, so some derivation moves to the client.
The client has only handlers, so the derivation becomes a web of update calls.
Then the server re-render wipes the client state, and the state gets mirrored into hidden fields to survive it.
Now there are two renderers, and each can be stale relative to the other.

## Conclusion

Every screen with derived data has a dependency graph.
It is implicit in every tool here, and that is not the problem.
The problem is who has to act on it.

Alpine and React treat data flow as mechanics and keep it in the background.
Imperative handlers bring it into the foreground.
WinForms did it with `TextChanged`, and Stimulus does it with actions and value callbacks.
Every handler becomes a decision about what to update and in what order, and the decision has only one right answer.
Each feature adds more of them, and reopens the ones already made.

Small graphs fit in your head, and you answer correctly.
Grown ones do not, and from then on you get stale-data bugs, each fixed with a single call and each followed by the next.
That is the curse of imperative reactivity.
The mechanics of data flow, which are always the same, have been turned into a decision you must remember to make.

An abstraction should automate the mechanics and leave the decisions explicit.
For reactive data flow on the front end, Stimulus does the reverse.
It is the wrong abstraction for that job.

Within the Stimulus model, the answer is to not have a client-side graph.
Make the server render authoritative, let Turbo redraw, and keep controllers to small local changes.
Used that way, Turbo and SSR prevent the incidental complexity.
The network of front-end data dependencies never forms.

That answer has a ceiling.
It is a coarser approach, bounded by the round trip.
It will not stretch to a high-fidelity front end, where values move as the user types and one control reacts to another.
Those values have to be derived on the front end, and derived state on the front end is what Stimulus cannot carry.
A little of it is manageable.
As it grows it inevitably pushes Stimulus beyond its limits, however well the rest is organised.
That work needs declarative reactivity on the client, from Alpine, React or anything else that handles the data flow for you.

It is also harder than it looks.
Organising a front end deliberately, so that Stimulus stays minimal and frames, streams and morphing each do the right job, takes real design effort and a model that lives mostly in your head.
Nothing in the tools holds you to it.

The Turbo and Stimulus model is lightweight.
Whether it is simple is debatable.
