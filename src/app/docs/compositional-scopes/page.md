---
title: Compositional Scopes in Rails 
nextjs:
  metadata:
    title: Compositional Scopes in Rails
    description: A technique for maintainable scopes in Rails.
---

 - Scopes reside on models which have low context and wide visibility.
 - Models should offer composable tools to enable orchestration from higher contexts like controllers.
 - Scopes should be slim and composable, like a domain-specific alternative to the ActiveRecord query builder, designed to enable composition.
 - Instead, large, context-specific scopes tend to accumulate on models.
 - If you can't compose your scope from primitives, it is probably a query object, but could be hung from a model as a scope for convenience.
 - Query object gives higher flexibility and testability, better for managing behavioural complexity.
 - What does compositional really mean? 
   - Orthogonal
   - No materialisation or side effects
   - Product is the sum of its parts and nothing more
 - Co-location of preloader scopes and instance methods that depend on them in small, atomic modules.