# Schema and Mock Data Standards

Detailed reference for JSON Schema and mock data patterns used in component validation with Miyagi.

## Schema Files (schema.yaml)

### Basic Structure

Every component requires a JSON Schema (draft-07) definition:

```yaml
$schema: http://json-schema.org/draft-07/schema#
$id: /elements/button

type: object

required:
  - label

additionalProperties: false
properties:
  label:
    type: string
  url:
    type: string
    format: uri-reference
```

### Schema Header

```yaml
$schema: http://json-schema.org/draft-07/schema#
$id: /elements/component-name
```

The `$id` must match the component path:

- `/elements/button` for `src/components/elements/button/`
- `/patterns/accordion` for `src/components/patterns/accordion/`
- `/template-components/header` for `src/components/template-components/header/`

### Property Types

#### String

```yaml
label:
  type: string
```

#### Number

```yaml
count:
  type: number
```

#### Boolean

```yaml
disabled:
  type: boolean
```

#### Array

```yaml
modifiers:
  type: array
  items:
    type: string

items:
  type: array
```

#### Object

```yaml
attributes:
  type: object

nested:
  type: object
  properties:
    title:
      type: string
```

### String Formats

#### URI Reference

```yaml
url:
  type: string
  format: uri-reference
```

### Properties That Reference Other Components

When a property will use another component "under the hood", use this syntax:

```yaml
properties:
  property_name:
    type: string
    format: html
    description: tier/component-name
```

**Example:**

```yaml
properties:
  source_attribution:
    type: string
    format: html
    description: patterns/article-infos
```

DO NOT use `$ref` for component references in properties. The `description` field indicates which component will be used. If more than one component can be used, use a comma-separated list or a wildcard, for example: `patterns/*` or `patterns/article-infos,patterns/case-source-reference`.

### Enumerations

Restrict to specific values:

```yaml
type:
  type: string
  enum:
    - button
    - reset
    - submit

target:
  type: string
  enum:
    - _self
    - _blank
    - _parent
    - _top
```

### Default Values

When using enum values, specify the default:

```yaml
type:
  type: string
  enum:
    - button
    - reset
    - submit
  default: button

target:
  type: string
  enum:
    - _self
    - _blank
    - _parent
    - _top
  default: _self
```

### Required Properties

```yaml
required:
  - label
  - url
properties:
  label:
    type: string
  url:
    type: string
```

### Additional Properties

Always include to prevent undocumented properties:

```yaml
additionalProperties: false
```

## Mock Files (mocks.yaml)

### Variants Pattern

```yaml
$variants:
  - $name: Default
    label: Default label
  - $name: With icon
    label: Icon button
    icon: search
  - $name: Disabled
    label: Disabled button
    disabled: true
```

### Variant Naming

Use descriptive, sentence-case names:

```yaml
$variants:
  - $name: Primary button
  - $name: Secondary button with icon
  - $name: Primary disabled button
```

**Not:**

```yaml
$variants:
  - $name: primary # ❌ lowercase
  - $name: BUTTON_2 # ❌ screaming case
```

### Mock Data Guidelines

#### Realistic Data

```yaml
# ✅ Good
label: Sign up for newsletter
email: user@example.com
date: 2024-10-27

# ❌ Bad
label: Lorem ipsum
email: test@test.test
date: 01/01/2000
```

#### Semantic Values

```yaml
# ✅ Good - Describes what the variant shows
- $name: Error state
  has_error: true
  error_message: Email address is required

# ❌ Bad - Generic test data
- $name: Variant 2
  has_error: true
  error_message: Error
```

#### Referencing Existing Mock Data

```yaml
logo:
  $ref: elements/image#jobs-teaser
```

#### Edge Cases

```yaml
$variants:
  - $name: Short text
    label: OK

  - $name: Long text
    label: This is a very long button label that might wrap to multiple lines

  - $name: Empty state
    items: []

  - $name: Many items
    items:
      - Item 1
      - Item 2
      # ... 20 items
```

### Array Mock Data

```yaml
items:
  - title: First item
    description: Description text
  - title: Second item
    description: More text
  - title: Third item
    description: Additional content
```

### Nested Components

```yaml
accordion:
  items:
    - title: Section 1
      content: |
        <p>HTML content here</p>
    - title: Section 2
      content: |
        <p>More content</p>
```

### HTML in Mocks

Multiline with pipe `|`:

```yaml
content: |
  <p>First paragraph.</p>
  <p>Second paragraph with <strong>bold</strong> text.</p>
```

Single line:

```yaml
content: <p>Simple content</p>
```

### URLs in Mocks

```yaml
url: "#"          # For anchor links
url: /page        # For internal pages
url: url          # Generic placeholder (miyagi converts)
```

### Icons

Reference icon names from sprite:

```yaml
icon: search
icon: close
icon: menu
```

Available icons in: `src/svg/icons/`

## Reusing Schemas

For sub-components, reference parent schemas:

```yaml
# In accordion-item/schema.yaml
$schema: http://json-schema.org/draft-07/schema#
$id: /patterns/accordion/accordion-item
# Define item-specific properties
```

Then in parent:

```yaml
# In accordion/schema.yaml
items:
  type: array
  # Items validated by accordion-item schema
```

## Validation

### Miyagi Validation

```bash
node --run lint:cl
```

Validates:

1. Schema is valid JSON Schema
2. All mock variants match the schema
3. Required properties are present
4. Property types are correct

### Common Errors

#### Missing Required Property

```yaml
# ❌ Error: 'label' is required
$variants:
  - $name: Button
    icon: search
```

Fix:

```yaml
# ✅ Correct
$variants:
  - $name: Button
    label: Button text
    icon: search
```

#### Wrong Type

```yaml
# ❌ Error: 'disabled' must be boolean
disabled: "true"
```

Fix:

```yaml
# ✅ Correct
disabled: true
```

#### Additional Properties

```yaml
# ❌ Error: 'unknownProp' not in schema
$variants:
  - $name: Button
    label: Text
    unknownProp: value
```

Fix: Add to schema or remove from mocks.

## YAML Formatting

### Indentation

Use **2 spaces** (not tabs):

```yaml
properties:
  label:
    type: string
```

### Boolean Values

Use lowercase:

```yaml
disabled: true
required: false
```

### Null Values

```yaml
value: null
```

### Comments

```yaml
# This is a comment
properties:
  label: # Inline comment
    type: string
```
