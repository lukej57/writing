---
title: Maintainable Views in Vanilla Rails (WIP)
nextjs:
  metadata:
    title: Maintainable Views in Rails
    description: Using Only Templates, Partials and PORO Presenters.
---

{% callout title="TL;DR" type="note" %}
Maintainable views in *vanilla* Rails rest on:
  1. Pushing behavioural concerns up into templates, and
  1. Pulling presentational concerns down into partials.

This makes your templates **flexible** and your partials **composable**.
The next step is offloading logic from templates into view helpers and PORO presenters.
Finally, ActionView becomes the bottleneck, motivating gems like Draper, Keynote, Phlex and ViewComponents.
{% /callout %}

Ever growing views must be decomposed into manageable units, but not all approaches are equal.
Decomposition along the wrong axes creates **fragmentation** and technical debt.
Rails views need **factorisation** that cuts along the axes of page behaviour, presentational HTML and derived model data.

![Factorization axes diagram](/images/composable-views/axes.svg)

## An Example View 

Consider a timesheet index view with approve and decline buttons for managers. 

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

This is the *partial tunnelling anti-pattern*.
The first problem is that future developers must mentally compose four files to understand the page.
The second problem is that this structure sabotages the page's evolution.

### Chaotic Evolution
Let's try to reuse the timesheets list to show an employee their timesheets on a new page.

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets
  = render "timesheets/timesheet_list", timesheets: @my_timesheets
```

When the page loads, we see the approve and reject buttons which are for managers only.
Now two different pages need to adjust the behaviour of `_row`, which is a hidden implementation detail of `_timesheet_list.html.haml`.

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
Let's add a flag.

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

Now the employee dashboard can hide the buttons by setting the flag.

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
We either add another flag, or couple the first flag to two use cases.

The manager and employee also have different workflows.
The manager approves timesheets in batches on the same page, while the employee navigates away to view a single timesheet. 

When the manager clicks *approve*, turbo updates a frame.
When the employee clicks *edit*, that breaks.
The edit page was built separately, without any consideration of the turbo frame in the manager's view.

We have more bad options:
 1. Escape the turbo frame with a `data-turbo-frame="_top"` attribute on the edit link, or
 1. Wrap the edit page content in a matching turbo frame, coupling unrelated templates.

This structure puts the developer in the same dilemma again and again:
  - Either invest a lot of time and effort to restructure, or
  - Make the situation a bit worse and move on.

Hardcoding nested partials **instantly** creates technical debt.

## Factorisation

The major problem with fragmentation is that templates cannot adjust the behaviour of nested partials.
We can fix this by making partials `yield` to throw control back to the template.

Let's add `yield` to both `_row` and `_timesheet_list`.

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

  -# Yield instead of hard-coding the accept/reject buttons
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
      = yield timesheet
```


### Controlled Evolution

Now we can make the same changes with zero friction.
The template has full control over what goes inside `_timesheet_list`, including which partials to use.
There is no hierarchy conflict and therefore no flag drilling.

Let's rebuild the manager's timesheet index view using both partials:

```haml
-# app/views/timesheets/index.html.haml

%h1 Timesheets for Review

= render "timesheets/summary_bar", timesheets: @timesheets

= render "timesheets/timesheet_list", timesheets: @timesheets do |timesheet|
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

Now let's build the employee's timesheet view with:
  1. No turbo frame, and
  1. An edit button instead of accept and reject buttons.

```haml
-# app/views/dashboard/show.html.haml

%h1 Dashboard

%section.my-timesheets
  %h2 My Timesheets

  %ul.timesheet-list
    - @my_timesheets.each do |timesheet|
      = render "timesheets/row", timesheet: timesheet do
        - if timesheet.draft?
          = link_to "Edit", edit_timesheet_path(timesheet), class: "btn-sm"
```

Painless.
Interestingly, we didn't reuse `_timesheet_list` in the employee view.
That is not surprising, because it contains nothing but page concerns.
Sharing it between pages would only create unmaintainable interlocking constraints.
We are better off inlining `_timesheet_list` directly into the manager's view.

### Template-Partial Symbiosis
If you push page concerns up into templates, partials essentially become custom HTML elements.

Partials containing plain HTML and a `yield` have two great properties. You can:
  1. Put the partial inside anything, and
  1. Put anything inside the partial.

Meanwhile, templates that own all of their page's behaviour can be changed independently, without rippling into other pages via partials.
This makes templates flexible, while the abstraction of HTML makes their logic more readable.

This template-partial symbiosis turns partials into technical assets, while keeping your templates flexible and decoupled.

{% callout %}
Occasionally, it makes sense to create a semi-composable partial that does not `yield`.
This is like `<br />` in HTML.
It is designed just to slot into other elements.
For example, a group of form fields, an icon, or content for a card that displays `heading:` and `subtitle:` locals.
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
Tests assert over some kind of logic.
Those assertions become fragile if they depend on logically irrelevant HTML.
This is the problem solved by `data-test-id` attributes.
This is all irrelevant to partials that are plain HTML, because they are completely static.
Push `data-test-id` attributes up into templates.
{% /callout %}

### The Attribute Bag Pattern
Notice that some of those page concerns are HTML attributes.
This is where the line blurs, because Turbo and Stimulus attach behaviour to elements carrying those attributes.
This kind of page concern can be pushed up using the attribute bag pattern.

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

## ActionView's Missing Abstraction

Suppose you implement this article's advice.
Inevitably, patterns will emerge across your templates.
Some combination of partials and view helpers will start to repeat.
What then?
You could create a partial with global view helpers, but that recreates the original problem.
Partials loaded with behaviour kill maintainability.
Furthermore, behaviour that cuts across pages could become complex and widely used.
This is a task for a real behavioural abstraction, which requires:
 - A clear owner that runs quickly in a unit test,
 - Public methods that return easy-to-test data structures,
 - An API that streamlines the use case, but hides implementation details, and
 - Internal state to enable explicit, constructor-based dependency injection.

This sounds nothing like a partial and exactly like a class.
This is where ActionView becomes the bottleneck.
Mixing tons of behaviour into controllers simply does not cut it, but there is no `ApplicationView` to save the day.
Taking maintainability to the next level can be done with gems like Draper, KeyNote, Phlex and ViewComponents, but that's a discussion for another day.