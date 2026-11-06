# The native tree (`src/native`)

The iOS and Android apps (Tauri) and phones' browsers, built to the native design (`docs/`) from
`@openchat/ui`'s shell kit (`@openchat/ui/src/native`) and its library. It replaces
`components_mobile` at cutover (N15). The work left is in `PLAN.md`.

`frontend/CLAUDE.md` applies here, and so do `src/web/README.md`'s rules (screens, adapters, the
library, styles, specs): this file only adds what's particular to the native tree.

## Running it

It's opt-in per build with `OC_NATIVE_LAYOUT=v4`, a build-time flag: a build without it leaves this
tree out of the bundle, and `components_mobile` stays the native UI.

- dev: `npm run dev:native` (from `frontend/`; it has the new web UI too, for wide windows)
- build: `OC_NATIVE_LAYOUT=v4 npm run build:prod_test`, or `export OC_NATIVE_LAYOUT=v4` in
  `build_android.sh` / `build_ios.sh` for the apps (which also take the web build over the air)

`selectLayout` (`utils/layout.ts`) picks it once per load: always in the apps; in a browser, on a
touch-first device (a coarse pointer that can't hover) below 1024px, or on any viewport below 768px
that isn't a desktop pointer's. A narrow desktop window stays on the desktop site. A stored "desktop
site / mobile site" choice (`configKeys.layoutOverride`) beats that. Resizing never swaps trees;
switching is a reload of the same URL.

## Layout

```
native/
  App.svelte     root: styles, the i18n bridge, the client, the native root on <html>
                 (data-platform, data-os, data-mode, data-accent, --text-scale), haptics, and the
                 native apps' setup (listeners before svelteReady)
  platform.ts    iOS or Android: the app's own, else the user agent's
  docs/          the design: Build Brief, Design Notes, Component Changes
  PLAN.md        the epic's workstreams
  router/
    Router.svelte    registers the shared route table with page.js, runs the shared route effects,
                     and opens what a cold start parked (a call, a deep link, a notification tap)
    locations.ts     where each URL is: its tab and the stack on it
  shell/
    Shell.svelte     the tabs' roots, the pushed screens and their motion, the tab bar, Back
    tabStacks.svelte.ts  each tab's stack, kept across tab switches
    overlays.svelte.ts   open sheets and menus, which Android's back closes first
    back.ts          what Android's system back does
    motion.ts        the push transitions
    tabBar.adapter.ts    the tab bar's tabs
    tabSwipe.ts      the swipe between tabs, and a tab switch's two-screen slide
    Toasts.svelte    the app's toast as the kit's
  features/      one folder per screen/feature, as in src/web:
    app/screens.ts   which screen shows for each kind; a new screen sets its entry there
    app/ScreenHost.svelte  loads it, or shows a placeholder until it's built
```

Shared with the web tree rather than copied: the route table (`utils/routeTable.ts`), the route
effects (`core/RouteEffects.svelte`), the library's i18n bridge (`i18n/openchatUi.ts`), the stored
accent (`theme/accent.ts`), and the native apps' setup (`utils/native/nativeApp.ts`, shared with
`components_mobile`).

## Rules

- **One route table.** The native tree reads the web tree's URLs and never makes up its own:
  `router/locations.ts` maps each onto a tab and a stack (`/chats/user/x` is the Chats tab with the
  list, then the conversation), so the same URL opens the same place in either tree. A screen that
  has no URL on the web (details, a settings page, a builder) will be pushed without one, as the web
  opens a local dialog: `TabStacks` gets local pushes with the first screen that needs them (GAPS).
- **Navigate by URL.** Going deeper is `navigate(url)`; the stacks follow the URL (`TabStacks.arrive`):
  a screen already in the stack is popped back to, a deeper one is pushed, a sideways one replaces
  what's above the screen in common. Back is `navigate(stacks.backUrl(), "dismiss")`, which goes back
  through the history when the entry is there.
- **Screens.** A screen is plugged in by setting its entry in `features/app/screens.ts`; it gets
  `{ screen, context }`, `context.back` being a pushed screen's Back. Only screens touch the client
  and the stores, as in `src/web`.
- **Sheets and menus** register while they're open (`useOverlay(context.overlays, …)`), so Android's
  system back closes them before it pops the screen.
- **The tab bar** shows only on a tab's root; every pushed screen has the whole window (`showsTabBar`).
- **Between tabs**: on a tab's root, a sideways drag swipes to the neighbouring tab in the bar's
  order (touch and pen; `tabSwipe.ts`), through the same navigation as a tap. A tab switch slides
  only the old screen and the new one. A tab root with something that scrolls sideways leaves drags
  that start in it to it; anything else that wants horizontal drags marks itself
  `data-tab-swipe="off"`.
- **Platform differences** are only the Design Notes' §2 ones, through `data-os` on `<html>` (the
  kit's back arrow, kebab and touch targets read it). Don't add others.
- **Haptics** go through the kit's `haptic()`; the root installs the device's (`setHaptics`), and
  mobile web has none.
- Styles, tokens and specs as in `src/web` (`scss.spec.ts` checks the styles here too). No specs
  that mount a component.
