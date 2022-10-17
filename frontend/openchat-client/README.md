# OpenChat client

This library attempts to encapsulate most of the open chat front end business logic

The library will take care of state management, communicating with the backend, building and maintaining an indexeddb cache
of chat data and mapping between frontend and backend datatypes.

### TODO - how to use

### Documentation

Would be nice to design this from the beginning to be usable by a third party so we want decent docs.

### Notes

This repo should **not** have any references to UI state but will manage application level state. That app state will be managed via svelte stores. This still gives a cross platform
solution since a svelte store is a very lightweight concept that can be used quite separately from the rest of the framework.

### Events

Should the whole service container be an EventEmitter?

### Types of thing in this repo

-   candid
-   service
-   caching service
-   service interface
-   service container
-   mapping functions
-   domain types (and pure functions operating on those types)
-   utility functions
-   polling to maintain state
-   constantly up to date application level state

From the outside we can think of this as a few separate pieces.

-   Actions
-   Effects
-   (Reactive) State

### Done so far

-   stores roughly partitioned into UI and lib
