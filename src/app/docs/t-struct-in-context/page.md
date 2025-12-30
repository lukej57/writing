---
title: T::Struct in Context
nextjs:
  metadata:
    title: T::Struct in Context
---

Ruby projects using Sorbet will almost certainly be using T::Struct which, according to the documentation will:

> … behave similarly to the Struct class built into Ruby, but work better with static and runtime type checking.

My aim here is to deep dive into that definition and then discuss how best to use T::Struct.

# Why Do We Need Structs?

## The Need for Compound Data

Geometry is full of canonical, motivating examples of why we need compound data. Consider writing a function to compute the centroid of three points in 3D space.

![Centroid diagram](/images/t-struct-in-context/centroid.png)

```ruby
class GeometryCalculator
  extend T::Sig

  sig {
    params(
      x_1: Float, # First point
      y_1: Float,
      z_1: Float,
      x_2: Float, # Second point
      y_2: Float,
      z_2: Float,
      x_3: Float, # Third point
      y_3: Float,
      z_3: Float
    ).returns([Float, Float, Float]) # Calculated centroid
  }
  def self.centroid(x_1, y_1, z_1, x_2, y_2, z_2, x_3, y_3, z_3)
    centroid_x = (x_1 + x_2 + x_3) / 3.0
    centroid_y = (y_1 + y_2 + y_3) / 3.0
    centroid_z = (z_1 + z_2 + z_3) / 3.0

    [centroid_x, centroid_y, centroid_z]
  end
end
```

We compute over nine values, but we think of three points. We can compensate for the conceptual misalignment with variable names (x_1, y_1, z_1) and comments, but there is a better solution. We can group the related coordinates into a single compound datum and call it a point.

```ruby
class Point3d
  extend T::Sig

  sig { returns(Float) }
  attr_reader :x, :y, :z

  sig { params(x: Float, y: Float, z: Float).void }
  def initialize(x:, y:, z:)
    @x = x
    @y = y
    @z = z
  end
end
```

This simplifies the code nicely.

```ruby
class GeometryCalculator
  extend T::Sig

  sig { params(p1: Point3d, p2: Point3d, p3: Point3d).returns(Point3d) }
  def self.centroid(p1, p2, p3)
    points = [p1, p2, p3]

    Point3d.new(
      x: points.sum(&:x) / 3,
      y: points.sum(&:y) / 3,
      z: points.sum(&:z) / 3
    )
  end
end
```

We need compound data to get the benefits of conceptual alignment with the domain.

{% callout %}
See Class vs Array vs Hash in the appendix to compare this to using an array or hash.
{% /callout %}

## The Need for Data Classes

Let’s try this approach with the more complicated example of a configuration object for a hypothetical email client. We have many properties, with a variety of types and some have default values.

```ruby
class EmailConfig
  extend T::Sig

  sig { returns(String) }
  attr_reader :smtp_host, :smtp_username, :smtp_password, :from_address, :from_name

  sig { returns(Integer) }
  attr_reader :smtp_port, :max_retries, :retry_delay, :timeout

  sig { returns(T::Boolean) }
  attr_reader :use_tls, :enable_tracking, :debug_mode

  sig { returns(T.nilable(String)) }
  attr_reader :reply_to

  sig { 
    params(
      smtp_host: String,
      smtp_username: String,
      smtp_password: String,
      from_address: String,
      from_name: String,
      smtp_port: Integer,
      use_tls: T::Boolean,
      reply_to: T.nilable(String),
      max_retries: Integer,
      retry_delay: Integer,
      timeout: Integer,
      enable_tracking: T::Boolean,
      debug_mode: T::Boolean
    ).void 
  }
  def initialize(
    smtp_host:,
    smtp_username:,
    smtp_password:,
    from_address:,
    from_name:,
    smtp_port: 587,
    use_tls: true,
    reply_to: nil,
    max_retries: 3,
    retry_delay: 5,
    timeout: 30,
    enable_tracking: false,
    debug_mode: false
  )
    @smtp_host = smtp_host
    @smtp_username = smtp_username
    @smtp_password = smtp_password
    @from_address = from_address
    @from_name = from_name
    @smtp_port = smtp_port
    @use_tls = use_tls
    @reply_to = reply_to
    @max_retries = max_retries
    @retry_delay = retry_delay
    @timeout = timeout
    @enable_tracking = enable_tracking
    @debug_mode = debug_mode
  end
end
```

{% callout %}
Note that we can set instance variables in the constructor without `T.let`, because we set them verbatim. Static checking [fails](https://sorbet.org/docs/type-annotations#limitations-on-instance-variable-inference) with error [7043](https://sorbet.org/docs/type-annotations#limitations-on-instance-variable-inference) if the arguments pass through any kind of expression, e.g. `@smtp_host = [smtp_host].first` or `timeout + 0`. You should only need `T.let` to create new instance variables not specified in the constructor’s sig block.
{% /callout %}

This isn’t all Sorbet’s fault. Sorbet amplifies the boilerplate, but the root cause is that classes are behavioural abstractions. They force you to model data with behaviour in the form of functions that construct, get and set. This is why object-oriented languages across the board provide a data class feature. Ruby’s answer to this is Struct, which should in principle address the boilerplate problem.

```ruby
  EmailConfig = Struct.new(
    :smtp_host,
    :smtp_username,
    :smtp_password,
    :from_address,
    :from_name,
    :smtp_port,
    :use_tls,
    :reply_to,
    :max_retries,
    :retry_delay,
    :timeout,
    :enable_tracking,
    :debug_mode,
    keyword_init: true
  )
```

At first glance, this is a big improvement, but we are still missing default values and type information. This will not actually work yet.

# Why Do We Need `T::Struct`?

Let’s add a constructor to our `Struct` to handle default values.

```ruby
  EmailConfig = Struct.new(
    :smtp_host,
    :smtp_username,
    :smtp_password,
    :from_address,
    :from_name,
    :smtp_port,
    :use_tls,
    :reply_to,
    :max_retries,
    :retry_delay,
    :timeout,
    :enable_tracking,
    :debug_mode,
    keyword_init: true
  ) do
    extend T::Sig

    sig {
      params(
        smtp_host: String,
        smtp_username: String,
        smtp_password: String,
        from_address: String,
        from_name: String,
        smtp_port: Integer,
        use_tls: T::Boolean,
        reply_to: T.nilable(String),
        max_retries: Integer,
        retry_delay: Integer,
        timeout: Integer,
        enable_tracking: T::Boolean,
        debug_mode: T::Boolean
      ).void
    }
    def initialize(
      smtp_host:,
      smtp_username:,
      smtp_password:,
      from_address:,
      from_name:,
      smtp_port: 587, # Default arguments in a constructor
      use_tls: true,  # give us a default value mechanism.
      reply_to: nil,
      max_retries: 3,
      retry_delay: 5,
      timeout: 30,
      enable_tracking: false,
      debug_mode: false
    )
      super
    end
  end
```

The boilerplate problem quickly makes a come back.

The remaining problem is typing the getters and setters, which is fatal.
Once you have typed every property of a `Struct` it is essentially a PORO again.
In fact, it’s worse.
I attempted to construct a full example, but wound up caught in the crossfire between Sorbet and Rubocop.
This is a Sorbet-specific problem that cannot be addressed with ActiveModel, `Data` or `dry-struct`. This pushes us squarely into `T::Struct`.

```ruby
class EmailConfig < T::Struct
  const :smtp_host, String
  const :smtp_username, String
  const :smtp_password, String
  const :from_address, String
  const :from_name, String
  const :smtp_port, Integer, default: 587
  const :use_tls, T::Boolean, default: true
  const :reply_to, T.nilable(String), default: nil
  const :max_retries, Integer, default: 3
  const :retry_delay, Integer, default: 5  # seconds
  const :timeout, Integer, default: 30  # seconds
  const :enable_tracking, T::Boolean, default: false
  const :debug_mode, T::Boolean, default: false
end
```

The result reads like a concise, typed specification of the data.
This is exactly what we want and `T::Struct` is the only way to get it when using Sorbet.

# When Should We Use `T::Struct`?

Let’s recap.
We need compound data, but classes are an unnatural medium for it.
Data classes are an adaptation of classes to the task of carrying data.
Sorbet wrecks Ruby’s data classes, but provides `T::Struct` in their place.
Given that, how can we recognise the right situation for a `T::Struct`?
We don’t want to leave `T::Struct` on the table, nor do we want to declare a war on boilerplate and overuse it.

We can divide the situations into four cases, based on two properties of a class:

 1. Behavioural complexity, and
 2. Number of constructor arguments.

 ![Class Design Patterns Matrix](/images/t-struct-in-context/matrix.png)

 Let’s asses each case.

 - 🙃 Unit is a trivial case and it may be better served by a module.
 
 - ✅ Data class is a no-brainer—it’s the intended purpose of T::Struct.

 - ❌ Deep class is mostly behaviour with few properties; there is little to gain from using T::Struct here.

 - ❓ God class is the grey area.

The God class has two variants.
If you are creating a genuine God class—high behavioural complexity with many collaborating classes—you might want to reconsider.
If your class simply depends on many data, you might just need compound data to simplify your code, just like the geometry example.
Instead of accepting ten constructor arguments, you could refactor your class to depend on a single configuration object.
You can make the `T::Struct` a factory to keep the nice constructor experience.

```ruby
class MyClass
  extend T::Sig

  class Builder < T::Struct
    extend T::Sig

    const :flux_capacitor_label, String
    const :interstellar_portal_number, Integer, default: 5432
    # ...

    sig { returns(MyService) }
    def build
      MyService.new(self)
    end
  end

  sig { params(config: Builder).void }
  def initialize(config)
    @config = config

    # This also separates object configuration from purely internal state variables.
    @internal_state_variable_1 = T.let(...)
    @internal_state_variable_2 = T.let(...)

    # If internal properties do not change or require side effects to produce,
    # you can shift them into memoised methods.
  end
end

object = MyClass::Builder.new(
           flux_capacitor_label: "Flux Capacitor",
           interstellar_portal_number: 5432
         ).build

T.reveal_type(object) # <MyClass:0x000000015dfdd370>
```

# Attribute Macros (`attr_accessor/reader/writer`)
If you don’t use this pattern, you may be tempted to inherit from `T::Struct` to sidestep the boilerplate that comes with attribute macros and Sorbet.
Recall the `EmailConfig` example.

```ruby
class EmailConfig
  extend T::Sig

  sig { returns(String) }
  attr_reader :smtp_host, :smtp_username, :smtp_password, :from_address, :from_name

  sig { returns(Integer) }
  attr_reader :smtp_port, :max_retries, :retry_delay, :timeout

  sig { returns(T::Boolean) }
  attr_reader :use_tls, :enable_tracking, :debug_mode

  sig { returns(T.nilable(String)) }
  attr_reader :reply_to

  ...
```

Compare the economics of attribute macros between plain Ruby and Sorbet. Plain Ruby usually has:

  1. Many attribute macros defined on a single line of code, and

  1. They mitigate the silent nil problem with instance variables.

This makes attribute macros easy to do and worth doing in plain Ruby.

{% callout %}
The silent `nil` problem occurs when referencing an undefined instance variable evaluates to `nil`.
This is a sharp edge, because returning `nil` is essentially suppressing an error, making it more difficult to diagnose.
{% /callout %}

Now consider the Sorbet case:

 1. Since attribute macros require `sig` blocks, they can spread over many lines, and

 1. Sorbet eliminates the silent nil problem by hitting undefined instance variables with type error [5005](https://sorbet.org/docs/error-reference#5005).

The investment doesn’t look so good anymore.
Attribute macros become essentially obsolete for internal instance variables.

The remaining uses for attribute macros are:
 1. Public properties,
 1. Read only properties, or
 1. Hedging against refactoring widely used instance variables.

My take on these remaining cases is that having lots of them is a smell.
You are better off designing your class to minimise them, rather than sugar coating them with the `T::Struct` DSL.
I will leave the details of the class design argument for another day.
For now, if attribute macros are bothering you, consider whether you actually need them.

# Intent Signalling

The term “struct” has historically connoted plain data across many programming languages.
It can be jarring to see a struct loaded with behaviour.
The C++ language is an interesting case study.
Since the compiler implements struct and class almost identically, intent signalling is the only difference to consider.


{% callout %}
The difference between struct and class in C++ is default visibility.
Members default to public in a `struct`, but private in a `class`.
{% /callout %}

Google’s C++ style guide provides interesting [guidance](https://google.github.io/styleguide/cppguide.html#Structs_vs._Classes).

> Use a struct only for passive objects that carry data; everything else is a class.

> The struct and class keywords behave almost identically in C++. We add our own semantic meanings to each keyword, so you should use the appropriate keyword for the data-type you're defining.

> `structs` should be used for passive objects that carry data, and may have associated constants. All fields must be public. The struct must not have invariants that imply relationships between different fields, since direct user access to those fields may break those invariants. Constructors, destructors, and helper methods may be present; however, these methods must not require or enforce any invariants.

> If more functionality or invariants are required, or struct has wide visibility and expected to evolve, then a `class` is more appropriate. If in doubt, make it a `class`.

This introduces two more angles to consider: behavioural evolution and passivity. How does `T::Struct` weigh up there?

# Evolution and Inheritance

You use `T::Struct` by inheriting from it.
This seals the class off, preventing further inheritance.
In my opinion, giving up inheritance to cut some boilerplate is not a good tradeoff.
It is hard to predict whether or not you will need inheritance in the future.
Therefore, losing inheritance is not a sane default.

{% callout %}
You can regain inheritance by switching to `T::InexactStruct`.
This disables type checking in the constructor, one of the primary draw cards for `T::Struct`.
The documentation calls this out as a [last resort](https://sorbet.org/docs/tstruct#structs-and-inheritance).
{% /callout %}

{% callout %}
The Google style guide mentions “wide visibility” as a heuristic for when to use a class.
When something is widely used, you are more likely to need flexibility.
Inheritance gives you one way to introduce some flexibility by creating variations of the base class.
{% /callout %}

## The Passive Nature of `T::Struct`
An active class encapsulates state and manages it via public methods.
A passive class keeps everything public and is acted upon by external logic.
Which is `T::Struct`?

When you run `const` and `prop` on your `T::Struct`, it [dynamically defines](https://github.com/sorbet/sorbet/blob/master/gems/sorbet-runtime/lib/types/props/decorator.rb#L440-L466) getters and setters from an external decorator.
This always creates public methods, ignoring the private keyword.

```ruby
class MyStruct < T::Struct
  const :internal_id, String

  # Rubocop detects Lint/UselessAccessModifier,
  # because there's actually no def below the private keyword.
  # There is only a method call to a decorator that makes
  # an external call to define_method.
  private

  # Public at runtime
  prop :cache, T::Hash[String, T.untyped]

  # If you add other methods here, as you would in a behaviourally complex T::Struct
  # the Rubocop lint will not show, camouflaging the issue.
end
```

The class above behaves as follows in a debugger.

```ruby
(rdbg) my_struct = MyStruct.new(internal_id: "123", cache: {})

(rdbg) my_struct.public_methods(false)
       => [:internal_id, :cache=, :cache]

# Works ✅
(rdbg) my_struct.cache["key"] = "value"
```

Why then does my IDE lint the below code as if the method were actually private?

```ruby
my_struct = MyStruct.new(internal_id: "123", cache: {})

# Static analysis ❌
# Non-private call to private method `cache` on MyStruct (7031)
my_struct.cache["key"] = "value"
```

There are two separate programs at play: `sorbet-runtime` and `sorbet`.
The runtime is what actually runs in your code, while sorbet statically checks a model of the code.
The static analyser:

 1. Already understands `private`, and

 1. [Rewrites](https://github.com/sorbet/sorbet/blob/006c8eaa4004ebf97483ff09d3f586455ed97494/rewriter/Prop.h#L8-L17) `prop` and `const` to `def`, which is **not** how the runtime implements them.

The rewriting is part of Sorbet’s custom `T::Struct` support which is required to give `T::Struct` its ergonomic advantage over `Struct`.
Unfortunately, it also causes the static model of the code to diverge from the real implementation.
The privacy type error is arguably a bug and I have reported this in issue [#9463](https://github.com/sorbet/sorbet/issues/9463).

We can hack it into line with extra calls to `private`.

```ruby
class MyHackyStruct < T::Struct
  const :internal_id, String
  prop :cache, T.nilable(Hash)

  # You can do this, but in a language where you can do anything, can != should. 
  private :cache, :cache=
end
```

If private properties were truly desired, a proper solution would be to add a visibility argument to the `T::Struct` API.

```ruby
class MyHypotheticalStruct < T::Struct
  const :internal_id, String
  prop :cache, T.nilable(Hash), private: true # Hypothetical feature 💡
end
```

The API is the maintainable way to make information available to both the static analyser and the runtime.
Since the API does not offer this, my advice is not to do it.

Ultimately, I think `T::Struct` is designed to expose all properties all the time.
We know from Sorbet’s documentation that `T::Struct` originated inside an Object Document Mapper (ODM) built at Stripe.
Mongoid is also an ODM with a DSL for defining properties.
It also has no visibility API and is [hardwired](https://github.com/mongodb/mongoid/blob/master/lib/mongoid/fields.rb#L622-L635) to create public getters and setters.
All of this points to `T::Struct` being a passive object.

# Takeaway

A `T::Struct` is objectively more concise than a PORO thanks to its DSL.
It also has the complexity of that DSL’s implementation directly inside the class, crippling inheritance and hardcoding public visibility onto your properties.
All of that complexity can be safely forgotten if you focus on intent.
Use a `T::Struct` if you intend to carry data primarily, otherwise (or if in doubt) use a PORO.
If the PORO has many constructor arguments, consider using a nested `T::Struct` as a factory, or minimising attribute macros to keep boilerplate under control.
Building substantial behaviour right into a `T::Struct` is rarely if ever necessary.
Using the right tool for the job beats cleverness.

# Appendix

## Readability

| Container | Access Pattern |
|-----------|----------------|
| Class | `points.sum(&:x) / 3` or `p1.x + p2.x + p3.x / 3` |
| Array | `(p1[0] + p2[0] + p3[0]) / 3.0` |
| Hash | `(p1[:x] + p2[:x] + p3[:x]) / 3.0` |

I think dot notation (`.x`) is the most readable. This becomes especially true with nested data (`polygon.bounding_box.corners.to_a`). You can get dot notation over a hash with `OpenStruct`, but that leads to the next downside.

## Openness and `T.nilable`

Arrays and hashes are *open*. They can contain more or less data than you require. This makes your types `T.nilable(…)`, because it is always possible at runtime that you will:

1. Execute an out-of-bounds array access, or
2. Fetch a non-existent hash key.

In Ruby, both cases return `nil`. The array and hash code above both have the same type error: `Method + does not exist on NilClass component of T.nilable(Float)`.

## Heterogeneous Types

There is one last problem with collection types.
They expect every element to have the same type. Everything is a `Float` in our example, but what if we had other types?
You can use union types like `T::Array[T.any(Float, Integer, String)]`, but this is the `nil` problem on steroids.
When a type is `T.nilable(X)`, it is essentially `T.any(nil, X)`, making you handle two cases.
When you have a union type in a collection, you have to handle `nil` and then **narrow** the type.

On paper, hashes can escape the union types problem in Sorbet via [shaped hashes](https://sorbet.org/docs/shapes).

```ruby
Point3d = T.type_alias do
  x: Float,
  y: Float,
  z: Float,
end
```

This is a very intuitive API, but a very unintuitive feature in practice.
It is so full of gotchas that a `T::Struct` is a better choice.

## Conclusion: Arrays and Hashes *of* Classes

A class is superior in the case of `Point3d` because we are modelling a domain concept.
Since `Point3d` is not really a collection, implementing it that way complicates our code.
However, we would almost certainly find use for `T::Array[Point3d]` and `T::Hash[Symbol, Point3d]`.

