# Routes in the new web UI

What every URL renders in `src/web`, checked against the existing routers
(`components/Router.svelte`, `components_mobile/Router.svelte`) and the route parsers
(`openchat-client/src/utils/routes.ts`). The architecture brief's route table (§4) marked its paths
as assumptions (†); this is the verified version. The data each screen needs is in `DATA.md`; what
the app or the library is missing is in `GAPS.md`.

Rule from the brief: keep every existing path, never rename one to fit the UI, and map routes the
brief doesn't cover to the closest screen.

## Decisions

Agreed on 2026-10-16; the tables below follow them.

1. **Its own router.** `src/web/Router.svelte` registers every path itself, using the existing
   route parsers (`openchat-client/src/utils/routes.ts`) and `client.setRouteParams`, so the
   route stores (`routeStore`, `selectedChatIdStore`, `chatListScopeStore` …) behave as today.
   The old desktop router isn't touched: it goes when the old UI is deleted at cutover.
2. **Every current path stays; new paths only where the app has none.**
   - **Wallet:** its own route. In the new UI it's a workspace (`WalletPanel` + `WalletMain`, brief
     §8), not the modal it is on desktop today, so `/wallet` and its sub-paths (decision 3) are
     content routes like a chat. The path is mobile's existing `/wallet`.
   - **Activity** is only state on desktop. It takes mobile's existing `/notifications` (so no new
     `/activity`). Mobile's `/welcome` (shown when you have no communities) maps to Explore.
   - **Profile** is a dialog, so it opens over whatever page is showing, as `?profile` (decision 6),
     not as a page of its own. Mobile's `/profile_summary` stays registered for its links and
     redirects to the default chat list with `?profile`.
   - **Threads list, per scope:** `/chats/threads`, `/favourite/threads` and
     `/community/:cid/threads`. The list belongs to a scope: `threadsByChatStore` is built from
     that scope's chats. **Opening a thread is unchanged**: it stays the chat's own
     `/…/:rootIndex?open=true` (and `/:rootIndex/:threadIndex`), which notifications and shared
     links already use. Coming to a thread from the list keeps the list in the left column as
     local state (brief §4).
   - **Route kinds:** mobile's `wallet_route` (gaining `{ view, ledger? }`),
     `notifications_route` and `profile_summary_route`, plus a new `threads_route` with a scope.
   - **Registration order:** these paths have to be registered ahead of the legacy
     `/:chatId/...` route, which otherwise takes any 1–3 segment path as a group id. On the
     desktop router today, `/wallet` opens the "group not found" modal.
   - **Only in the new UI.** The old desktop router doesn't get these paths. Until the narrow
     pass, a v3 build serves the old UI below 768px, where a new-UI link such as `/wallet` still
     falls into the legacy route. That only affects flagged builds, and it's gone once narrow
     screens move to the new UI.
3. **Wallet URLs.**
   - Token pages are `/wallet/:ledger`, keyed by ledger canister id rather than symbol: it's
     stable, and symbols aren't unique.
   - Sub-views are `/wallet/send`, `/wallet/receive`, `/wallet/swap` and `/wallet/recipients`. An
     optional `?token=<ledger>` preselects a token, which the token page's "Send CHAT" button
     uses.
   - Ledger ids can't collide with the four view names.
   - `?wallet` (today's query param for the wallet modal) redirects to `/wallet`.
4. **Landing and Learn keep the existing marketing paths.**
   - `/`, `/home` and `/features` render `Landing`. `/features` scrolls to `#landing-features`.
   - The Learn sub-pages are host-routed on their existing paths: `/roadmap`, `/whitepaper`,
     `/architecture`, `/blog`, `/blog/:slug` and `/faq` (with `?q=` opening that question).
   - Landing's `learnPageHref` points at the same paths, so there's no `/learn`. `?section=`
     deep links into the whitepaper doc keep working; on `/architecture` it names the canister
     to open in the framed canister map (`CanisterMapFrame.svelte`).
5. **Pages with no new design** (`/terms`, `/privacy`, `/guidelines`, `/csea-reporting`,
   `/diamond`) **use Learn's page design.** Two library changes are needed, as their own PR before
   phase 9:
   - **Learn:** Learn's content can carry extra doc pages that use the doc layout (contents list
     plus numbered sections) without being tabs. The legal pages' existing text moves into that
     content, and `?section=` keeps scrolling to a section. The CSEA report form
     (`?report=`, `?urgent=`) is interactive, so that page gets a slot for it below the doc.
   - **Diamond:** `DiamondDialog`'s body (Free vs Diamond, plans, payment) becomes a
     `DiamondContent` component, which both the dialog and the `/diamond` page render. Signed
     out, upgrading on the page opens `AuthDialog` first.
6. **Dialog URLs.**
   - The existing query params stay: `?diamond`, `?hof`, `?faq=`, `?everyone` and `?usergroup=`.
   - Dialogs people link to are query params over the current page, so the page stays behind them
     and Back closes them: `?profile` (new, opened from the rail) and `?chit` (new), in the style
     of `?diamond` and `?hof`.
   - Every other dialog stays local state.

## Regions

The nav rail is on every in-app route. The left column is the list or panel, the middle is the
conversation or workspace, and the right is details, docked at ≥1476px and a modal below that
(brief §3). Columns that are "—" are hidden. A right column marked _on demand_ is driven by the
existing `rightPanelHistory` store (members, pinned, profile, thread …), not by the URL, except
the thread, which comes from the URL.

The **narrow** column is the layout below 768px: one column at a time, with Back going to the
left column. The app tree is chosen by viewport width at page load (`mobileWidth`, any device),
and a v3 build still falls back to v1 below 768px until the narrow pass (brief step 11). The shell
gets a basic single column from phase 1 anyway, so a desktop window shrunk after load stays usable.
Once the narrow design lands, `selectLayout` stops falling back and every browser width gets
`src/web`.

## In-app routes

`:mi` = message index, `:tmi` = thread message index. Both are optional on every chat route.
`?open=true` opens the thread rooted at `:mi`.

| Path | Route kind (scope) | Left | Middle | Right | Narrow | Guest |
|---|---|---|---|---|---|---|
| `/` (signed in) | `home_route` | – | – | – | – | redirects to `/favourite` if the user has favourites, else `/chats` |
| `/chats` | `chat_list_route` (chats) | `ChatListPanel` | `EmptyState`; auto-selects the last or first chat (existing behaviour) | – | list | yes |
| `/chats/user/:id/:mi?/:tmi?` · `/user/:id/…` | `global_chat_selected_route` direct (chats) | `ChatListPanel` | conversation (DM) | `DmPanel` docked, `ProfileDialog` "This chat" below 1476px; thread → `ThreadPanel` | conversation | no |
| `/chats/group/:id/…` · `/group/:id/…` · legacy `/:id/…` | `global_chat_selected_route` group (chats) | `ChatListPanel` | conversation (group) | `GroupPanel` on demand; thread → `ThreadPanel` | conversation | preview (read-only) |
| `/favourite` | `chat_list_route` (favourite) | `ChatListPanel` favourites | `EmptyState` / auto-select | – | list | sign in, then `/chats` |
| `/favourite/user/:id/…` · `/favourite/group/:id/…` · `/favourite/community/:cid/channel/:chid/…` | as above, favourite scope | `ChatListPanel` favourites | conversation | as above | conversation | – (redirects to the non-favourite URL if not a favourite) |
| `/community/:cid` | `selected_community_route` | `ChatListPanel` community mode (channels) | redirects to the default channel | `GroupPanel` (community) on demand | list | preview |
| `/community/:cid/channel/:chid/…` | `selected_channel_route` (community) | channel list | conversation (channel) | `GroupPanel` (channel) on demand; thread → `ThreadPanel` | conversation | preview |
| `/chats/threads` · `/favourite/threads` · `/community/:cid/threads` **(new)** | `threads_route` (that scope) | `ThreadList` (All / Unread) | last opened thread's chat, else `EmptyState` | `ThreadPanel` once a thread is open | list | sign in |
| `/notifications` **(mobile's path, new on desktop)** | `notifications_route` | `ActivityPanel` | selected item's chat | – | list | sign in |
| `/profile_summary` **(mobile's path, new on desktop)** | `profile_summary_route` | redirects to the default chat list with `?profile` | | | | sign in |
| `/welcome` **(mobile's path, new on desktop)** | `welcome_route` | – | `ExploreCommunities` (as `/communities`) | – | full | yes |
| `/communities` | `communities_route` | – (full width) | `ExploreCommunities` (search query in the URL, see below) | `JoinGateDialog` on join | full | yes |
| `/wallet` **(mobile's path, new on desktop)** | `wallet_route` {view: all} | `WalletPanel` | `WalletMain` All activity | – (`WalletSettingsDialog` is a dialog) | panel, then main | sign in |
| `/wallet/:ledger` **(new)** | `wallet_route` {view: token} | `WalletPanel`, token selected | `WalletMain` token page | – | main | sign in |
| `/wallet/send` · `/receive` · `/swap` (`?token=`) **(new)** | `wallet_route` {view} | `WalletPanel` | Send / Receive / Swap in place | – | main | sign in |
| `/wallet/recipients` **(new)** | `wallet_route` {view: recipients} | `WalletPanel` | `WalletRecipients` | – | main | sign in |
| `/share?title&text&url` | `share_route` | as the default scope | as the default scope | `ChatPicker` (existing flow: redirect, then pick a chat) | picker | sign in |
| `/admin` | `admin_route` | – | `TODO(design)`: platform operator console, operators only (existing check) | – | full | blocked |
| `*` | `not_found_route` | – | `EmptyState` (not found) | – | full | yes |

Not in the URL (brief §4): open menus, the hover toolbar, drafts, swipe state, the minimised call
position, and whether the right sidebar is open (persisted in localStorage).

**Explore query.** The brief puts the explore search in the URL. Today it's local
(`communitySearchState`). The new UI adds `/communities?q=&lang=`, which the existing tree ignores.

## Marketing routes (outside the shell)

No nav rail, no columns (brief §11). `mode` comes from the saved theme, `accent` is the default
until there's a setting (`GAPS.md`). Signed-in users on `/` go to the app as today.

| Path | Renders | Notes |
|---|---|---|
| `/` (signed out), `/home` | `Landing` | `?auth&m=…` (an emailed sign-in link) asks for the link's code (existing). `?ref=` is captured (existing). |
| `/features` | `Landing`, scrolled to `#landing-features` | The old `#hash` redirect (`?section=`) keeps working. |
| `/roadmap` · `/whitepaper` · `/architecture` · `/blog` · `/blog/:slug` · `/faq` | `Learn`, host-routed (`page`, `post`, `learnPageHref`) | `?q=` opens that FAQ question; `?section=` scrolls to that doc section, except on `/architecture`, which frames the canister map and where it names the canister to open. Content: `GAPS.md` (Learn content). |
| `/terms` · `/privacy` · `/guidelines` · `/csea-reporting` | `Learn` doc pages, not tabs (decision 5) | `?section=` scrolls to a section; `/csea-reporting` keeps `?report=` / `?urgent=`. |
| `/diamond` | Learn-style page with `DiamondContent` (decision 5) | Upgrading while signed out opens `AuthDialog` first. |

`AuthDialog` (via `PageAuthState`) is wired to the existing sign-in flow (`DATA.md` §Auth).

## Query params (kept as they are)

| Param | Effect in the new UI |
|---|---|
| `?open=true` | thread panel open for `:mi` |
| `?code=` | private group / community invite code |
| `?ref=` | referral; captured, then dropped from the URL |
| `?autojoin` | join after preview |
| `?explore` | no auto-select of a default chat |
| `?profile` **(new)** | `ProfileDialog`, over the current page |
| `?diamond` | `DiamondDialog` |
| `?chit` **(new)** | `ChitDialog` |
| `?hof` | `LeaderboardDialog` |
| `?faq=<topic>` | navigates to `/faq?q=<topic>` |
| `?everyone` | members in the right column |
| `?usergroup=N` | that user group's members in the right column |
| `?wallet` | redirects to `/wallet` |
| `?auth=II&auth=EMAIL…` | limits the sign-in methods `AuthDialog` offers |

Not a URL, wired as today:
- the `profile-clicked` event from `<profile-link>` (→ `UserDialog`);
- pubsub events that navigate (`navigateTo`) or open UI (`wallet`, `upgrade`, `profile`, `chatWith` …);
- the iframe host's `change_route` / `override_settings` messages (`stores/xframe.ts`);
- service worker notification URLs, which already use the paths above.

## Things the existing router does that the new one keeps

- **Auto-select.** `/chats`, `/favourite` and `/community/:cid` redirect (replace) to the last
  selected or first chat in that scope (`selectDefaultChat`).
- **`setSelectedChat` redirects:** a non-favourite on a `/favourite` URL, a group that has moved
  to a community, a migrated DM, and the not-found and restricted modals.
- **Threads.** Closing a thread strips `/:tmi` and `?open`. `/:mi/:tmi` opens the thread on a cold
  load even without `?open`.
- **Previews.** Navigating away from a previewed community drops the preview.
- **Navigation.** It goes through `utils/navigation.ts` (`navigate(to, intent)`), which waits for
  the modal stack to close. The new shell has to handle `closeModalStack` the way `Home.svelte`
  does, or navigations sit pending.

## Built so far

**Router (phase 2).** `router/routeTable.ts` registers every path above in this order, and
`router/Router.svelte` runs the existing route effects. `router/regions.ts` maps each route onto
the regions above, and the in-app regions are placeholders until their screens are built.

**Landing, Learn and sign-in (brought forward from phase 9).** `features/marketing` renders
`Landing` on `/` (signed out), `/home` and `/features`, and `Learn` host-routed on its sub-pages'
paths. `features/auth` wires `AuthDialog` to the existing sign-in flows: on the pages through
their own dialog, and in the app (`AuthScreen`) whenever the client asks for a sign-in or a
signed-in identity has no account yet. `/home?auth&m=…` (the emailed sign-in link) asks for the
link's code over Landing. While a sign-in or sign-up started in Landing's own dialog is going,
`/` keeps showing Landing, so that dialog sees it through, and after a sign-up there fails, so it
says why (`pageSignIns`, `showsSignedOut`). Leaving the app mid sign-in gives the sign-in up.

Still to come:

- **Learn content**: Learn shows the library's placeholder content until the existing roadmap,
  docs, blog and FAQ are converted (`GAPS.md`). `/faq?q=` and `?section=` wait for that too.
- **Legal pages and `/diamond`**: placeholders until Learn's doc pages and `DiamondContent` exist
  (decision 5).
- **Guests**: guest-only behaviour comes in the guest pass (phase 10). That covers the "sign in"
  routes in the Guest column and the composer's sign-in prompt. A guest on `/favourite` already
  gets the sign-in, then `/chats`.
- **Dialog params**: `?profile` opens a placeholder dialog over the page. `?diamond`, `?hof` and
  `?chit` are left in the URL until their dialogs exist (phase 8).
- **Share**: `/share` goes to the default scope as today, but picking the chat (`ChatPicker`)
  comes in phase 5.

## Known router issues (not fixed here)

- The legacy `/:chatId` route catches unregistered 1–3 segment paths and treats them as a group id
  (`/hotgroups`, `/welcome` on desktop, `/faq` on mobile).
- `landingPagePaths` (`utils/urls.ts`) is missing `privacy` and `csea-reporting`.
- `favourites_route` and `explore_groups_route` are route kinds no path produces.
