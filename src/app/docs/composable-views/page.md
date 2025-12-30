---
title: Composable Views in Vanilla Rails
nextjs:
  metadata:
    title: Composable Views in Rails
    description: Using Only Templates, Partials and PORO Presenters.
---

{% callout title="TL;DR" type="note" hideIcon=true %}
Principled view composition maximises the maintainability of views in Vanilla Rails, while helping you evaluate the value propositions of gems like Draper, Keynote, Phlex and ViewComponents.
{% /callout %}

Views grow in complexity like every other part of a Rails application.
We need to decompose views to manage them, but decomposition along the wrong axes creates **fragmentation** and technical debt.
Instead, we need **factorisation** that splits our views along the axes of page structure, HTML units and model presentation.

![Factorization axes diagram](/images/composable-views/axes.svg)

These fundamentals position you to properly consider technical solutions like Draper, Keynote, Phlex or ViewComponents.

## Action Templates

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

## Naive Decomposition

Let's decompose this page ontologically.
Whatever you can name, extract it into a partial.
This leads to a summary bar and a list of timesheets.

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

= render "summary_bar", timesheets: @timesheets
= render "timesheet_list", timesheets: @timesheets
```

The summary bar extracts wholesale.

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

The timesheet list contains a loop.
The body of the loop extracts again into a `_row` partial.

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

This demonstrates what I call the *partial tunnelling anti-pattern*.
Evolving the page bears this out.

### Chaotic Evolution
Let's try to reuse the timesheets list to show an employee their timesheets.

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  = render "timesheets/timesheet_list", timesheets: @my_timesheets
```

It should be this easy, but when the page loads, we see the approve and reject buttons.
We only want to show that to managers.
Let's try to fix the issue within the current structure.

```
timesheets/index.html.haml (manager view) 
└── _timesheet_list.html.haml
    └── _row.html.haml

dashboard/show.html.haml   (employee view)
└── _timesheet_list.html.haml
    └── _row.html.haml
```

The manager view and employee view both need `_row` to adjust its behaviour, but `_row` is a hidden implementation detail of `_timesheet_list.html.haml`.
This gives us a range of bad options.

We can smuggle data down to `_row` with an instance variable or a page parameter.
We can also drill an argument through the `_timesheet_list`.
The `_timesheet_list` partial won't use the argument, but it's still the least surprising and most portable option, given the structure we have.

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

That was a lot of work to "reuse" a partial, and it's just the beginning.
It turns out that the employee needs to be shown an edit button that the mananger does not.
That's another flag.

The manager's timesheet view is also built for a batch processing workflow.
The manager clicks approve or reject on each timesheet row and the turbo frame update preserves the scroll position.
When the employee clicks the edit button, turbo tries to extract a frame from the response, causing an error.
We have another slew of bad options:
 1. Add `data-turbo-frame="_top"` to edit links (but only for employees)—another flag
 1. Wrap the edit page content in the same turbo frame—couples unrelated pages
 1. Make the turbo frame conditional: if `should_use_turbo_frame`—page concern in partial

The developer repeatedly faces the same fork in the road.
Invest a lot of effort to restructure, or make the situation a bit worse and move on.

## Factorisation

How can we make this workable?
The major problem was that templates could not adjust the behaviour of a nested partial.
We can fix this by making partials `yield` to invert the dependency.

First, let's make `_row` yield so the template can inject context-specific content.

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

  -# Yield instead of hard-coding the form
  - if block_given?
    .actions
      = yield
```

Now `_timesheet_list` can yield too, giving templates full control over row content.

```haml
-# app/views/timesheets/_timesheet_list.html.haml
-# locals: (timesheets:)

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - timesheets.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        -# Yield to let the template inject row actions
        = yield timesheet
```


### Controlled Evolution

Once we `yield`, we can add the timesheets list with an edit button instead of the approve/reject buttons—all with essentially zero friction.
The template now decides what goes into the `_timesheet_list` partial and directly controls the `_row`.
There is no hierarchy, which means no flags and no drilling.

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

= render "timesheets/summary_bar", timesheets: @timesheets

= render "timesheets/timesheet_list", timesheets: @timesheets do |timesheet|
  - if timesheet.submitted?
    = form_with model: timesheet,
                url: manager_timesheet_review_path(timesheet),
                class: "review-form" do |f|
      = f.hidden_field :status
      .actions
        = f.button "Approve", value: "approved", class: "btn-sm btn-success"
        = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

There is still one hiccup when we try to evolve the page.
The turbo frame embedded in `_timesheet_list` still does not belong in the employee view.
We can just not to use it, but this demonstrates that the partial is not portable.
That's because it contains page concerns.
We can push the turbo frame up into the template that needs it and eliminate the `_timesheet_list` partial.


```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets

  -# No turbo frame needed - using partials directly now
  %ul.timesheet-list
    - @my_timesheets.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        - if timesheet.draft?
          = link_to "Edit", edit_timesheet_path(timesheet), class: "btn-sm"
```



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

### Template-Partial Symbiosis
#### Composable Partials

This is the first sense in which we have factorised the view. The partials are now independent, rather than embedded in one another.

This is the second sense in which we have factorised the view.
Page concerns live in the template, while partials are a self-contained unit of presentation.

Together, this gives us independent and composable partials.
The flipside of this is flexible templates. 

Ideally, partials are like a custom HTML element.
They let you factor bulky HTML presentation out your templates.
They `yield` to let the template inject behaviour and decide page-level structure.
They can also take an attribute bag argument to let the template set behaviour-relevant data like attributes used by turbo or stimulus.
Partials should be composable, that means portable and yielding.
You should be able to put them anywhere.

The Rails documentation briefly [discusses](https://guides.rubyonrails.org/layouts_and_rendering.html#understanding-yield) `yield` in the context of layouts.
The documentation does not cover using `yield` in regular partials to invert dependencies and let the caller provide context-specific content.
That seems like a major gap in documentation to me. 


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

Structural branching in partials is a context accumulation smell, but if the structure is not affected by arguments that’s fine if the arguments are simply inputs for derived data that slots into a stable presentation structure.

#### Flexible Templates

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


Consider templates coupled to the controller and non-transferable.

They don't need to be portable, but they need to be independenly changeable.
That's why spreading a template's concern over partials does not help; it's just fragmentation.

Composable partials give templates the flexibility they need.
Templates allow partials a place to push logic.
This is the symbiosis.

 - instance variables
 - forms
 - turbo frame or stream boundaries
 - page parameters
 - data-test-ids
 - iteration logic
 - conditional rendering

data-test-ids are best used to factor out presentational details from testing logic in your templates

Testing against completely static parts of your views is not really a problem, but it’s not much use either.

You don’t want to test against all sorts of presentational rubbish like particular HTML elements

it should test something dynamic. That’s logic and since logic should gravitate toward templates then that’s where data test ids are most useful.

Demonstrate that testing presentation directly is a very high noise data structure, useful as a smoke test at best.

Another case is dynamic test ids that serve to indicate that the right thing is being displayed, e.g. data-test-id=”user-avatar-#{user.id}”

### A Third Factor: Presenters

There remains some duplication of style logic.
Let's add a plain PORO presenter.

```ruby
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

```ruby
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

Once you remove page concerns from your partials and `yield` instead of nesting, you eliminate the interlocking constraints that wreck the evolution of your views.




## ActionView's Architectural Limitations
Notice that (3) puts us back to where we started: logic-heavy partials.
This leaves us making all helpers global or lugging around helper modules and partials everywhere.
That would be hard to manage.
Imagine including three different partials into your template, then having to include three different view helper modules into your controller to make them work.
You still then have the problem of mixins overwriting each other’s methods, which could be likely for truly generic components appearing across pages.
There is just no good way to manage views in vanilla Rails, because nothing owns the view responsibility.
Only classes can own responsibilities.
Modules can provide logic but they can’t own anything because they can’t be instantiated and they have no boundaries.

### Responsibility without Ownership
The fundamental issue with ActionView is that it doesn’t provide a separate abstraction (class) for views.
Models and controllers are classes.
ActionView is mixed into controllers.
The lack of any architectural boundary makes architecture a DIY affair.
All sorts of anti-patterns are very easy in views.
We can approximate boundaries with deliberate principles.
This can get us a good way, though not all the way to maintainable views.
The final piece is testing.
That is always muddy with modules, but natural with classes.

### Template-Level Abstraction

If you pull logic upward toward templates and keep partials pure, you at least have some pure, portable partials.
What of the templates?
There are two problems.
The first is that you are still stuck testing the template’s logic via controllers tests.
The second and larger problem is that if duplication emerges across templates, you’ll need to create a partial and accompanying helpers.
We’re back to where we started: partials full of logic.
Either each partial has a matching helper that you include in your controllers, or you make them all global.
In practice, you’ll get a random mix of ad hoc approaches.
Some people will invent something; others will copy it.
The only constant is that nobody really knows what they are doing.
Rails simply does not offer a good way to manage UI components out of the box.
This is where ViewComponents or Phlex can answer both problems.

Ultimately, once you pull everything into templates and find you need in-depth testing and/or deduplication across pages, then you have no good solution.
You’re either creating global view helpers or lugging modules around to every controller that uses the partials.
Either way, you get no encapsulation and no good approach to testing.

### Global View Helper Soup
If you can concentrate logic in templates, then you can extract it into controller-specific helpers or private methods.
For example, MyBusinessThingController will automatically load MyBusinessThingHelper.
Make sure you have config.action_controller.include_all_helpers = false in config/application.rb.
Otherwise, every helper is loaded everywhere, papering over the lack of boundaries.

Then you have view helpers in MyBusinessThingHelper that keep presentation logic out of the controller and out of views, simplifying both, without polluting the global view context with special purpose helpers.

The discipline now comes in keeping partials as pure as possible.
If they rely on `MyBusinessThingHelper` or instance variables, they will break if used anywhere else.
Even worse, they could work somewhere else, which means another controller has view helpers with the same name and different behaviour.


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

## Architectural Role of Presenters

The problem of queries in views is almost certainly from directly accessing models from views.
Presenters can pull this back and provide testable, scannable methods for fetching data.
Presenters can also return plain data structures or force strictloading on the models they pass into views.
You can have optional preloading methods hanging off presenters to provide a default and have your test scan for N+1s or at least log data access.
It's so much easier to observe data access patterns with a PORO than a controller.
It's still better to let the controller decide the preloading, as it's the high context orchestrator.

Presenters should decouple models from views.
That means being closed, not open delegators and staying in that lane.
They transform data from models.
Having them produce HTML is not much chop.
You want ViewComponents to handle view stuff; they are so much better equipped for that.
I discussed this in Claude somewhere.
Ultimately, presenting models can vary across many views.
These use cases will accumulate forever on models, but can't really be owned by a view either.
Putting them in the model gives testability, but disorganisation, putting them in views colocates them with their use case but ruins testability and discoverability and maintainability.

## Conclusion