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

`selectLayout` (`utils/layout.ts`) picks it once per load: always in the apps; in a browser, on any
viewport below 768px, narrow desktop windows included (the web tree is for desktop widths only, web
PLAN 10b), or on a touch-first device (a coarse pointer that can't hover) below 1024px. A stored
"desktop site / mobile site" choice (`configKeys.layoutOverride`) beats that. Resizing never swaps
trees; switching is a reload of the same URL, which the web tree offers in a banner when its window
is narrowed below 768px. This tree doesn't offer the way back yet (N15).

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
    Shell.svelte     the tabs' roots, the pushed screens and their motion, the tab bar, Back;
                     signed out, the start (features/start); a marketing page opens in the browser
    tabStacks.svelte.ts  each tab's stack, kept across tab switches
    overlays.svelte.ts   open sheets and menus, which Android's back closes first
    back.ts          what Android's system back does
    systemBack.ts    where it comes from (Tauri's back button and MainActivity's)
    motion.ts        the push transitions, iOS's: a push slides in over the screen under it, which
                     moves 28% out (.34s); Back slides it off as that one comes back (.24s)
    tabBar.adapter.ts    the tab bar's tabs
    tabSwipe.ts      the swipe between tabs, and a tab switch's two-screen slide
    Toasts.svelte    the app's toast as the kit's
    toastFloors.svelte.ts  where toasts sit over a footer that grows: the top screen's say
  features/      one folder per screen/feature, as in src/web:
    app/screens.ts   which screen shows for each kind; a new screen sets its entry there
    app/screenModules.ts   the screens' chunks, loaded once and kept, preloaded while idle
    app/ScreenHost.svelte  shows it, or a placeholder until it's built
    chats/           the Chats tab: the list, its search, New chat
    conversation/    a conversation (N5b): the header and its menu, search in the chat, the
                     messages on core/ChatEventList, the swipes, typing, call items; its composer
                     (N5c: ConversationComposer) and the slot under it that the keyboard and the
                     emoji and attach panels share (keyboardSlot), a panel's surface and its drag
                     (KeyboardPanel, panelState, panelDrag); the emoji the emoji panel and the
                     reaction sheet both offer (EmojiGrid, EmojiSections, EmojiSearchField); a
                     message's long-press menu and what it opens (N5d: MessageActions, the
                     reaction sheet (ReactionPicker), the forward and report sheets,
                     MessageInfoScreen, pushed locally); the rules sheet when sending needs the
                     chat's rules accepted (RulesSheet, on logic/composer/sendPrompts); the
                     pinned messages: the strip under the header (PinnedStrip), the Pinned
                     messages screen (PinnedMessagesScreen, pinned_messages, pushed locally; it
                     shows the conversation's loaded pins, and a pin tapped there sends the
                     conversation to it: jumpRequests), and a pin's or an
                     unpin's toast with Undo (pinToasts; an unpin waits out its Undo in the
                     shell's PendingRemovals)
    details/         a chat's details (N6), pushed from the conversation without a URL: a DM's
                     (DmDetails) or a group's or channel's (GroupDetails) on ChatDetailsScreen,
                     the Members screen with its tabs (MembersScreen, chat_members), Invite
                     people (InvitePeopleScreen, invite_people; openInvite decides whether
                     Invite pushes it or says who can) and a member's profile sheet;
                     the disappearing messages, the library's TimedToggle (DisappearingRow), one
                     setting with the conversation menu's submenu; the Search tile goes back to
                     the conversation and opens its search (conversation/searchRequests);
                     Manage's pages and Edit group are N7's (group_settings, placeholders)
    start/           the signed-out start (sign in and onboarding, N4): Welcome, Welcome back,
                     Link to your account, Pick a username (its photo's crop sheet, the referrer
                     sheet), on a stack of their own (startStack.svelte.ts), loaded when
                     someone's signed out
    you/             the You tab (N12): its root, Edit profile, Diamond, and the settings pages
                     (SettingsScreen and settings/: Appearance, Notifications, Chats, Communities,
                     Storage, Bots, Account, CHIT's) and Delete account's steps, pushed locally
                     but for Diamond (?diamond) and CHIT's (?profile=chit), the web's URLs
```

Shared with the web tree rather than copied: the route table (`utils/routeTable.ts`), the route
effects (`core/RouteEffects.svelte`), the library's i18n bridge (`i18n/openchatUi.ts`), the stored
accent (`theme/accent.ts`), the native apps' setup (`utils/native/nativeApp.ts`, shared with
`components_mobile`), sign-in and sign-up (`logic/auth`: the flow's decisions, the sign-up with
its referrer, the sign-up form and the referrer picker, shared with `src/web` and the old UIs), the
profile and its settings (`logic/profile`: the form, the username check, appearance, notifications,
community names, the photo and cover uploads; `logic/chit/dailyClaim`, shared with the web's
profile and CHIT dialog), a conversation's messages (`logic/conversation`: the rows, what a message
offers and what each of its actions does (`messageAction`, which the web's menu runs too), its
controls, removing a link's preview, the unread divider and the route's message, search in a chat,
call items;
`core/ChatEventList`, `core/MediaViewer`, `core/observeRead`, shared with `src/web` and, for search
and calls, the old UIs; a chat's pinned messages loaded as `logic/pinned/pinnedMessages` loads them
for the web's group panel and the old UIs' pinned lists), the composer (`logic/composer`: where it is, what it offers, sending,
mentions, voice, the props it takes, GIFs, the prompts a send waits on (`sendPrompts`: the rules
to accept, the PIN); `logic/conversation/draftActions`: the reply or edit; shared with `src/web`,
and the GIFs' content with the old UIs; the emoji by category in
`utils/emojis`, the old pickers' data; the phone's recent photos in `utils/native/recentMedia`,
shared with the old native UI's strip; the photos and videos picked (the composer's media and the
attach panel's selection) and the recent emoji in `logic/composer`), a chat's details (the web
panel's: `logic/members`' MemberManagement, and the members' role sections, ⋯ and tabs in
`@client`'s `memberSections`, `memberMenu` and `memberTabs`, who may invite and how each person
joins in `logic/members/invitePeople`, `logic/groupOrCommunity/detailsPermissions`, `logic/profile`'s ProfileCardData, a
DM's settings in `logic/chats/dmSettings`, a group's disappearing messages in
`logic/chats/groupDisappearing`, the disappearing lengths in
`logic/chats/disappearingMessages` (on the library's `lib/durations`, TimedToggle's), and the one
setting the details' switch and the conversation menu's submenu both read and save in
`logic/chats/chatDisappearing`, with the length switching it on goes back to in the client's
`disappearingLengthsStore`), and the theme the web and Welcome's menu keep
(`theme/themes.ts`). The
marketing pages (Landing, Learn, the terms and privacy policy) aren't the app's: they open on the
website in the default browser (`shell/onWeb.ts`), as the old native app's About and a deep link
to one do.

## Rules

- **One route table.** The native tree reads the web tree's URLs and never makes up its own:
  `router/locations.ts` maps each onto a tab and a stack (`/chats/user/x` is the Chats tab with the
  list, then the conversation), so the same URL opens the same place in either tree. A screen that
  has no URL on the web (New chat, details, a settings page, a builder) is pushed without one, as
  the web opens a local dialog: `context.push` (a `LocalScreen`, `TabStacks.push`) puts it over the screen
  showing, at that screen's URL; Back takes it off, and the URL moving on replaces it.
- **Navigate by URL.** Going deeper is `navigate(url)`; the stacks follow the URL (`TabStacks.arrive`):
  a screen already in the stack is popped back to, a deeper one is pushed, a sideways one replaces
  what's above the screen in common. Back is `navigate(stacks.backUrl(), "dismiss")`, which goes back
  through the history when the entry is there.
- **Screens.** A screen is plugged in by setting its entry in `features/app/screens.ts`; it gets
  `{ screen, context }`, `context.back` being a pushed screen's Back, `context.push` a local push,
  and `context.toast` the native toast (with Undo for a destructive action), which takes the
  place of the app's (`toastStore`); `context.toastFloor` is where toasts sit over a footer that
  grows (a conversation's composer), taken from the top screen only (`ToastFloors`). Only screens touch the client and the stores, as in
  `src/web`.
- **Signed out** there are no tabs: every URL but a marketing page is the signed-out start
  (`features/start`), with no guest mode, and the URL stays as it is for after sign-in. Its
  screens have no URLs (the web's are a dialog), so they're a stack of their own
  (`StartStack`), which Android's back goes through. Signing in and up are the client's
  (`signIn`, `signUp` through `logic/auth`), never steps a screen strings together.
- **No loaders in the middle of the screen.** A screen renders at once from the stores it already
  has and fills in what's still on its way where it goes: the parts that need it disabled, or a
  small spinner in the card or row that's waiting, never one in place of the screen. Whatever can
  be fetched before the screen opens is (the You tab fetches what its settings pages show, as
  `botConfig`). The screens' chunks are preloaded while the shell is idle (`screenModules`), and
  the shell goes to a screen whose chunk isn't in yet only once it is, so the screen before stays
  rather than a blank one; ScreenHost shows a small spinner only should a chunk take long.
- **The keyboard** comes up over a screen with fields rather than the screen shrinking above it, so
  a pinned button stays down: the screen's scroller takes `aboveKeyboard` (`aboveKeyboard.svelte.ts`,
  `keyboard.ts`), which keeps the viewport resize off, makes room for the keyboard and scrolls the
  focused field above it. A conversation is the other way round: its composer rides on the
  keyboard, in a slot under it that a keyboard-area panel (emoji, attach) takes at the keyboard's
  height when the keyboard goes down (`KeyboardSlot`; the design's 304px where the keyboard hasn't
  been seen); where the keyboard's height is reported (the Android app) the viewport resize is off
  and the slot takes it, elsewhere the platform lifts the page. A message's long-press menu takes
  the keyboard down, and the slot keeps its space while the menu shows (`holdForMenu`), so nothing
  moves under it; the composer is focused again as the menu closes, unless it led to another
  screen (`afterMenu`; `MessageActions`' `leave`). A sheet with a field over it takes
  `keyboard={softKeyboard.covering}` (the kit's `BottomSheet`), so it sits on the keyboard while
  its field has it.
- **A screen leaving keeps what it shows** until it's gone. Back changes the URL as the pop starts,
  and whatever the URL selected (a chat, a community) is cleared then, in the client's stores: a
  screen that shows a selection holds what it last showed of it while it slides out (the
  conversation: `HeldWhileLeaving`).
- **Sheets and menus** register while they're open (`useOverlay(context.overlays, …)`), so Android's
  system back closes them before it pops the screen.
- **The tab bar** shows only on a tab's root; every pushed screen has the whole window (`showsTabBar`).
  A pushed screen slides in over the root and the tab bar, which stay put, and Back slides it off.
- **Between tabs**: on a tab's root, a sideways drag swipes to the neighbouring tab in the bar's
  order (touch and pen; `tabSwipe.ts`), through the same navigation as a tap. A tab switch slides
  only the old screen and the new one. A tab root with something that scrolls sideways leaves drags
  that start in it to it; anything else that wants horizontal drags marks itself
  `data-tab-swipe="off"`.
- **Platform differences** are only the Design Notes' §2 ones, through `data-os` on `<html>` (the
  kit's back arrow, kebab and touch targets read it). Don't add others.
- **Haptics** go through the kit's `haptic()` (`'light'`, a tap; `'medium'`, a message's
  long-press menu opening); the root installs the device's (`setHaptics`: the Tauri plugin's
  `haptic`, with the style), and mobile web has none. One gesture plays one: a host that plays its
  own turns the library's off (the chat's `MessageGroup` gets `pressVibration={false}`).
- Styles, tokens and specs as in `src/web` (`scss.spec.ts` checks the styles here too). No specs
  that mount a component.
