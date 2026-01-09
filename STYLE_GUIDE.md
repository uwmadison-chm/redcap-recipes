# REDCap Recipes Style Guide

## Audience

Readers are familiar with REDCap. Explain non-obvious behaviors and gotchas, but don't define basic REDCap concepts.

## Recipe Structure

Each recipe should have:

1. **Frontmatter** (YAML):
   - `title`: Clear, action-oriented (e.g., "Stopping Alerts and ASIs")
   - `description`: One-sentence summary of what the recipe solves
   - `categories`: Relevant tags (lowercase, use existing categories when possible)

2. **Overview section** with:
   - **Problem:** One paragraph describing the challenge
   - **Solution:** One paragraph describing the approach (not detailed steps)

3. **Prerequisites section**: Bulleted list of what must exist before starting

4. **Steps section**: Numbered list with clear, actionable instructions

5. **Notes section** (optional): Important behaviors, caveats, or warnings

## Writing Style

### Tone
- Direct and practical
- Assume the reader will adapt field names and specifics to their project
- Explain surprising REDCap behaviors explicitly

### Formatting

**REDCap terminology:**
- Use backticks for field names: `email`, `no_contact`
- Use backticks for REDCap elements: `@CALCTEXT`, `@HIDDEN`, `@READONLY`
- Use backticks for form names: `tracking`, `baseline`

**UI navigation:**
- Bold each menu level, separate with `>`
- Example: **Project Setup** > **Designate an email field for communications**

**Lists:**
- Nest bullets/sub-bullets with 4 spaces
- Use `*` for unordered lists
- Use `1.` for all numbered items (Markdown auto-numbers)

**Emphasis:**
- Use **bold** for UI elements and emphasis
- Use _italics_ sparingly, mainly for subtle emphasis
- Use backticks for technical terms, not emphasis

## Common Patterns

### Referring to field types
"A Yes/No field" not "a checkbox" or "a yes/no field"

### Talking about forms
"The `tracking` form" not "the Tracking form" (use backticks, lowercase)

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
- Warning messages from REDCap should be quoted exactly

## Grammar and Style

- Use contractions sparingly
- Write in active voice; you are writing a list of steps for someone to follow
- Use sentence case for headings
- Prefer "participant" over "subject"
