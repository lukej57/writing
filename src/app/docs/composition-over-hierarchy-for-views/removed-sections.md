# Removed Sections

These sections were removed from `page.md` to narrow the article's scope to composition over hierarchy.

---

### Summary Bar

From the initial example view:

```haml
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
```

Used in the fragmentation index as `= render "summary_bar", timesheets: @timesheets`
and in the factorisation index as `= render "timesheets/summary_bar", timesheets: @timesheets`.

---

### View Helpers
Pushing behaviour up into templates means templates accumulate code.
Code written directly in views is hard to discover, read and maintain.
It's even hard to write if you are using HAML.
You can ease the burden slightly by pulling logic into view helpers, but the benefits are slim.
Code becomes easier to read and write.
You can scope the helpers to a single controller with the right configuration.
However, you still have no encapsulation and no straightforward unit testing story.
View helpers are a weak solution to maintaining view logic.

{% callout %}
Even helpers for a specific controller are available to all views everywhere by default in Rails.
You can disable this so that a helper defined for one controller is scoped to that controller, by setting the following in `application.rb`.

`config.action_controller.include_all_helpers = false`
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


## ActionView's Missing Abstraction
The idea is to give partials the very minor role of HTML abstraction, with minimal logic.
That makes partials composable, but it immediately pushes duplicate behaviour up into templates.
How do you deal with that duplication?
You can't.
There is nowhere for it to go, except right back into partials.
Partials have no encapsulation and they are hard to test.
These limitations all but guarantee that composability will degrade if behaviour creeps back into partials.
You are stuck in a lose-lose tradeoff.
You have to introduce something new to overcome it.

That something would need to provide the following things for view behaviour:
 - A clear owner that runs quickly in a unit test,
 - Public methods that return easy-to-test data structures,
 - An API that streamlines the use cases but hides the implementation, and
 - Internal state to enable dependency injection.

If you have all of those things, you can maintain and compose behaviour.
That sounds nothing like a partial or a template, but exactly like a class.
What we need is the missing `ApplicationView` abstraction.
That is how you take maintainability to the next level, which is the motivation to consider gems like Phlex and ViewComponents.
