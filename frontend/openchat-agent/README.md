# OpenChat agent

This library attempts to encapsulate the OpenChat front end service layer. This means all of the interaction with the
back end canisters, all mapping to front end domain types and all interactions with the indexeddb cache.

The golden rule of the open chat agent is that it does not depend on openchat client. App state is maintained by the openchat client and
openchat agent just provides services.

### Documentation

Would be nice to design this from the beginning to be usable by a third party so we want decent docs.

### Types of thing in this repo

-   candid
-   service
-   caching service
-   service interface
-   service container
-   mapping functions
-   domain types (and pure functions operating on those types)
-   utility functions
