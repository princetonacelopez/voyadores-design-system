# Voyadores Design System

The single source of truth for Voyadores' visual language — covering brand identity, color, typography, icons, illustrations, and UI components for every product we build.

Live site: **[design.voyadores.com](https://design.voyadores.com)**

---

## Tech stack

- [Astro v6](https://astro.build) — static site generator
- Vanilla CSS with CSS custom properties (light + dark mode)
- Voyadores Icon Font (1,300+ icons, regular & solid weights)
- Bootstrap 5 (component demos)

---

## Project structure

```
src/
├── components/       # Sidebar, PageHeader, ColorSwatch, FontSpecimen
├── data/             # icons.json (icon name list)
├── layouts/          # BaseLayout.astro (shell, theme toggle, cursor)
├── pages/            # One .astro file per route
│   ├── index.astro
│   ├── introduction.astro
│   ├── strategy.astro
│   ├── logo.astro
│   ├── typography.astro
│   ├── color.astro
│   ├── images.astro
│   ├── iconography.astro
│   ├── illustrations.astro
│   ├── language-and-grammar.astro
│   ├── resources.astro
│   ├── components/   # Component demo pages
│   └── docs/         # Technical reference pages
public/
├── fonts/            # Voyadores Icon Font files
├── icons/            # SVG icon assets (banks, government, file types…)
└── images/           # Illustrations, state graphics, logos
```

---

## Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `http://localhost:4321` |
| `npm run build` | Build static site to `dist/` |
| `npm run preview` | Preview the production build locally |

---

## Deployment

The project builds to a fully static `dist/` folder.

**Netlify (recommended)**
1. Connect the repo in the Netlify dashboard
2. Build command: `npm run build`
3. Publish directory: `dist`

**Vercel**
```bash
npx vercel
```

**Manual / any static host**  
Run `npm run build` and upload the `dist/` folder.

---

## Contributing

This is an internal design system for Voyadores. For questions or updates, reach out to the design team.
