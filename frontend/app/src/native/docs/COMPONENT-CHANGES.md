# Native — component changes

Every change made to a `lib/` component while building the native screens (`Native Prototype.dc.html`, `options/Native - *.dc.html`), grouped by component. Use it to update the components already in the code repository. Everything defaults to the existing web behaviour unless marked **web-visible**. The dated export log is `docs/Svelte Export - Log.md`.

Last updated: 2026-11-02. Nothing below has been re-exported to Svelte yet; that's a separate step.

## Changed components

### AchievementToast
- **`speed`** (number, default 1): scales every duration, delay and timer, including the CHIT count-up. Native uses 1.25.
- **`outroSpeed`** (number, default 1): speeds up only the collapse and fade after the hold. Native uses 1.8.
- **`kicker`** override (e.g. "Challenge solved") is passed by native; no change needed if it already exists in your copy.

### ActivityRow (**web-visible**)
- Unread rows no longer get a background tint; the accent dot alone marks unread.

### Button
- **`size`:** `"md"` (40px) or `"lg"` (52px, 14px radius).
- **`icon`:** icon name shown before the label (16px; 18px at `lg`). Empty `label` + `icon` = square icon button with no gap or side padding; pair with `ariaLabel`.
- **`ariaLabel`:** forwarded to the clickable element.
- **Label never wraps** (**web-visible** only where a label overflowed): single line with ellipsis.

### ChatBubble
- **`mirror`:** moves grouped/tail corner rounding to the inline-end side, for right-aligned sent bubbles.
- **`forwarded`:** shows the "Forwarded" label (passed by native; check your copy supports it).

### ChatRow
- **Pin icon** `--ink-4` → `--accent` (**web-visible**).
- **`locked`:** 13px lock before the title.
- **`previewIcon`:** small icon before the preview text (native passes "forward").
- **`fav`, `muted`:** row status icons, used by the native long-press menu.

### ClaimCalendar
- Always a 6-week grid (42 cells), neighbouring months' days dimmed and inert, so its height never changes.
- Larger cells (58px, radius md) and type (day 13.5px, amount 11px, weekday 11.5px).

### ClaimHistoryDialog (**web-visible**)
- Max width 600px; spacing tokens given pixel fallbacks.

### Confetti
- **`within`** (CSS selector): clips the burst to the nearest matching ancestor's box and radius instead of the viewport. Native: `within="[data-screen-label]"`.

### MessageComposer
- **`emojiPlacement` / `plusPlacement`:** `"start"` (web) or `"end"` (iOS emoji / Android plus).
- **`onPlus`, `plusActive`, `onEmoji`, `emojiActive`, `onInputFocus`, `insert`:** let the host replace the popovers with keyboard-area panels.
- **CSS variables:** `--composer-radius`, `--composer-min-h`, `--composer-pad`, `--composer-btn`, `--composer-btn-radius`.
- Markup fix around the + button (**web-visible**, no visual change). New icons `keyboard`, `backspace`.

### ProgressTimeline (**web-visible**)
- Funds line background `surface-2` → `overlay-1`.

### PuzzleDialog
- **`layout`:** `"dialog"` (default) or `"screen"` (fills its container on surface-0, back button, no veil or card chrome). With `topInset`, `backIcon`, `backFlip`.
- **Screen layout:** tutorial with centred dots, text Back / Next and an inline Start pill; play view with the board centred and Undo / Reset / Hint (48px) at the bottom; solved view centred (160px trophy, countdown pill, tiles) with Share to chat + Done (48px) at the bottom. Light-theme fixes for the board circles and tutorial dots.
- **`holdSolved` / `solvedReady`:** hold the solved view until the host's celebration ends.

### WalletPanel / WalletMain / BalanceCard / PageHeader (**web-visible**)
- Token rows: symbol + price pill over full name; amount (no symbol) over value. No per-token daily change.
- Empty wallet (`BalanceCard empty`), split Your tokens / Small balances / Supported tokens, Supported tokens picker, Copy ledger ID, token page hero aligned with native, `PageHeader titleTag` (price pill). See `docs/Fix Brief - Wallet Empty State and Token Page.md`.

### WalletSwap (**web-visible**)
- Quotes come from every supported exchange; the best is shown and named.

### tokens.css / icons
- Native light override (`[data-platform="native"][data-mode="light"]`): white `surface-0/1`, `#F4F3EF` `surface-2` and `field`; `--hero-base`, `--tint-row`, `--tint-pill`.
- New icons: `volume`, `headphones`, `phone-ear`, `keyboard`, `backspace`, `chart` (regenerate `icons.css`).

## Overridden per screen, not changed in the library
- **`SegmentedTabs`** made compact with `--control-xl: 40px; --space-4: 3px` on a wrapper.
- **`SortableInputList`** fill matched with `--field: var(--overlay-1)`.

## Native patterns built inline (candidates for components)
- **Tab bar:** icon-only, badge/dot, avatar for You, tap bounce.
- **Page header:** back, title or avatar + name + sub, trailing icon buttons.
- **Bottom sheet:** handle, slide in/out, drag to close, rubber-band, fixed-height content states.
- **Anchored menu** and **row long-press menu** (dim + blur, lifted row copy, submenus in place).
- **Message long-press menu:** bubble stays put; reactions + action card placed around it.
- **Settings row kit:** switch, value, link, copy, segmented, swatches, meter, action.
- **Code tiles:** six tiles over one hidden input (linking code).
- **Community strip ↔ sheet** and **composer attach / emoji panels:** one surface driven by a 0–1 factor.

## MediaViewer — 2026-11-03
- Fits its container (container query units), not the window; side padding clamps between 12px and 72px. New `topInset` (status-bar space) for native. Web looks the same at desktop sizes.

## MessageComposer — 2026-11-03
- Edit/focus ring outside the field; reply/edit card concentric with the composer; card-to-input gap 6px. Web-visible (same fixes).
