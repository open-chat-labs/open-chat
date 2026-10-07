# OpenChat frontend

One npm package (`package.json` in this folder) holds several source trees. They import each other through path aliases (`@client`, `@shared`, `@agent`, `@worker`, `@src`, `@shared_components`), not as separate packages.

### app

The Svelte website. `app/src/components/` is the desktop layout, `app/src/components_mobile/` the mobile layout, and `app/src/components_shared/` the components both use.

### openchat-client (`@client`)

The interface the app uses: functions on the `OpenChat` class plus the reactive state the app reads. It starts the worker and talks to it asynchronously. The app imports it only through `@client`, never a path inside it.

### openchat-worker (`@worker`)

A thin layer that gives the client correlated async access to the agent over `postMessage`.

### openchat-agent (`@agent`)

Everything that talks to the OpenChat canisters, plus the IndexedDB caches. It runs inside the web worker to keep that work off the UI thread. The app never imports it directly.

### openchat-shared (`@shared`)

The domain model, used by the client and the agent. The client re-exports it, and the app may import it directly too.

### component-lib

Pure UI components with no business logic, used by the mobile layout.

### Other folders

- `openchat-service-worker`: the service worker (push notifications, caching).
- `src-tauri`, `tauri-plugin-oc`: the native Android and iOS shell.
- `eslint-rules`: the project's own lint rules, with specs for the lint config.

## Running locally

Run `npm i` in this folder, then `npm run dev`. That starts Vite on port 5001 (set `OC_DEV_PORT` to change it), reading settings from `frontend/.env`. The app talks to a local replica on port 8080.

## Checks

- `npm run test`: the Vitest suite, run from the root `vitest.config.ts`. Specs sit next to the code as `*.spec.ts`.
- `npm run lint`: ESLint over `.ts`, `.js` and `.svelte` files (it fixes what it can).
- `npm run typecheck` and `npm run typecheck:agent`: svelte-check for the app and client, tsc for the agent.
- `npm run check:ci`: all of the above, as CI runs them.

## Formatting

Prettier formats the code, with `prettier-plugin-svelte` for components. In VS Code, install the Svelte, Prettier and ESLint extensions and add:

```
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "[svelte]": {
        "editor.defaultFormatter": "svelte.svelte-vscode"
    },
```
