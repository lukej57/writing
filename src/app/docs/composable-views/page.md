---
title: Composable Views in Vanilla Rails
nextjs:
  metadata:
    title: Composable Views in Rails
    description: Using Only Templates, Partials and PORO Presenters.
---

{% callout title="TL;DR" type="note" %}
Principled composition maximises view maintainability in vanilla Rails.
It also reveals the limitations of ActionView, contextualising gems like Draper, Keynote, Phlex and ViewComponents.
{% /callout %}

Ever growing views must be decomposed into manageable units.
Decomposition along the wrong axes creates **fragmentation** and technical debt.
Rails applications need **factorisation** that splits views along the axes of page structure, HTML blocks and derived model data.

![Factorization axes diagram](/images/composable-views/axes.svg)

## An Example View 

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

## Fragmentation

Let's decompose this page *ontologically*.
Whatever you can name, extract it into a partial.
This gives us a summary bar and a list of timesheets.

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

= render "summary_bar", timesheets: @timesheets
= render "timesheet_list", timesheets: @timesheets
```

The timesheet list contains a loop, which is a kind of repetition.
Extract the loop's body into a `_row` partial.

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

This is easy to create, but hard to maintain.
It's what I call the *partial tunnelling anti-pattern*.
The first problem is that future developers must dig through four files and mentally compose them to understand the page.
The second problem is the way that pages like this evolve.

### Chaotic Evolution
Let's try to reuse the timesheets list to show an employee their timesheets on the new page below.

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  = render "timesheets/timesheet_list", timesheets: @my_timesheets
```

When the page loads, we see approve and reject buttons, but they are for managers only.
Two different pages need to adjust the behaviour of `_row`.
All the options are bad at this point, because `_row` is a hidden implementation detail of `_timesheet_list.html.haml`.


```
timesheets/index.html.haml (manager view) 
└── _timesheet_list.html.haml
    └── _row.html.haml

dashboard/show.html.haml   (employee view)
└── _timesheet_list.html.haml
    └── _row.html.haml
```

We can smuggle data down to `_row` with an instance variable or a page parameter.
We can also drill an argument through the `_timesheet_list`.
The `_timesheet_list` partial won't use the argument, but it's still the least surprising and most portable option, given the structure we have.
Let's add the flag.

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
It's also just the beginning.
Suppose we realise that the employee needs to be shown an edit button, but not the manager.
That's another flag.

The manager's timesheet view is also built for a batch processing workflow.
When the manager clicks *approve*, then turbo updates the frame, preserving the scroll position.
When the employee clicks *edit*, then turbo tries to extract a frame from the response, causing an error.
We have anoter problem with more bad solutions:
 1. Add a flag for the `data-turbo-frame="_top"` attribute on the edit link, or for the turbo frame itself, or
 1. Wrap the edit page content in a matching turbo frame, coupling unrelated endpoints.

The developer repeatedly faces the same fork in the road.
Invest a lot of effort to restructure, or make the situation a bit worse and move on.

## Factorisation

The major problem with fragmentation is that templates cannot  adjust the behaviour of nested partials.
We can fix this by making partials `yield` to invert the dependency.

Let's add `yield` to the `_row` and `_timesheet_list` partials to see the effect.

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

Now we can make all of the same changes with essentially zero friction.
The template now decides what goes into the `_timesheet_list` partial and directly controls the `_row`.
There is no hierarchy, which means no flags and no drilling.

Let's rebuild the manager's timesheet index view.

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

= render "timesheets/summary_bar", timesheets: @timesheets

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - @timesheets.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        - if timesheet.submitted?
          = form_with model: timesheet,
                      url: manager_timesheet_review_path(timesheet),
                      class: "review-form" do |f|
            = f.hidden_field :status
            .actions
              = f.button "Approve", value: "approved", class: "btn-sm btn-success"
              = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

Now let's build the employee's timesheet view.

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

The change became simple. That's what we want.

The only hiccup was that we did not actually use the `_timesheet_list` partial.
That's because `_timesheet_list` really contains nothing but page concerns: a turbo frame and iteration.
We can in fact eliminate that partial and push its contents up to the template using it.

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
If you push page concerns up from partials into templates, a kind of symbiosis emerges.
When partials are essentially custom HTML elements, they can drop in to any template.
When templates own all of the page concerns, they become easier to maintain.
Page structure can be changed in one place, without rippling through partials into other templates.
The structure is clear because bulky presentational HTML lives in partials.
We get flexible templates and composable partials.

This only works if your partials `yield`.
That allows:
 1. Partials to be independent, rather than embedded in one another, and
 1. Templates to decide how partials compose.

{% callout %}
The Rails documentation briefly [discusses](https://guides.rubyonrails.org/layouts_and_rendering.html#understanding-yield) `yield` in the context of layouts.
It does not cover using `yield` in regular partials to let templates provide context-specific content.
This is a major gap in my opinion.
{% /callout %}

### Page Concerns
Here is a quick list of page concerns: 
 - instance variables
 - forms
 - turbo frame boundaries
 - turbo stream identifiers
 - turbo attributes
 - stimulus attributes
 - page parameters
 - data-test-ids
 - iteration logic
 - conditional rendering
 - view helper calls

 {% callout %}
data-test-ids are best used to factor out presentational details from testing logic in your templates

Testing against completely static parts of your views is not really a problem, but it’s not much use either.

You don’t want to test against all sorts of presentational rubbish like particular HTML elements

it should test something dynamic. That’s logic and since logic should gravitate toward templates then that’s where data test ids are most useful.

Demonstrate that testing presentation directly is a very high noise data structure, useful as a smoke test at best.

Another case is dynamic test ids that serve to indicate that the right thing is being displayed, e.g. data-test-id=”user-avatar-#{user.id}”
{% /callout %}

### The Attribute Bag Pattern
HTML attributes are often significant for turbo and stimulus, making them a page concern.
Partials should accept a hash of options and splat them onto their root element.

TODO Example.

### View Helpers
Moving logic up into templates *can* have positive consequences for handling view helpers, provided you have configured controller helpers to be controller-scoped, not global.

You can also use `helper_method :my_method_1, :my_method_2` to create controller-scoped view helpers.

{% callout %}
Even helpers for a specific controller are available to all views everywhere by default in Rails.
You can disable this so that a helper defined for one controller is available only to views rendered from that controller, by setting the following in `application.rb`.

`config.action_controller.include_all_helpers = false`
{% /callout %}

Views full of logic is an obvious smell with the knee-jerk reaction to shift the logic into a view helper.
If the logic is in a template, then it can naturally fit into a controller-scoped helper.
The template, controller and controller helper are all coupled together and not expected to be reused.

```ruby
class MyController < ApplicationController
  def show; end
end

module MyControllerHelper
  def pretty_datetime(datetime)
    return "" if datetime.blank?
    datetime.strftime("%b %e, %Y at %l:%M%P")
  end
end
```

```haml
# app/views/my_controller/show.html.haml
%p
  Submitted at:
  = pretty_datetime(@timesheet.submitted_at)

```

When you have logic embedded in partials, you are again faced with bad options:
 1. Silently depend on controller-scoped view helpers, causing the partial to break if reused elsewhere, or
 1. Add a global view helper to `app/helpers`. 



### Model Presentation

Even with all of the above, there still remains:
 1. Inline presentation logic in the summary bar, and
 1. Ssome duplication of status style logic.
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

### Presenters' Architectural Role

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


## ActionView's Achilles Heel

### Controller Testing is the wrong medium for intricate logic
 - painfully slow and bulky
 - must assert over HTML
 - Massive breadth of executed code buries unhealthy data access patterns

### No Template-Level Abstraction
Suppose you have diligently applied all of the advice in this article.
Will it work forever?
Obviously, it will eventually fail too.
The failure mode is that eventually duplication will emerge across templates.
Multiple templates will need variations of the same view helper logic and partial compositions.
How would you handle that?
All you can do is extract to partials, but we just spent all this time getting away from that!
Partials have no boundaries, they are extremely easy to break.
You will wind up making all of your helpers global and diluting the architectural role of partials.

 - No boundaries, separation, clear point of ownership
 - No good way to organise helpers. Controller-scoped or global, with no good way to test.
 - - global view helpers make sense for image_tag and link_to, not for contextual helpers.
 - If you need template-level abstraction to handle recurring template patterns, you're screwed.
 - Missing `ApplicationView` abstraction, forcing you into using controller tests. 
 - Accumulating large amounts of logic in modules muddies ownership and therefore testing.

Notice that (3) puts us back to where we started: logic-heavy partials.
This leaves us making all helpers global or lugging around helper modules and partials everywhere.
That would be hard to manage.
Imagine including three different partials into your template, then having to include three different view helper modules into your controller to make them work.
You still then have the problem of mixins overwriting each other’s methods, which could be likely for truly generic components appearing across pages.
There is just no good way to manage views in vanilla Rails, because nothing owns the view responsibility.
Only classes can own responsibilities.
Modules can provide logic but they can’t own anything because they can’t be instantiated and they have no boundaries.

The fundamental issue with ActionView is that it doesn’t provide a separate abstraction (class) for views.
Models and controllers are classes.
ActionView is mixed into controllers.
The lack of any architectural boundary makes architecture a DIY affair.
All sorts of anti-patterns are very easy in views.
We can approximate boundaries with deliberate principles.
This can get us a good way, though not all the way to maintainable views.
The final piece is testing.
That is always muddy with modules, but natural with classes.

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

Since ViewComponents offer a way to co-locate and encapsulate logic and presentation—and test it—it makes composition much more scalable. You can really build up components from other components much more easily, while keeping the logic manageable.

You can also do nice helper patterns like those seen in the primer design system view components themselves.

render(Primer::Beta::ButtonGroup.new(size: size)) do |component|
  component.with_button { "Button 1" }
  component.with_button { "Button 2" }
  component.with_button { "Button 3" }
end

Demonstrate how partials that yields can have logic and values injected via yield and avoid drilling that way. You could demonstrate argument drilling, structural branching, instance variable and view helper side channels, then finally composition via yield.

This keeps the partial hierarchy flat and wide, which means composable.

Deep nesting of partials without yield means that partials end up accessing page-owned data through side channels like instance variables and page params, or accumulating context via arguments and structural branches.

Repeating presentation doesn’t necessarily demand another partial. You can use capture blocks for local repetition and to help keep the hierarchy shallow. Grow out not down.


## Conclusion
Rails claims to be an MVC architecture, but unlike models and controllers, views do not get their own abstraction.
You *can* get a lot of mileage out of ActionView, but its total lack of architectural boundaries is a major weakness for maintainability.
The default behaviour of sharing all controllers helpers across all views is sloppy.
It's very easy to abuse global view helpers.
Rails is structured to accept large numbers of them.
The team needs a crisp mental model of composable views, which they won't get from reading the documentation.
ActionView is full of sharp, unintuitive tools that make technical debt very easy to write.