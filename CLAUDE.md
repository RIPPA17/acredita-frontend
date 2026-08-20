# acredita-frontend

React 19 + TypeScript + Vite SPA (Tailwind CSS v4, react-router-dom). Source lives in `src/` (`components/`, `pages/`, `data/`).

Scripts: `npm run dev` (serve), `npm run build`, `npm run preview`, `npm run lint` (`tsc --noEmit`, no test script exists).

## Working efficiently in this repo

- Prefer `Grep`/`Glob` over reading whole files when only a symbol or pattern is needed; only `Read` full files you're about to edit.
- Use the `Explore` agent for open-ended searches across `src/` instead of multiple manual greps.
- Run `npm run lint` (not a manual TS read-through) to check types after edits.
- Keep this file short — add only durable, project-wide facts here, not task-specific notes.
