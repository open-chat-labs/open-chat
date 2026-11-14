# New web UI (`src/web`)

The new OpenChat web UI, built from `@openchat/ui` (`frontend/openchat-ui`), for desktop widths. It
replaces the view layer of `src/components`. Phones (`src/components_mobile`, in the apps and in a
browser) get the native tree (`src/native`) instead, at its cutover (native plan N15). Routes,
stores, the `OpenChat` client and every backend call stay as they are.

`frontend/CLAUDE.md` applies here too, in particular "Reuse before writing" and "The client". This
file adds what is particular to the web tree.

## Running it

It is opt-in per build with `OC_WEB_LAYOUT=v3`. That's a build-time flag: a build without it leaves
this tree and `@openchat/ui` out of the bundle altogether.

- dev: `npm run dev:web` (from `frontend/`)
- build: `OC_WEB_LAYOUT=v3 npm run build:prod_test` (or any other web build script)

Native builds leave it out for now (see `GAPS.md`).

`selectLayout` (`utils/layout.ts`) mounts it on viewports of 768px and up, picked once at load.
Between 768px and the shell's minimum width (919px) it scrolls sideways. Narrower viewports get the
old mobile UI until N15, and the native tree after it: in a build that also has the native tree
(`OC_NATIVE_LAYOUT=v4`, `src/native`), every viewport below 768px and tablets in portrait get that.
The web tree has no narrow layout of its own (PLAN 10b: the narrow pass was dropped on 2026-11-14).

A window resized across 768px isn't re-laid out: it's offered a reload of the same URL, which picks
again (`shell/LayoutSwitchBanner`, from `logic/layout`, which the old trees show too; GAPS.md,
"Layout switch").

## Layout

```
web/
  App.svelte     root: styles, behaviours, i18n bridge, theme on <html>, the client
  ROUTES.md      every URL and what each column shows for it
  DATA.md        where each screen's data and actions come from in the app
  GAPS.md        what the app or the library is missing
  PLAN.md        the work left: what has to come first, and a pool of workstreams to claim
  router/        the router (page.js registration, web-only route effects) and what each route
                 shows (regions.ts)
  shell/         nav rail, the three columns and the breakpoints, overlays
  features/      one folder per screen/feature (chats, conversation, wallet, …):
    XScreen.svelte   reads stores / the client, renders @openchat/ui components, calls the client
    x.adapter.ts     reshapes client data into component props (see Rules), with a spec
    app/screens.ts   which screen shows in each region kind; a new screen sets its entry there
    app/dialogs.ts   which screen each dialog shows (linked by a query param, or opened locally)
```

Outside this folder, and shared with the legacy trees while they live (`frontend/CLAUDE.md`, "Where
code goes"): `app/src/logic` (flow state) and `app/src/core` (components with behaviour but no look,
such as `ChatEventList` and `Markdown`).

Shared with the native tree (`src/native`), which reads the same URLs: the route table
(`utils/routeTable.ts`), the route effects every new tree runs (`core/RouteEffects.svelte`), the
library's i18n bridge (`i18n/openchatUi.ts`: `@openchat/ui`'s copy merged into svelte-i18n, and the
translator it is given) and the stored accent (`theme/accent.ts`).

## Rules

- A region's screen is plugged in by setting its entry in `features/app/screens.ts`
  (`() => import("../x/XScreen.svelte")`); it gets `{ region, context }`. `AppScreen` doesn't
  change for it.
- A dialog is plugged in the same way, by its entry in `features/app/dialogs.ts`; it gets
  `{ dialog, onClose }`. A dialog people link to is a query param (`linkedDialog`); one the app
  opens itself is a `LocalDialog`, opened with `context.dialogs.open(…)` and closed before any
  navigation and on Back. `DialogHost` shows both.
- Only `XScreen` components touch the client or the stores. Everything they render, `@openchat/ui`
  components and the screen's own sub-components alike, gets data through props and reports
  actions through callbacks.
- An adapter only reshapes: a pure, stateless function from client data (one or several stores'
  worth) to the props a library component takes. It makes no decisions and builds no text: no
  sentences, no plurals, no i18n, no classes, no caches. Text and decisions come from `@client`
  functions or `app/src/logic`, extracted from the legacy component if that's where they are now.
  A format or locale mismatch with the library (dates, amounts) is fixed in the library.
- Import library components by file (`@openchat/ui/src/lib/components/Button.svelte`), not from the
  package entry, so a build only pulls in what it uses.
- Don't edit `@openchat/ui` to fit the app.
  A change the library needs goes back to the design export; note it in `GAPS.md`. When the app
  can't wait for it, make the change by hand in the library (with its `EXPORT-LOG.md` entry) and
  list it in `GAPS.md` under the changes to take back.
- From the existing app, reuse what's in `app/src/core` and `app/src/logic`, plus `Container`,
  `Row` and `Column` (component-lib) for layout. Nothing from `src/components`,
  `src/components_mobile` or `src/components_shared`: if something there is needed, it moves to
  `core` or `logic` first (`frontend/CLAUDE.md`, "Reuse before writing").
- Colours and font sizes come from the library's tokens only. No hex.
- Styles are `<style lang="scss">` (`scss.spec.ts`), with nesting and the library's mixins: a
  block that uses them starts with `@use '@openchat/ui/src/lib/styles/mixins' as *;`. Never the
  legacy `src/styles/mixins.scss`, which `app/svelte.config.js` gives the legacy trees only.
  Values stay CSS custom properties.
- The URL holds the selected chat / community / channel, the message deep link, the open thread,
  the wallet view and token, and the explore query. Everything else is local UI state.
- Where the design has nothing yet, keep the existing app's behaviour and leave a
  `TODO(design)` comment.
- Specs test logic only: adapters, and any decision a screen makes, pulled out into a function
  to test it (usually in `@client` or `app/src/logic`, where it belongs anyway). No specs that mount a component and query its
  DOM, here or for hand changes in the library: markup changes break them. To settle a doubt about
  how a screen behaves (a review comment, say), write one, run it, and don't commit it.
