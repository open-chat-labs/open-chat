# OpenChat front-end

The OpenChat frontend is composed of four packages.

### app

This is the svelte website itself.

### openchat-client

This is a the top level library which represents the interface that OpenChat exposes to the outside world. This library exposes a set of functions to perform useful tasks and a set of svelte stores to provide access to reactive application state.

Internally, this library will install the openchat-agent web worker and provide async access to it.

### openchat-agent

This is a library which encapsulates all interaction with the OpenChat server canisters and all indexeddb caching. This library is designed to work inside a web worker to minimise performance impact on the main UI thread.

### openchat-shared

This library contains the OpenChat frontend domain model and is referenced by both the openchat-client and the openchat-agent libraries. The domain types are also re-exported from the openchat-client library so that the website itself can make use of them without directly depending on the shared lib.

### Turborepo

The four packages are managed by `turborepo`. To run locally run `npm i` from the root `frontend` folder then run `npm run dev`.
