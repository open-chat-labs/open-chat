# Chat state

The state maintained around chats, events, threads etc has got very confusing and really needs a refactor to get it back under control.
It is spread out between stores, controllers and components and is therefore difficult to find and understand

-   current user (including crypto balances etc)
-   other users
-   chats
-   events
-   drafts
-   messages read
-   reactions
