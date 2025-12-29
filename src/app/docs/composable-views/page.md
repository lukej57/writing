---
title: Composable Views in Rails, Using Only Templates, Partials and PORO Presenters.
nextjs:
  metadata:
    title: Composable Views in Rails
    description: Using Only Templates, Partials and PORO Presenters.
---

Views grow in complexity like every other part of a Rails application.
We need to decompose views to manage them, but decomposition along the wrong axes creates **fragmentation** that rapidly devolves into technical debt.
Instead, we need **factorisation** that splits our work into composable partials and flexible templates.
We can achieve this in three steps:
 1. Pull page concerns up into templates,
 1. Push presentational HTML down into partials, and
 1. Extract presentation of model data into POROs.

This covers off the fundamentals to know before considering technical solutions like Draper, Keynote, Phlex or ViewComponents.

# Decomposing A View

Consider an index view for timesheets. 

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

-# === Model collection presentation ===
- total_hours = @timesheets.sum(&:total_hours)
- overtime_hours = @timesheets.sum { |t| [t.total_hours - 40, 0].max }
- pending_count = @timesheets.count(&:submitted?)

.summary-bar
  .stat
    %span.label Total Hours
    %span.value= "%.1f" % total_hours
  .stat
    %span.label Overtime
    %span.value= "%.1f" % overtime_hours
  .stat{ class: pending_count > 0 ? "stat--alert" : nil }
    %span.label Pending Review
    %span.value= pending_count

-# === Turbo Frame (page concern) ===
= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    -# === Iteration logic ===
    - @timesheets.each do |timesheet|
      %li.timesheet-row{ id: dom_id(timesheet) }
        .employee-name= timesheet.employee.name
        .hours= "%.1f hrs" % timesheet.total_hours

        -# === Model presentation ===        
        - status_class = case timesheet.status
          - when "submitted" then "badge--warning"
          - when "approved" then "badge--success"
          - when "rejected" then "badge--danger"
        %span.badge{ class: status_class }= timesheet.status.titleize
        
        -# === Form (page concern) ===
        - if timesheet.submitted?
          = form_with model: timesheet, 
                      url: manager_timesheet_review_path(timesheet),
                      class: "review-form" do |f|
            = f.hidden_field :status
            .actions
              = f.button "Approve", value: "approved", class: "btn-sm btn-success"
              = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

## Structure One: Naive Decomposition

Let's decompose this page ontologically.
Whatever we can name, we extract into a partial.
Since we can see a summary bar and a lists of timesheets, the index action template becomes as follows.

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

= render "summary_bar", timesheets: @timesheets
= render "timesheet_list", timesheets: @timesheets
```

The summary bar is extracted.

```haml
-# app/views/timesheets/_summary_bar.html.haml
-# locals: (timesheets:)

- total_hours = timesheets.sum(&:total_hours)
- overtime_hours = timesheets.sum { |t| [t.total_hours - 40, 0].max }
- pending_count = timesheets.count(&:submitted?)

.summary-bar
  .stat
    %span.label Total Hours
    %span.value= "%.1f" % total_hours
  .stat
    %span.label Overtime
    %span.value= "%.1f" % overtime_hours
  .stat{ class: pending_count > 0 ? "stat--alert" : nil }
    %span.label Pending Review
    %span.value= pending_count
```

The timesheet list has a row that gets a partial too.

```haml
-# app/views/timesheets/_timesheet_list.html.haml
-# locals: (timesheets:)

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - timesheets.each do |timesheet|
      = render "row", timesheet: timesheet
```

```haml
-# app/views/timesheets/_row.html.haml
-# locals: (timesheet:)

%li.timesheet-row{ id: dom_id(timesheet) }
  .employee-name= timesheet.employee.name
  .hours= "%.1f hrs" % timesheet.total_hours
  
  - status_class = case timesheet.status
    - when "submitted" then "badge--warning"
    - when "approved" then "badge--success"
    - when "rejected" then "badge--danger"
  %span.badge{ class: status_class }= timesheet.status.titleize
  
  - if timesheet.submitted?
    = form_with model: timesheet, 
                url: manager_timesheet_review_path(timesheet),
                class: "review-form" do |f|
      = f.hidden_field :status
      .actions
        = f.button "Approve", value: "approved", class: "btn-sm btn-success"
        = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

This decomposition strategy creates what I call the *partial tunnelling anti-pattern*.
Let's try to work with these partials to illustrate the anti-pattern.

Note:
When we do the proper compositional break up, you do the composition in template and you can see at a glance again what's going on, instead of having to do that composition in your head.
It will be easier to understand the structure than the first time around, because dense presentational info will be abstract by partials, but structure remains clear at the top level.

Now let's evolve the page.

### Evolution: Add a timesheets list on Employee Dashboard
Let's try to reuse the timesheets list to show an employee their timesheets.

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  = render "timesheets/timesheet_list", timesheets: @my_timesheets
```

When the page loads, we see the approve and reject buttons.
Darn.
We don't want to show those to employees viewing their own timesheets.

How can we stop the buttons showing?
Here's what our structure looks like now.

```
index.html.haml (manager views) 
└── _timesheet_list.html.haml
    └── _row.html.haml

dashboard.html.haml (employee views)
└── _timesheet_list.html.haml
    └── _row.html.haml
```

The `_timesheet_list` partial is sandwiched between the action templates and the `_row`—all of which now need to communicate.
This gives us a range of bad options.
We can smuggle data down to `_row` with an instance variable or a page parameter.
We can also drill an argument through the `_timesheet_list`.
The `_timesheet_list` partial won't use the argument, but it's still the least surprising and most portable option, given the structure we have.
Let's do the flag.

```haml
-# app/views/timesheets/_timesheet_list.html.haml
-# locals: (timesheets:, show_review_form: true)

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - timesheets.each do |timesheet|
      -# Drill the flag 
      = render "timesheets/row", timesheet: timesheet, show_review_form: show_review_form
```

```haml
-# app/views/timesheets/_row.html.haml
-# Add `show_review_form` flag
-# locals: (timesheet:, show_review_form: true)

...

  -# Conditionally render based on flag
  - if show_review_form && timesheet.submitted?
    = form_with model: timesheet, 
                url: manager_timesheet_review_path(timesheet),
                class: "review-form" do |f|
                ...
```

Now the dashboard can hide the form.

```haml
-# app/views/dashboard/show.html.haml

%section.my-timesheets
  %h2 My Timesheets
  = render "timesheets/list", 
           timesheets: @my_timesheets, 
           show_review_form: false
```

That was a lot of work to "reuse" a partial.
That's just the beginning.
It turns out that the employee needs to be shown an edit button that the mananger does not.
That's another flag.

The manager's timesheet view is also built for a batch processing workflow.
The manager clicks approve or reject on each timesheet row and the frame updates in place, preserving scroll position.
The employee clicks the edit button, but now turbo tries to extract a frame from the response, causing an error.
We have another slew of bad options:
 1. Add `data-turbo-frame="_top"` to edit links (but only for employees)—another flag
 1. Wrap the edit page content in the same turbo frame—couples unrelated pages
 1. Make the turbo frame conditional: if `should_use_turbo_frame`—page concern in partial
 1. Copy the partial and maintain two versions

The last option there is interesting too.
It's the other side of this tradeoff: horizontal coupling.
The partial becomes a union of its clients' concerns, fast devolving into a pile of technical debt. 

## Structure Two: Factorisation

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

-# Summary calculations
- total_hours = @timesheets.sum(&:total_hours)
- overtime_hours = @timesheets.sum { |t| [t.total_hours - 40, 0].max }
- pending_count = @timesheets.count(&:submitted?)

= render "timesheets/summary_bar",
         total_hours: "%.1f" % total_hours,
         overtime_hours: "%.1f" % overtime_hours,
         pending_count: pending_count,
         pending_alert: pending_count > 0

-# Turbo Frame is a page concern — stays in template
= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - @timesheets.each do |timesheet|
      - status_class = case timesheet.status
        - when "submitted" then "badge--warning"
        - when "approved" then "badge--success"
        - when "rejected" then "badge--danger"
      
      = render "timesheets/row", 
               timesheet: timesheet,
               hours: "%.1f hrs" % timesheet.total_hours,
               status_label: timesheet.status.titleize,
               status_class: status_class do
        -# Form is a page concern — stays in template
        - if timesheet.submitted?
          = form_with model: timesheet,
                      url: timesheet_review_path(timesheet),
                      class: "review-form" do |f|
            = f.hidden_field :status
            = f.button "Approve", value: "approved", class: "btn-sm btn-success"
            = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

```haml
-# app/views/timesheets/_row.html.haml
-# locals: (timesheet:, hours:, status_label:, status_class:)

%li.timesheet-row{ id: dom_id(timesheet) }
  .employee-name= timesheet.employee.name
  .hours= hours
  %span.badge{ class: status_class }= status_label
  
  - if block_given?
    .actions
      = yield
```

### Evolution: Add a timesheets list on Employee Dashboard

This time around, we can add the timesheets list with an edit button instead of the approve/reject buttons—all with essentially zero fritction.

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  
  -# No Turbo Frame — employee clicks navigate away
  %ul.timesheet-list
    - @my_timesheets.each do |timesheet|
      - status_class = case timesheet.status
        - when "submitted" then "badge--warning"
        - when "approved" then "badge--success"
        - when "rejected" then "badge--danger"
        - when "draft" then "badge--muted"
      
      = render "timesheets/row",
               timesheet: timesheet,
               hours: "%.1f hrs" % timesheet.total_hours,
               status_label: timesheet.status.titleize,
               status_class: status_class do
        - if timesheet.draft?
          = link_to "Edit", edit_timesheet_path(timesheet), class: "btn-sm"
```

There is some duplication of style logic, but this is where presenters help.
Let's add a plain PORO presenter.

```haml
# app/presenters/timesheet_presenter.rb
class TimesheetPresenter
  def initialize(timesheet)
    @timesheet = timesheet
  end

  delegate :employee, :submitted?, :draft?, to: :@timesheet

  def hours
    "%.1f hrs" % @timesheet.total_hours
  end

  def status_label
    @timesheet.status.titleize
  end

  def status_badge_class
    case @timesheet.status
    when "draft" then "badge--muted"
    when "submitted" then "badge--warning"
    when "approved" then "badge--success"
    when "rejected" then "badge--danger"
    end
  end
end
```

Now the status badge logic can be pulled out of both action templates.

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

- total_hours = @timesheets.sum(&:total_hours)
- overtime_hours = @timesheets.sum { |t| [t.total_hours - 40, 0].max }
- pending_count = @timesheets.count(&:submitted?)

= render "timesheets/summary_bar",
         total_hours: "%.1f" % total_hours,
         overtime_hours: "%.1f" % overtime_hours,
         pending_count: pending_count,
         pending_alert: pending_count > 0

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - @timesheets.each do |timesheet|
      - presenter = TimesheetPresenter.new(timesheet)
      
      = render "timesheets/row", timesheet: presenter do
        - if presenter.submitted?
          = form_with model: timesheet,
                      url: timesheet_review_path(timesheet),
                      class: "review-form" do |f|
            = f.hidden_field :status
            = f.button "Approve", value: "approved", class: "btn-sm btn-success"
            = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  
  %ul.timesheet-list
    - @my_timesheets.each do |timesheet|
      - presenter = TimesheetPresenter.new(timesheet)
      
      = render "timesheets/row", timesheet: presenter do
        - if presenter.draft?
          = link_to "Edit", edit_timesheet_path(timesheet), class: "btn-sm"
```

```haml
-# app/views/timesheets/_row.html.haml
-# locals: (timesheet:)

%li.timesheet-row{ id: dom_id(timesheet) }
  .employee-name= timesheet.employee.name
  .hours= timesheet.hours
  %span.badge{ class: timesheet.status_badge_class }= timesheet.status_label
  
  - if block_given?
    .actions
      = yield
```

Notice we still have inline logic for the summary bar.

```haml
# app/presenters/timesheet_collection_presenter.rb
class TimesheetCollectionPresenter
  OVERTIME_THRESHOLD = 40

  def initialize(timesheets)
    @timesheets = timesheets
  end

  # Summary stats

  def total_hours
    "%.1f" % @timesheets.sum(&:total_hours)
  end

  def overtime_hours
    "%.1f" % @timesheets.sum { |t| [t.total_hours - OVERTIME_THRESHOLD, 0].max }
  end

  def pending_count
    @timesheets.count(&:submitted?)
  end

  def pending_alert?
    pending_count > 0
  end

  def each
    @timesheets.each { |t| yield TimesheetPresenter.new(t) }
  end
end
```

```haml
-# app/views/timesheets/index.html.haml

- presenter = TimesheetCollectionPresenter.new(@timesheets)

%h1 Timesheets for Review

= render "timesheets/summary_bar",
         total_hours: presenter.total_hours,
         overtime_hours: presenter.overtime_hours,
         pending_count: presenter.pending_count,
         pending_alert: presenter.pending_alert?

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - presenter.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        - if timesheet.submitted?
          = form_with model: timesheet.model,
                      url: timesheet_review_path(timesheet.model),
                      class: "review-form" do |f|
            = f.hidden_field :status
            = f.button "Approve", value: "approved", class: "btn-sm btn-success"
            = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

```haml
-# app/views/dashboard/show.html.haml

- presenter = TimesheetCollectionPresenter.new(@my_timesheets)

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  
  %ul.timesheet-list
    - presenter.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        - if timesheet.draft?
          = link_to "Edit", edit_timesheet_path(timesheet.model), class: "btn-sm"
```


Let's stress test the factored approach again.

Payroll needs a read-only preview: same row presentation, no actions, plus a "will be paid" indicator.

The indicator is derived data — "approved means will be paid." That belongs in the presenter:

```haml
# app/presenters/timesheet_presenter.rb
class TimesheetPresenter
  # ... existing methods ...

  def will_be_paid?
    @timesheet.approved?
  end
end
```

```haml
-# app/views/payroll/preview.html.haml

- presenter = TimesheetCollectionPresenter.new(@timesheets)

%h1 Payroll Export Preview

%ul.timesheet-list
  - presenter.each do |timesheet|
    = render "timesheets/row", timesheet: timesheet do
      - if timesheet.will_be_paid?
        %span.payment-indicator ✓ Will be paid
```

This required **no partial changes**.
We know from experience the fragmented structure would have made us pay dearly for this.
Thanks to `yield`, the third action template just injects its differences.

, but they are rendered by `_row`, nested within `_timesheet_list`.
Since the structure is already here, the easiest thing to do is drill a flag into the row partial.

The summary bar can be reused, but if it's logic is in a controller helper, it's stuck in that controller.
You'd have to use a global helper to make it portable.
Since it's model bound logic, a presenter can save the day, but if it were view-owned logic, that's a fundamental limitation of vanilla Rails.

Sacrificial anode. Corrosion cannot be prevented, but it can be controlled. The anode concentrates the corrosion and instead of fatal, system-wide corrosion you get concentrated corrosion on a replaceable part.

In the greenfield window if you decompose views into partials too early, you can derail the evolution of a page. If you embed page concerns into a partial then reuse it in another page, that page will require an argument or flag to adjust the partial to its use case. This bloats partials, obscures page structure and makes views harder to maintain.

Anti-pattern: Static nesting of partials. Solution: yield by default, slots via locals for special cases.

There is a distinction to make between shared and non-shared partials. New and edit actions tend to be very similar, but the same anti-pattern emerges with the same solution.

Partials are core. The purer the better. This is quite hard to do. Sometimes a cancel button needs to call history.back() if it’s in a model, or be a direct link if it is rendered on a new page. Factoring out every page-level concern can be hard to spot.

The form_fields partials are somewhat halfway between a page and generic partial.

Should HTTP params be used to drill down into partials? Params are very much a page concern. They are passed to a route.

Action templates are shell. They are coupled to a controller endpoint and you should concentrate logic and instance variables in the template. You can use controller helpers for locally scoped logic.

When you put logic in partials you rely too much on global view helpers, polluting a global namespaces with highly specific logic.

There will be remaining cases of components that are generic and logic heavy. Rails offers no good way to deal with that. That is the problem solved by ViewComponents.

# React-like Composition with `yield`

The Rails documentation briefly [discusses](https://guides.rubyonrails.org/layouts_and_rendering.html#understanding-yield) `yield` in the context of layouts.
The documentation does not cover using `yield` in regular partials to invert dependencues and let the caller provide context-specific content.
That seems like a major gap in documentation to me. 

Use yield to get React-like composition. This allows you to pull all the partials back into the template. That allows logic in the template to affect even deeply nested partials without drilling locals or filling partials with logic directly. When you embed page-level concerns into partials, they become magnets for more and more logic and they need more and more global view helpers.

```haml
-# app/views/timesheets/index.html.haml

- presenter = TimesheetCollectionPresenter.new(@timesheets)

= render "card", title: "Timesheets for Review" do
  = render "data_table", headers: ["Employee", "Hours", "Status", "Actions"] do
    - presenter.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        -# Three partials deep, but we have full access to:
        -# - @current_user (controller instance variable)
        -# - policy() (Pundit helper)
        -# - timesheet (from presenter.each)
        -# - All route helpers

        - if timesheet.submitted? && policy(timesheet.model).approve?
          = form_with model: timesheet.model,
                      url: timesheet_review_path(timesheet.model),
                      class: "inline-actions" do |f|
            = f.hidden_field :status
            = f.button "Approve", value: "approved", class: "btn-sm btn-success"
            = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

# Page Concerns
 - instance variables
 - forms
 - turbo frame or stream boundaries
 - page parameters
 - data-test-ids
 - iteration logic
 - conditional rendering

# Partial Concerns
 - HTML and attributes (attribute bag pattern)
 - Derived, non-structural data
 - `yield` or slots

Also you don't necessarily need to create a partial to deduplicate.
You can create capture blocks.

Compare static hierarchical structure that template cannot control to dynamic siblings composed by the template. 

# Summary
Process

Pull logic into page template

Extract shallow hierarchy of pure presentation partials

Repeating patterns among pages are components a la ViewComponents

Notice that (3) puts us back to where we started: logic-heavy partials. This leaves us making all helpers global or lugging around helper modules and partials everywhere. That would be hard to manage. Imagine including three different partials into your template, then having to include three different view helper modules into your controller to make them work. You still then have the problem of mixins overwriting each other’s methods, which could be likely for truly generic components appearing across pages. There is just no good way to manage views in vanilla Rails, because nothing owns the view responsibility. Only classes can own responsibilities. Modules can provide logic but they can’t own anything because they can’t be instantiated and they have no boundaries.

Purity looks different for views. For example, referential transparency is obviously a property of dumb partials that makes them composable. However, the idea that turbo frames are effects is less obvious. What really are the page concerns that make up the imperative shell in this pattern?

Notes

data-test-ids are best used to factor out presentational details from testing logic in your templates

Testing against completely static parts of your views is not really a problem, but it’s not much use either.

You don’t want to test against all sorts of presentational rubbish like particular HTML elements

it should test something dynamic. That’s logic and since logic should gravitate toward templates then that’s where data test ids are most useful.

Demonstrate that testing presentation directly is a very high noise data structure, useful as a smoke test at best.

Another case is dynamic test ids that serve to indicate that the right thing is being displayed, e.g. data-test-id=”user-avatar-#{user.id}”

Views are really noisy.

Don't stack HTML elements to spread classes. Just push classes into as few divs as possible.

If you pull logic upward toward templates and keep partials pure, you at least have some pure, portable partials. What of the templates? There are two problems. The first is that you are still stuck testing the template’s logic via controllers tests. The second and larger problem is that if duplication emerges across templates, you’ll need to create a partial and accompanying helpers. We’re back to where we started: partials full of logic. Either each partial has a matching helper that you include in your controllers, or you make them all global. In practice, you’ll get a random mix of ad hoc approaches. Some people will invent something; others will copy it. The only constant is that nobody really knows what they are doing. Rails simply does not offer a good way to manage UI components out of the box. This is where ViewComponents or Phlex can answer both problems.

Structural branching in partials is a context accumulation smell, but if the structure is not affected by arguments that’s fine if the arguments are simply inputs for derived data that slots into a stable presentation structure.

Dynamic Form Composition with Turbo and Form Objects

Analyse the Rails architecture of form composition. It works by passing a form object down, but I think using FCIS you can keep the form object in the action template and keep it out of partials. I think tunnelling the form object into partials is another manifestation of the partial tunnelling anti-pattern.

I think it’s just better to use morphing and pass the form object to partials on the backend, but again use yield composition, not direct nesting.

Approximating Architectural Boundaries without ViewComponents

the fundamental issue with ActionView is that is doesn’t provide a separate abstraction (class) for views. Models and controllers are classes, but ActionView is mixed into controllers. The lack of any architectural boundary makes architecture a DYI affair—all sorts of anti-patterns are very easy in views. We can approximate boundaries with deliberate principles. This can get us a good way, though not all the way to maintainable views. The final piece is testing and that is always muddy with modules, but natural with classes.

Consider templates coupled to the controller and non-transferable.

If you can concentrate logic in templates, then you can extract it into controller-specific helpers or private methods. For example MyBusinessThingController will automatically load MyBusinessThingHelper. Make sure you have config.action_controller.include_all_helpers = false in config/application.rb, otherwise every helper is loaded everywhere, papering over the lack of boundaries.

Then you have view helpers in MyBusinessThingHelper that keep presentation logic out of the controller and out of views, simplifying both, without polluting the global view context with special purpose helpers.

The discipline now comes in keeping partials as pure as possible. If they rely on `MyBusinessThingHelper or instance variables, they will break if used anywhere else. Even worse, they could work somewhere else, which means another controller has view helpers with the same name and different behaviour.

There is a more subtle dependency you can introduce into even very pure partials which is handling context-specific use cases via flags and arguments instead of a yield slot. That’s how you end with a partial that has the use cases of different templates embedded into and switched between via flag arguments. Partials have big branches embedded in them which confuse their purpose and make them had to maintain.

Ultimately once you pull everything into templates and find you need in depth testing and/or deduplication across pages, then you have no good solution. You’re either creating global view helpers or lugging modules around to every controller that uses the partials, either way gives you no encapsulation and no good approach to testing.

Using ViewComponents

Only a class can really own something. Views are modules in rails and that is just a mistake, making them hard to test and giving them no boundaries.

Convert the above example to ViewComponents.

Since ViewComponents offer a way to co-locate and encapsulate logic and presentation—and test it—it makes composition much more scalable. You can really build up components from other components much more easily, while keeping the logic manageable.

You can also do nice helper patterns like those seen in the primer design system view components themselves.

render(Primer::Beta::ButtonGroup.new(size: size)) do |component|
  component.with_button { "Button 1" }
  component.with_button { "Button 2" }
  component.with_button { "Button 3" }
end

Page Concerns

Page concerns are what the page owns:

layout, e.g. turbo frames

params

Forms (can’t nest, cannot compose, though form fields can compose). Forms submit to an endpoint, they belong to a template.

controller instance variables

structural logic

if this then show that, else show something else

Iterations over collections to render

Logic heavy enough to require view helpers (which should be controller-scoped, not global)

Including partials

Note this is a page concern. Partials should not be including other partials wherever possible.

Demonstrate how partials that yields can have logic and values injected via yield and avoid drilling that way. You could demonstrate argument drilling, structural branching, instance variable and view helper side channels, then finally composition via yield.

Partial concerns

presentation

locals only

non-structural logic

e.g. given a piece of data, compute derived data that slots into a static structure, not data that changes the structure (like if this then render that, else render some other thing)

yielding to invert dependency on contextual information

yield instead of nesting more partials

This keeps the partial hierarchy flat and wide, which means composable.

Deep nesting of partials without yield means that partials end up accessing page-owned data through side channels like instance variables and page params, or accumulating context via arguments and structural branches.

Repeating presentation doesn’t necessarily demand another partial. You can use capture blocks for local repetition and to help keep the hierarchy shallow. Grow out not down.

Presenters

The problem of queries in views is almost certainly from directly accessing models from views. Presenters can pull this back and provide testable, scannable methods for fetching data. Presenters can also return plain data structures or force strictloading on the models they pass into views. You can have optional preloading methods hanging off presenters to provide a default and have your test scan for N+1s or at least log data access. It's so much easier to observe data access patterns with a PORO than a controller.