---
title: Maintainable Views in Vanilla Rails (WIP)
nextjs:
  metadata:
    title: Maintainable Views in Rails
    description: Using Only Templates, Partials and PORO Presenters.
---

{% callout title="TL;DR" type="note" %}
Giving clear, non-overlapping roles to templates, partials and PORO presenters maximises view maintainability in vanilla Rails.
It also reveals the limitations of ActionView, contextualising gems like Draper, Keynote, Phlex and ViewComponents.
{% /callout %}

Ever growing views must be decomposed into manageable units, but not all approaches are equal.
Decomposition along the wrong axes creates **fragmentation** and technical debt.
Rails applications need **factorisation** that splits views along the axes of page behaviour, presentational HTML and derived model data.

![Factorization axes diagram](/images/composable-views/axes.svg)

This factorisation gives you:
 - Flexible templates, 
 - Composable partials, and
 - Models decoupled from views.

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

This is what I call the *partial tunnelling anti-pattern*.
The first problem is that future developers must mentally compose four files to understand the page.
The second problem is that this structure sabotages the page's evolution.

### Chaotic Evolution
Let's try to reuse the timesheets list to show an employee their timesheets on the new page below.

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  = render "timesheets/timesheet_list", timesheets: @my_timesheets
```

When the page loads, we see approve and reject buttons.
Those buttons are for managers only.
Two different pages need to adjust the behaviour of `_row`.
That is quite a problem, because `_row` is a hidden implementation detail of `_timesheet_list.html.haml`.

```
timesheets/index.html.haml (manager view) 
└── _timesheet_list.html.haml
    └── _row.html.haml

dashboard/show.html.haml   (employee view)
└── _timesheet_list.html.haml
    └── _row.html.haml
```

The options are all bad at this point.
We can smuggle data down to `_row` with an instance variable or a page parameter.
We can also drill an argument through the `_timesheet_list`.
Given the structure we have, drilling is the least surprising and most portable option.
Let's add the flag.

```haml
-# app/views/timesheets/_timesheet_list.html.haml
-# === New flag ===
-# locals: (timesheets:, show_review_form: true)

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - timesheets.each do |timesheet|
      -# === Drill the flag === 
      = render "timesheets/row", timesheet: timesheet, show_review_form: show_review_form
```

```haml
-# app/views/timesheets/_row.html.haml
-# === New flag ===
-# locals: (timesheet:, show_review_form: true)

...

  -# === Conditional render on flag ===
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
           -# === Adjust _row behaviour from template ===
           show_review_form: false
```

That was a lot of work to "reuse" a partial.
It's also just the beginning.
The employee needs to be shown an edit button, but not the manager.
Either we add another flag, or couple the first flag to two use cases.

The manager and employee also have different workflows.
The manager approves timesheets in batches on the same page, while the employee navigates away to view a single timesheet. 

When the manager clicks *approve*, turbo updates a frame, preserving the scroll position.
When the employee clicks *edit*, turbo tries to extract a frame from the response, causing an error.
We have more bad options:
 1. Add a flag for the `data-turbo-frame="_top"` attribute on the edit link, or for the turbo frame itself, or
 1. Wrap the edit page content in a matching turbo frame, coupling unrelated templates.

This structure repeatedly leads the developer to the same fork in the road:
  - Invest a lot of time and effort to restructure, or
  - Make the situation a bit worse and move on.

That is technical debt.

## Factorisation

The major problem with fragmentation is that templates cannot  adjust the behaviour of nested partials.
We can fix this by making partials `yield` to invert the dependency.

Let add `yield` to `_row` and `_timesheet_list`.

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
      -# === Add yield ===
      = yield
```

```haml
-# app/views/timesheets/_timesheet_list.html.haml
-# locals: (timesheets:)

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - timesheets.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        -# === Add yield ===
        = yield timesheet
```


### Controlled Evolution

Now we can make the same changes with zero friction.
The template decides what goes into `_timesheet_list` and directly controls `_row`.
There is no hierarchy and therefore no flag drilling.

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

  -# === No turbo frame needed, so don't include timesheet_list ===
  %ul.timesheet-list
    - @my_timesheets.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        - if timesheet.draft?
          = link_to "Edit", edit_timesheet_path(timesheet), class: "btn-sm"
```

The only hiccup was that we did not actually use `_timesheet_list`.
That's because it only contains non-portable page concerns (a turbo frame and iteration).
We are better off eliminating `_timesheet_list` and and pushing its contents up to the template.

### Template-Partial Symbiosis
If you push page concerns up from partials into templates, a kind of symbiosis emerges.
When partials are essentially custom HTML elements, they can drop in to any template.
When templates own all of the page concerns, you can change them *locally*.
Page behaviour changes happen in one place, without rippling into other templates via shared partials.
The essential page structure is also clearer because HTML bulk lives in partials.
This gives us flexible templates and composable partials.

A partial is composable if you can:
  1. Put the partial inside anything, and
  1. Put anything inside the partial.

Plain HTML gives you (1) and (2) comes from using `yield`.

{% callout %}
Occasionally, it makes sense to create a semi-composable partial that does not `yield`.
This is similar to a self-closing HTML tag  like `<br />`.
A good example is making form fields reusable.
You can package up a few form fields into a partial that does not `yield`, then
drop it into any form.
It is intended to be a leaf node and should not nest other partials.
{% /callout %}

### Page Concerns
Here is a quick list of page concerns.
Always use your judgment, but think twice before hardcoding these things into partials:

| Page Concern | Examples |
|--------------|---------|
| instance variables | `@user`, `@timesheets` |
| forms | `form_with model: @timesheet` |
| turbo frames | `turbo_frame_tag "timesheet_#{@timesheet.id}"` |
| turbo stream identifiers | `turbo_stream_from timesheet` |
| turbo attributes | `data: { turbo_action: "replace" }` |
| stimulus attributes | `data: { controller: "dropdown" }` |
| page parameters | `params[:id]`, `params[:search]` |
| data-test-ids | `data: { test_id: "submit-button" }` |
| iteration logic | `timesheets.each do \|timesheet\|` |
| conditional rendering | `if show_review_form` |
| controller-specific view helper calls | `current_timesheet_period` |

{% callout %}
If your partials contain blocks of HTML, they are essentially static.
The point of a `data-test-id` is to anchor test assertions onto something independent of presentational details.
Since their purpose is testing some kind of logic, they provide much more value in action templates than partials.
{% /callout %}

### The Attribute Bag Pattern
There is one last detail to pushing page concerns up out of partials.
HTML attributes are often significant for turbo and stimulus, making them page concerns.
Partials should accept a hash of options and splat them onto their root element.

```haml
-# app/views/shared/_button.html.haml
%button{ **attributes }
  = text
```

```haml
= render partial: "shared/button", locals: { 
    text: "Approve", 
    class: "btn btn--primary", 
    data: { turbo_action: "replace", test_id: "approve-btn" }, 
    id: "approve-button"
  }
```

This allows the template (not the partial) to be responsible for page-relevant data attributes, while the partial remains generic and composable, just like a custom HTML element.

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
If we move **all** logic into view helpers, they might accumulate knowledge about models.
That's not ideal, because that cuts across controllers and potentially into partials.
Both circumstances force those helpers into global visibility.
If transforming model data becomes complex, we'll also want the straightforward unit testing story of a dedicated class.
This all leads to presenters, our third axis of factorisation.

Recall that we had some obvious model presentation logic in `_row`. 

```haml
%li.timesheet-row{ id: dom_id(timesheet) }
  .employee-name= timesheet.employee.name
  .hours= "%.1f hrs" % timesheet.total_hours

  - status_class = case timesheet.status
    - when "submitted" then "badge--warning"
    - when "approved" then "badge--success"
    - when "rejected" then "badge--danger"
  %span.badge{ class: status_class }= timesheet.status.titleize
```

Let's add a plain PORO presenter.

```ruby
# app/presenters/timesheet_presenter.rb
class TimesheetPresenter
  def initialize(timesheet)
    @timesheet = timesheet
  end

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

This leaves our partial looking a bit simpler.

```haml
- presented_timesheet = TimesheetPresenter.new(timesheet)

%li.timesheet-row{ id: dom_id(timesheet) }
  .employee-name= presented_timesheet.employee.name
  .hours= presented_timesheet.hours
  %span.badge{ class: presented_timesheet.status_badge_class }= presented_timesheet.status_label
```

There is a subtler section of model presentation logic in the summary bar. 

```haml
-# app/views/timesheets/_summary_bar.html.haml

- total_hours = @timesheets.sum(&:total_hours)
- overtime_hours = @timesheets.sum { |t| [t.total_hours - 40, 0].max }
- pending_count = @timesheets.count(&:submitted?)

= render "timesheets/summary_bar",
         total_hours: "%.1f" % total_hours,
         overtime_hours: "%.1f" % overtime_hours,
         pending_count: pending_count,
         pending_alert: pending_count > 0
```

This is presentation of a timesheet **collection**.
This can work in concern with the individual `TimesheetPresenter`.

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
    @timesheets.each { |t| yield t, TimesheetPresenter.new(t) }
  end
end
```

TODO: Refine this...

```haml
-# app/views/timesheets/index.html.haml

- presented_timesheets = TimesheetCollectionPresenter.new(@timesheets)

%h1 Timesheets for Review

= render "timesheets/summary_bar",
         total_hours: presented_timesheets.total_hours,
         overtime_hours: presented_timesheets.overtime_hours,
         pending_count: presented_timesheets.pending_count,
         pending_alert: presented_timesheets.pending_alert?

= turbo_frame_tag "timesheets-list", data: { turbo_action: "advance" } do
  %ul.timesheet-list
    - presented_timesheets.each do |timesheet, presenter|
      = render "timesheets/row", timesheet: timesheet, presenter: presenter do
        - if timesheet.submitted?
          = form_with model: timesheet,
                      url: timesheet_review_path(timesheet),
                      class: "review-form" do |f|
            = f.hidden_field :status
            = f.button "Approve", value: "approved", class: "btn-sm btn-success"
            = f.button "Reject", value: "rejected", class: "btn-sm btn-danger"
```

### Presenters' Architectural Role

Presenters:
 1. Decouple views from models, and
 1. Can offer optional preload scopes.

They provide closed interfaces, exposing only what the view needs and nothing more.
Their job is to transform data from models into shapes the views can consume.
Generating HTML is not their responsibility.
If a presenter renders markup, it starts overlapping with tools like ViewComponents, which are specifically designed to render views.
ViewComponents are classes that render views, while presenters are classes that prepare data for views.
This clear division improves testability.
It is straightforward to test a presenter that returns structured data, such as { status: :overdue, days: 5 }.
Testing a presenter that returns HTML is harder, because it requires parsing DOM or matching strings, which complicates unit testing and turns it into more of an integration test.
The "query problem" is related but distinct.
Directly accessing models from views spreads out data queries unpredictably.
Presenters help solve this by providing explicit methods for fetching data, enabling strict-loading, and supporting optional preloading hooks.
With presenters, data access becomes observable and testable in a plain Ruby object, which is not possible when data is pulled through the controller or view.
The controller still decides what gets preloaded, since it has the context about which code paths are relevant.
The "accumulation problem" is what presenters really solve.
Display logic for a model can be scattered across many views.
Storing this logic on the model makes it testable but unorganized.
Placing it in views ties it to each use case but reduces discoverability and maintainability.
Presenters offer a solution: a place for testable, discoverable, and presentation-scoped logic.

```ruby
class TimesheetPresenter
  def self.preload_scope
    Timesheet.includes(:employee, shifts: :breaks)
  end
end

# Controller
@timesheet = TimesheetPresenter.preload_scope.find(params[:id])
@presenter = TimesheetPresenter.new(@timesheet)
```

```ruby
@presenter = TimesheetPresenter.new(timesheet, preloaded: [:shifts, :employee])
```

## ActionView's Missing Abstraction

In some sense, ActionView just renders a view, given some information.
It is functionality that `ApplicationController` employs and having a separate abstraction for it is not immediately obvious.
However, view behaviour grows.
Once it is substantial, classes give you a single point of ownership for DI, testability, a coherent API (impossible without encapsulation).
If you put substantial behaviour into partials you rely on global view helpers operating in the view context.
Testing, designing an API, adding flexibility with DI and inheritance to vary collaborates--all the ways you manage complex behaviour become morea and more difficult to do and therefore to maintain.
A partial simply cannot fill the shoes of a class as behaviour grows.

The fundamental limitation of ActionView is that it doesn't provide a class-based abstraction for views. While models and controllers are classes with clear boundaries, ActionView is mixed into controllers. This missing `ApplicationView` abstraction creates several problems:

**No Encapsulation or Boundaries**
- View helpers are either controller-scoped or global, with no middle ground
- Modules provide logic but can't own responsibilities since they can't be instantiated
- Method conflicts between mixed-in modules are common and hard to debug

**Poor Testing Story**
- Template logic must be tested through slow, bulky controller tests that assert over HTML
- No way to unit test view logic in isolation
- Unhealthy data access patterns get buried in the breadth of executed code

**Duplication Without Good Solutions**
- When templates share patterns, you must either:
  - Create global helpers (polluting the namespace)
  - Include helper modules in every controller that needs them
  - Fall back to logic-heavy partials (defeating the purpose of composition)

With proper view classes, you could:
- **Encapsulate** related template logic, helpers, and partials together
- **Test** view logic directly without controller overhead
- **Compose** views from other view objects with clear ownership
- **Inherit** common functionality through class hierarchies
- **Namespace** helpers naturally within their view classes

This is why ViewComponents and Phlex have emerged—they provide the missing abstraction that lets views be first-class citizens with proper boundaries, testing, and composition patterns.

## Conclusion

Rails claims to be MVC, but views lack their own abstraction. While you can build maintainable views with disciplined use of ActionView, the lack of architectural boundaries makes it far too easy to create tangled, untestable view code. The solution isn't more conventions—it's the missing piece of the architecture: real view classes.