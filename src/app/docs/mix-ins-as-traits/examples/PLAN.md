# Example plan — Mix-Ins as Traits

This folder is **article resources**, not a published route. `page.md` stays the essay; code lives here so the story can be long without turning the article into a wall of listings.

Do not start a separate git repo until (if) the snapshots are worth cloning. Until then, this directory is the "example repository."

## Why examples at all

The outline in `page.md` is dense on purpose: it is a brief. Readers will not sit through it. They will sit through a story:

1. We implement something the naïve way.
2. Sharing code the usual Rails way (concerns for everything) makes it hard to maintain.
3. We refactor toward `Class = Superclass + State + Traits + Glue`, and send every non-trait job to the catalog.

The article *points at* excerpts. This folder holds the full snapshots so we can write sequentially without pretending the reader compiled the program in their head.

## Domain

**Billable documents:** `Invoice` and `Estimate` in a small Rails-shaped app (POROs with familiar names; no boot, no DB, no gems required to *read* the story).

Why this domain:

- Two classes that are *variations of one role* (single inheritance) and also want *orthogonal capabilities* (traits).
- Obvious fake-trait temptations: `Utils`, `Scopes`, `Exportable`, `Notifiable`, `Billable`, a shared controller concern.
- Obvious real trait: comparison / ordering (`<=>` → `Comparable`).
- Glue you can see: accessors, "document number", "client email."
- Collaborators you can see: PDF export, sending mail — own lifetime, own state.

Do not use circles and `TDrawing`. That is the paper's story; ours should look like an app.

A second, much smaller snapshot can sit beside it for the paper mapping (`Comparable` / `Enumerable` only) if the document story is too big for Part 1. Part 1 should not wait on Rails.

## Three snapshots (the whole plot)

Each snapshot is a subfolder with the same filenames where possible, so diffs are the story.

| Folder | Name | What the reader should feel |
|---|---|---|
| `snapshots/01-naive/` | One class, copy-paste | `Invoice` works. `Estimate` duplicates half of it. Pain is duplication, not coupling. |
| `snapshots/02-concern-soup/` | DRY with modules | Shared everything via `include`. Looks like "composition over inheritance." God objects, silent override, concerns reading ivars/`params`. |
| `snapshots/03-equation/` | Superclass + state + traits + glue | Short include list. Host owns state and glue. The rest of the catalog has been applied. |

Optional later: `snapshots/02b-broken/` — a *specific* breakage (add `to_s` to a concern, the other `to_s` disappears) so fragility is a failing example, not a paragraph.

## Scenes (what to implement, mapped to the catalog)

Write the soup snapshot so that **each bad include is a catalog row**. The equation snapshot then has a one-to-one replacement. That is how the catalog stops being abstract.

| Scene | Soup (wrong) | Equation (right) | Catalog row |
|---|---|---|---|
| Money / date formatting | `include Formatting` | `Formatting.currency(amount)` (`module_function`) | Pure utilities |
| PDF bits taking a document | `include Exportable` that calls `pdf_*` on self | `PdfExporter.new(document).call` | Clustered on one argument → class |
| Invoice vs Estimate internals | `include DocumentBehaviour` on both | `class Invoice < Document` / `Estimate < Document`, depth one | Variations of one role → SI |
| Controllers | `include DocumentResources` in both controllers | `class InvoicesController < DocumentsController` | Same — "every controller needs this" is the *role* |
| Emailing the client | `include Notifiable` reading `@client` | `Notifier.new(mailer).notify(document)` | Own lifetime → DI |
| "Billable" workflow | `include Billable` on the model | `Issue.new(document).call` (PORO takes the model) | Operation *on* a record |
| Scope pile | `include DocumentScopes` | Query object, or scopes stay on `Document` | File length ≠ capability |
| `as_json` for the API | `include Displayable` | Presenter / decorator | Presentation |
| `after_save` sync | `include Auditable` | Host callback calls `Audit.log(document)` | Side effects |
| Compare / sort documents | homemade `include Orderable` touching `@number` | `include Comparable`; host implements `<=>` as **glue**; `@number` is **state** | Real trait |
| Client `has_many` + validations that *are* one capability | (optional) a fat concern | Small concern, `included do` only for that capability's DSL | Legitimate Rails leftover |

Not every row needs a full class in the article. Several can be a 8-line before/after. The **spine** of the story is: duplication → soup (`Exportable` + `Notifiable` + `Formatting` + `DocumentBehaviour`) → equation (`Document` superclass, `Comparable`, `PdfExporter`, `Notifier`, `Formatting.currency`).

Pick **one** clash for the maintainability beat: `Exportable` and `Notifiable` both define `to_s` / `as_json` / `label`. Soup: later include wins. Equation: no clash, or the host glues names explicitly.

## What "Class = Superclass + State + Traits + Glue" looks like in the third snapshot

Target shape for `Invoice` (illustrative, not sacred):

```ruby
class Invoice < Document          # Superclass — role variation
  include Comparable              # Trait — capability; pure; requires <=>
  # include Taggable             # only if we have a second real trait

  def initialize(number:, client:, line_items:)
    @number = number              # State — host owns it
    @client = client
    @line_items = line_items
  end

  def <=>(other)                  # Glue — host plugs trait into state
    number <=> other.number
  end

  def to_pdf                      # Not a trait: collaborator
    PdfExporter.new(self).call
  end
end
```

`Document` holds what *both* invoice and estimate are: the template, hooks the children fill, nothing orthogonal.

`Comparable` (stdlib) is the trait we do not write. If we want a custom trait, write `Orderable` the same shape: provided methods, required `<=>` or `sort_key`, no ivars.

## Article vs this folder

**In `page.md` (excerpts, small):**

- Part 1: one tiny trait shape (`<=>` / `each`), maybe 15 lines, not the full app.
- Part 2: the three-act story as *narrative* with 1–2 excerpts per act, plus a pointer: "full snapshot in `examples/snapshots/0N-…`."
- Part 3: the soup concern that reads `params` / ivars, then the same concern after glue moved to the host (or became a collaborator).

**In this folder (full):**

- Complete files per snapshot so *we* can keep the story consistent.
- A `DIFFS.md` (later) listing the interesting file-to-file diffs, so the article can say "see Estimate#total" without pasting both files.

House style when excerpts land in `page.md`: one sentence per line, fenced `ruby`, no novel-length listings. Prefer a 12-line excerpt and a sentence over a 80-line class.

## File layout (create as we build, not all at once)

```
examples/
  PLAN.md                 ← this file
  snapshots/
    01-naive/
    02-concern-soup/
    03-equation/
  excerpts/               ← optional: the exact snippets pasted into page.md (so they cannot drift)
```

Suggested files inside each snapshot (keep the set stable):

```
document.rb               # missing in 01 if everything is on Invoice
invoice.rb
estimate.rb
formatting.rb             # module_function in 03; included module in 02
pdf_exporter.rb           # only 03 (and maybe a bad mixin in 02)
notifier.rb               # only 03
documents_controller.rb   # 02 concern vs 03 base class
invoices_controller.rb
```

No Rails boot. Controllers are POROs with `params` hashes if we need the stolen-glue scene. Models are POROs. If a concern needs `included do` / `has_many`, write it as a comment plus the Ruby that would run (`extend ActiveSupport::Concern` only if we decide the snapshot may depend on activesupport — **prefer not to** in v1).

## Runnable or not

v1: **readable Ruby that would run**, no test suite, no Gemfile.

v2 (if the story is working): a tiny `examples/Rakefile` or minitest that asserts soup's silent override and equation's `invoice > estimate`. That is the moment to consider a real repo.

## Size budget

- Spine story: ≤ ~200 lines per snapshot, whole tree.
- Article excerpt: ≤ ~25 lines, and only one excerpt per beat unless a diff is the beat.
- If a scene cannot be shown in 25 lines, it stays in the folder and the article gets a two-sentence summary plus a path.

## Order of work

1. Write `02-concern-soup` first (the pathology is the pedagogy). Stop when each catalog-wrong-row has a name in the include list.
2. Write `01-naive` by inlining that soup back into `Invoice` / `Estimate` (so 01→02 is a believable DRY).
3. Write `03-equation` by applying the catalog, one include at a time. Commit-worthy steps internally: utils out, SI for Document, exporters out, Comparable in, glue on the host.
4. Choose excerpts for `page.md` only after 03 exists — otherwise we will invent listings that the snapshot does not support.
5. Part 1 can take a 15-line `Comparable` / `Iterator` sidebar from `03` without waiting on controllers.

## What we will not build

- A mountable Rails app, routes, schema, fixtures.
- Every catalog row as a first-class class (authorization policy, query object, etc. can be stubs or omitted from v1).
- Composite traits (interesting, easy to confuse; one sentence in the article, no snapshot).
- Rust listings except a 10-line `Ord`/`Iterator` aside if Part 1 needs it — not part of this story.
- A second domain. One story, three snapshots.

## Success

Someone can follow 01 → 02 → 03 in the folder and then read the article excerpts without meeting a new concept that was not in the soup. The include list in 03 is short and only capabilities. The equation is visible in one file (`invoice.rb`) without a lecture.
