# Chat state

The state maintained around chats, events, threads etc has got very confusing and really needs a refactor to get it back under control.
It is spread out between stores, controllers and components and is therefore difficult to find and understand

-   current user (including crypto balances etc)
-   other users (already a store)
-   chats (can easily be a store)
-   events (generic store - one per chat and one per thread)
-   drafts (already a store)
-   messages read (hmmm)
-   reactions (hmmmm)

## events store

A general purpose store to manage a list of events. It would contain all of the logic for keeping those events up to date, synced with the cache etc. We could then have one of these stores for a selected chat but also one for a selected thread.

users - already managed via a store. Move util functions into the same module

chats - this can easily just be a store

drafts - this is a store already and that works well

messages read

reactions

In some cases we want stores that are limited to a particular scope i.e. a chat or a thread so where do these stores live? Do they need to be instantiated by a controller or can they be instantiated by a component (or perhaps a _controller_ component)

canister -> cache -> event store
