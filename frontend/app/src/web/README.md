# New web UI (`src/web`)

The new OpenChat web UI, built from `@openchat/ui` (`frontend/openchat-ui`). It replaces the view
layer of `src/components` only: routes, stores, the `OpenChat` client and every backend call stay
as they are.

## Running it

It is opt-in per build with `OC_WEB_LAYOUT=v3`. That's a build-time flag: a build without it leaves
this tree and `@openchat/ui` out of the bundle altogether.

- dev: `npm run dev:web` (from `frontend/`)
- build: `OC_WEB_LAYOUT=v3 npm run build:prod_test` (or any other web build script)

Native builds leave it out for now (see `GAPS.md`).

`selectLayout` (`utils/layout.ts`) mounts it on viewports of 768px and up. Narrower viewports keep
getting the existing apps until the narrow layouts are designed.

## Layout

```
web/
  App.svelte     root: styles, behaviours, i18n bridge, theme on <html>, the client
  i18n.ts        @openchat/ui's copy merged into svelte-i18n, and the translator it is given
  ROUTES.md      every URL and what each column shows for it
  DATA.md        where each screen's data and actions come from in the app
  GAPS.md        what the app or the library is missing
  PLAN.md        the work left, by phase, split into workstreams two people can take
  router/        the route table (every path, in page.js order), the router and its route effects,
                 and what each route shows (regions.ts)
  shell/         nav rail, the three columns and the breakpoints, overlays
  features/      one folder per screen/feature (chats, conversation, wallet, …):
    XScreen.svelte   reads stores / the client, renders @openchat/ui components, calls the client
    x.adapter.ts     pure mapping from client data to component props, with a spec
    app/screens.ts   which screen shows in each region kind; a new screen sets its entry there
```

## Rules

- A region's screen is plugged in by setting its entry in `features/app/screens.ts`
  (`() => import("../x/XScreen.svelte")`); it gets `{ region, context }`. `AppScreen` doesn't
  change for it.
- Only `XScreen` components touch the client or the stores. `@openchat/ui` components get data
  through props and report actions through callbacks.
- Import library components by file (`@openchat/ui/src/lib/components/Button.svelte`), not from the
  package entry, so a build only pulls in what it uses.
- Don't edit `@openchat/ui` to fit the app.
  A change the library needs goes back to the design export; note it in `GAPS.md`. When the app
  can't wait for it, make the change by hand in the library (with its `EXPORT-LOG.md` entry) and
  list it in `GAPS.md` under the changes to take back.
- From the existing app, only `Container`, `Row`, `Column` (component-lib) and `VirtualList`
  (`components_shared`) are reused, for layout, and `CanisterMapFrame` (`components_shared`),
  the interactive canister map Learn's Architecture page frames. Nothing else from
  `src/components`.
- Colours and font sizes come from the library's tokens only. No hex.
- The URL holds the selected chat / community / channel, the message deep link, the open thread,
  the wallet view and token, and the explore query. Everything else is local UI state.
- Where the design has nothing yet, keep the existing app's behaviour and leave a
  `TODO(design)` comment.
- Specs test logic only: adapters, the client calls (`signIn.ts`), and any other decision a screen
  makes, pulled out into a function to test it. No specs that mount a component and query its
  DOM, here or for hand changes in the library: markup changes break them. To settle a doubt about
  how a screen behaves (a review comment, say), write one, run it, and don't commit it.
