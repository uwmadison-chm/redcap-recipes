# REDCap Recipes

Practical guides and recipes for working with REDCap (Research Electronic Data Capture).

Live site is at [https://uwmadison-chm.github.io/redcap-recipes/](https://uwmadison-chm.github.io/redcap-recipes/)

## About

This site is a collection of solutions to REDCap challenges that we've found over the years. It's not a general REDCap guide. The book is site is built using [Quarto](https://quarto.org).

## Local Development

### Prerequisites

- [Quarto](https://quarto.org/docs/get-started/) (optional, but recommended for local preview)

### Preview the Site

To preview the site locally:

```bash
quarto preview
```

This will:
- Start a local web server
- Open the site in your browser
- Auto-refresh when you save changes

### Build the Site

To build the site without starting a server:

```bash
quarto render
```

**Note:** You don't need to build locally before pushing. GitHub Actions automatically renders and deploys the site when you push to the `main` branch.

## Deployment

This site uses GitHub Actions for automatic deployment:

1. Push changes to the `main` branch
2. GitHub Actions automatically renders the Quarto site
3. The built site is deployed to GitHub Pages
4. Changes appear live within 2-3 minutes

### Recipe Structure

Each recipe should include:

- **YAML frontmatter** with title, description, date, and categories
- **Overview** - Problem statement and solution summary
- **Prerequisites** - What users need before starting
- **Solution** - Step-by-step instructions with code examples
- **Complete Example** - Full working code
- **Notes and Tips** - Important considerations
- **Troubleshooting** - Common issues and solutions
- **Related Resources** - Links to relevant documentation

See `recipes/example-recipe.qmd` for a complete template.

## Project Structure

```
redcap-recipes/
├── _quarto.yml              # Quarto configuration
├── index.qmd                # Home page
├── recipes/                 # Recipe content
│   ├── index.qmd            # Recipes landing page
│   └── *.qmd                # Individual recipes
├── assets/                  # Images and custom CSS
│   ├── images/
│   └── css/
├── .github/workflows/       # GitHub Actions
│   └── publish.yml          # Auto-deploy workflow
└── README.md                # This file
```

## Technology

- **[Quarto](https://quarto.org/)** - Scientific and technical publishing system
- **[GitHub Pages](https://pages.github.com/)** - Static site hosting
- **[GitHub Actions](https://github.com/features/actions)** - Automated deployment

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Maintainers

Maintained by the [Center for Healthy Minds](https://centerhealthyminds.org/) at the University of Wisconsin-Madison.