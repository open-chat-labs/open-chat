# OpenChat agent

This library encapsulates all of the communication between the OpenChat frontend and backend.

The library will take care of communicating with the backend, building and maintaining an indexeddb cache
of chat data and mapping between frontend and backend datatypes.

### TODO - how to use

### Documentation

Would be nice to design this from the beginning to be usable by a third party so we want decent docs.

### Notes

This repo should **not** have any references to UI concerns. That means that it does not reference svelte in any way. No svelte stores.

This is a low level, non-reactive data layer. The frontend project will provide a reactive svelte-store layer on top (with the hope that that too
will become a higher level library).

### Events

Should the whole service container be an EventEmitter?
