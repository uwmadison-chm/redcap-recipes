# REDCap Recipes Style Guide

## Audience

Readers are familiar with REDCap. Explain non-obvious behaviors and gotchas, but don't define basic REDCap concepts.

## Recipe Structure

Each recipe should have:

1. **Frontmatter** (YAML):
   - `title`: Clear, action-oriented (e.g., "Stopping Alerts and ASIs")
   - `description`: One-sentence summary of what the recipe solves
   - `categories`: Relevant tags (lowercase, use existing categories when possible)
1. **Overview section** with:
   - **Problem:** One short paragraph describing the challenge
   - **Solution:** One short paragraph describing the approach (not detailed steps)
1. **Prerequisites section**: Bulleted list of what must exist before starting
1. **Steps section**: List with clear, actionable instructions. No numbers.
1. **Notes section** (optional): Important behaviors, caveats, or warnings
1. (Optionally) **Troubleshooting section:** List common troubleshooting actions

## Writing Style

### Tone
- Direct and practical
- Assume the reader will adapt field names and specifics to their project
- Explain surprising REDCap behaviors explicitly

### Formatting

**UI navigation:**
- Bold each menu level, separate with `>`
- Example: **Project Setup** > **Designate an email field for communications**
- Generally don't include subsections of pages, unless talking about the section in question

**Lists:**
- Nest bullets/sub-bullets with 4 spaces
- Use `-` for unordered lists
- Use `1.` for all numbered items (Markdown auto-numbers)
- Only use numbered lists when you are enumerating steps -- if it's "do this, here are reasons" you probably want bullets

**Emphasis:**
- Use **bold** for UI elements and emphasis
- Use _italics_ sparingly, mainly for subtle emphasis
- Use backticks for form/field names and calculations, not emphasis

**Warnings and traps:**
- Use a `::: {.callout-warning}` block.

## Common Patterns

### Project and REDCap terminology:
- Use backticks for field names: `email`, `no_contact`
- Use backticks for REDCap elements: `@CALCTEXT`, `@HIDDEN`, `@READONLY`
- Use backticks for form names: `tracking`, `baseline`
- Instrument, form, or survey? "Instrument" is generic. "Form" means it faces staff. "Survey" means it's accessible to participants.

### Abbreviations
- Spell out common REDCap terms once with the abbreviation in parentheses, then use the abbreviation throughout the rest of the document
- Example: "Automated Survey Invitation (ASI)" in the overview, then "ASI" in all subsequent sections
- Assume readers are familiar with standard REDCap abbreviations

### Listing field definitions
- Only list the parts of the field definition that are required to make a functional example
- In most cases, do not list Field Label or Field Note, or indicate blank Minimum or Maximum values
- Counterexamples might be when illustrating Field Embedding or piping to make a clean dashboard

### Referring to field types
Use REDCap terminiology: "A Yes/No field" not "a checkbox" or "a yes/no field." "a @CALCTEXT field," not "a calculated text field."

### Talking about instruments
"The `morning_diary` survey" not "the Morning diary survey" (use backticks, lowercase, underscore)

### Describing calculations
Include the full `@CALCTEXT()` or `@CALCDATE()` syntax in code blocks or inline with backticks. You should be able to paste the calculation where it goes and have it work.

### File naming
- Recipe directories: `snake_case` (e.g., `stopping_alerts_asis/`)
- Each recipe is in `recipes/<recipe_name>/index.qmd`
- Include `index.qmd` for each recipe

## Technical Accuracy

- Test all recipes on REDCap version 15.6.1 or note version requirements
- Assume standard REDCap installation (no external modules unless specified)
- No admin access required (note if API access is needed)
- REDCap UI elements and warnings may be shortened if long, but not reworded — if we mention REDCap text in a recipe, you should be able to find that exact text in the REDCap UI

## Grammar and Style

- Write in active voice; you are writing a list of steps for someone to follow
- Use sentence case for headings
- Prefer "participant" over "subject"
