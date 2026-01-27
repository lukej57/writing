---
title: Maintainable Views in Vanilla Rails (WIP)
nextjs:
  metadata:
    title: Maintainable Views in Rails
    description: Using Only Templates, Partials and PORO Presenters.
---

{% callout title="Warning" type="warning" %}
This article may change significantly.
It underpins a talk I will give at BrisRails in late February.
Until then, consider everything tentative.
{% /callout %}


{% callout title="TL;DR" type="note" %}
Views in vanilla Rails can easily descend into chaos, but maintainability can be preserved by:
  1. Pushing behavioural concerns up into templates, and
  1. Pulling presentational details down into partials that `yield`.

This makes your templates **flexible** and your partials **composable**.
The next step is offloading logic from templates into controller-scoped view helpers and PORO presenters.
When an application outgrows this structure, ActionView itself becomes the maintainability bottleneck.
This motivates gems like Phlex and ViewComponents.
{% /callout %}

Growing views must be decomposed to manage cognitive load.
However, decomposition does not necessarily improve maintainability.
Decomposition along the wrong axes creates **fragmentation** and technical debt.
Rails views need **factorisation** that cuts along the axes of page behaviour, presentational HTML and data derived from models.

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

This is the final structure.

```
timesheets/index.html.haml
└── _timesheet_list.html.haml
    └── _row.html.haml
```


The first problem is that since the partials contain behaviour, you can't ignore them.
That means future developers must mentally compose all four files to understand the page.
The second problem is this creates a fixed hierarchy that is hard to adapt to different use cases.

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
Given the structure we have, drilling a flag is the least surprising and most portable option.

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
In fact, we had to rework it, because we couldn't reuse it.
This is the first sign that the nested partial structure is a liability.
There is more to come.

Suppose the employee needs to be shown an edit button for the timesheet, but not the manager.
We either add another flag, or couple the first flag to two use cases.
Soon we realise that the manager and employee have different workflows.
The manager approves timesheets in batches on the same page, while the employee navigates away to view their timesheet. 
When the manager clicks *approve*, turbo updates a frame.
When the employee clicks *edit*, that breaks.
The edit page was built separately, without any consideration of the turbo frame in the manager's view.

Again, we have bad options:
 1. Escape the turbo frame with a `data-turbo-frame="_top"` attribute on the edit link, or
 1. Wrap the edit page in a matching turbo frame, coupling unrelated templates.

This structure puts the developer in the same dilemma again and again:
  - Either invest a lot of time and effort to restructure, or
  - Make the situation a bit worse and move on.

Hardcoded nested partials creates technical debt.

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

This produces the same view as before, but now:
  1. The partials are not aware of each other, and
  2. Their composition can be seen at a glance in the index view.

Now let's rebuild the employee's timesheet view, with:
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

That's it. There is almost nothing to do.

Interestingly, we didn't reuse `_timesheet_list` in the employee view.
That is not surprising, because it contains nothing but page concerns: iteration and a turbo frame.
Sharing it between pages would only create interlocking constraints.
We can inline the content of `_timesheet_list` into the manager's view.

### Templates Orchestrate. Partials Render.
If you push page concerns up into templates, partials become little more than custom HTML elements.
A partial containing plain HTML and a `yield` has two great properties. You can:
  1. Put the partial inside anything, and
  1. Put anything inside the partial.

Partials like this make it easy to avoid duplicating blocks of HTML, because you can put them anywhere.
Conversely, overloaded partials couple generic HTML to context-specific behaviour. 
This forces rampant duplication of HTML fragments.

This affects templates too. Templates no longer pass data into blobs of imported behaviour.
Instead, templates implement behaviour directly and weave it into a composition of partials.
Hierarchies are brittle, while compositions are endlessly flexible.

Consider the example of a card.
The card below is full of logic and page concerns.
The partials are not coupled to any of it, or each other, nor do they obscure the behaviour at work.

```haml
= render "shared/card" do
  = turbo_frame_tag "timesheet_#{@timesheet.id}" do
    = render "shared/card_header" do
      - if can_edit?(@timesheet)
        = link_to "Edit", edit_timesheet_path(@timesheet)
    = render "shared/card_body" do
      - @timesheet.entries.each do |entry|
        = render "shared/list_item" do
          %span= format_work_date(entry.date)
          - if entry.approved?
            %span.badge Approved
```

The templates composes the partials and owns its behaviour.
It can be changed independently, without rippling into other pages via shared partials.
This makes templates flexible, while the abstraction of HTML makes their logic more readable.

{% callout %}
Eventually, it makes sense to create a partial whose only purpose is to fill a `yield` slot.
These blind partials do not `yield`, making them semi-composable.
This is like `<br />` or `<img ...>` in HTML.
Some examples might be: a group of form fields, an icon, or content for a card that displays `heading:` and `subtitle:` locals.
Partials like these can be more suited to using locals as named slots for rendered HTML instead of `yield`. 
{% /callout %}

### Page Concerns
Here is a quick list of page concerns.
Always use your judgment, but consider pushing these things up toward templates.
That will make your templates more flexible and your partials more composable.

| Page Concern | Examples |
|--------------|---------|
| instance variables | `@user`, `@timesheets` |
| forms | `form_with model: @timesheet` |
| turbo frames | `turbo_frame_tag "timesheet_#{@timesheet.id}"` |
| turbo stream identifiers | `turbo_stream_from timesheet` |
| turbo attributes | `data: { turbo_action: "replace" }` |
| route helpers | `edit_timesheet_path(timesheet)` |
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
Turbo and Stimulus attach behaviour to elements carrying those attributes.
This can be pushed up using the attribute bag pattern.

```haml
-# app/views/shared/_button.html.haml
- text = local_assigns[:text]
- attributes = local_assigns.except(:text).symbolize_keys
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

This allows the template (not the partial) to be responsible for page-relevant data attributes, while the partial remains generic and composable.

For compatibility with Rails' strict locals, use an explicit `attributes` parameter:

```haml
-# app/views/shared/_button.html.haml
-# locals: (text:, attributes: {})

%button{ **attributes }
  = text
```

```haml
= render "shared/button",
         text: "Approve",
         attributes: {
           class: "btn btn--primary",
           data: { turbo_action: "replace", test_id: "approve-btn" },
           id: "approve-button"
         }
```

This is arguable cleaner, since separates parameters and attributes without logic. 

### View Helpers
Pushing behaviour up into templates means templates accumulate code.
Code written directly in views is hard to discover, read and maintain.
It's even hard to write if you are using HAML.
You can ease the burden slightly by pulling logic into view helpers, but the benefits are slim.
Code becomes easier to read and write.
You can scope the helpers to a single controller with the right configuration, instead of adding ever more global heleprs to `app/helpers.rb`.
However, you still have no encapsulation and no straightforward unit testing story.
View helpers are a weak solution to maintaining view logic.

{% callout %}
Even helpers for a specific controller are available to all views everywhere by default in Rails.
You can disable this so that a helper defined for one controller is available only to views rendered from that controller, by setting the following in `application.rb`.

config.action_controller.include_all_helpers = false
{% /callout %}


### Model Presentation
View logic is not always view-specific.
It often transforms data from models for presentation.
This logic goes anywhere a model is displayed, which could cut across controllers.
If we introduce presenters, we can make this logic easy to test and reuse, while slimming down view helpers.

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

  # Law of demeter
  # Prefer views don't reach into the underlying model.
  def employee_name
    @timesheet.employee.name
  end

  def status_label
    @timesheet.status.titleize
  end

  def hours
    "%.1f hrs" % @timesheet.total_hours
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

This simplifies the partial and decouples it from the model. 

```haml
-# locals: (presented_timesheet:, attributes: {})

%li.timesheet-row{ **attributes }
  .employee-name= presented_timesheet.employee_name
  .hours= presented_timesheet.hours
  %span.badge{ class: presented_timesheet.status_badge_class }= presented_timesheet.status_label
```

#### Open vs Closed Presenters
It's tempting to have your presenter inherit from `SimpleDelegator`.
That gives you an *open* presenter, where method calls fall through to the underlying model.
That would allow us to remove the `employee_name` method from the `TimesheetPresenter`.
This is convenient, but it reduces maintainability.

My take on presenters is that they have two goals:
  1. Offload model-specific presentation logic from views, and
  2. Decouple views from models.

Open presenters lose the second property.
They expose a major implementation detail and that limits their versatility.
Closed presenters can easily present STI variations of a base model.
They can even present a concern that cuts across many models.
Open presenters cannot handle these use cases.

{% callout %}
If you need to access a bunch of attributes on the underlying model, you can package them into a `T::Struct` and deliver it from a method.
This concentrates data access logic into a single method that is easy to instrument for performance issues.
{% /callout %}


## Remaining Challenges
Flattening partials and composing them in templates is a major win for maintainability.
That's primarily because it prevents the technical debt of hardcoded partial hierarchies.
Unfortunately, this system alone still leaves some major problems unsolved.

### Gray Areas
The idea is to give partials the very minor role of HTML abstraction, with minimal if any logic.
That makes partials maximally reusable, but many partials are not indended to be shared widely.
It is very easy to make the argument for fatter partials *now* and thinner ones *later*.
Getting this right relies heavily on developers having a refined intuition for composition-over-hierarchy.
In practice, this is simply not as maintainble as a good abstraction.
A good abstraction creates a recognisable pattern that gives you a decent maintainability baseline, even if copied blindly.

### ActionView's Missing Abstraction
The intuitive impulse to load behaviour into partials comes from the fact that we *want* UI components, but in vanilla Rails we *get* partials.
Thin, composable partials are great, but they cannot actually solve the much larger problem of maintaining substantial UI behaviour.
Patterns can and will appear **across** templates.
Maintaining that behaviour is vastly easier when logic has:
 - A clear owner that runs quickly in a unit test,
 - Public methods that return easy-to-test data structures,
 - An API that streamlines use cases but hides the implementation details, and
 - Internal state to enable dependency injection.

This sounds nothing like a partial or a template, but exactly like a class.
This is the `ApplicationView` abstraction that ActionView forgot.
If you don't have this, then you circle back around to overloaded partials, confusing gray areas and chaotic evolution.
Taking maintainability to the next level requires a proper view abstraction.
This is the context and motivation for gems like Phlex and ViewComponents.
