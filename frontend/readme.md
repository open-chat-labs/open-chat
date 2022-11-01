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

## Unit Testing

Unit testing is done using the `jest` framework. Tests can be run using either `npm run test` to run the test suite once or `npm run test:watch` to run the tests in watch mode.

Tests are written in typescript and subject to the same tsconfig and linting rules as the rest of the code.

### Linting

Linting is provided via eslint. Make sure that you have an editor plugin setup to help you. There is already an eslint config within the project.

You can also run `npm run lint` to lint the frontend project.

### Formatting

Formatting for svelte files is provided by the svelte-vscode plugin (or equivalent) which itself uses prettier. We use prettier explicitly for formatting non-svelte files. To get the best out of this (for vs code) you should have the svelte-vscode, prettier and eslint plugins and have the following settings:

```
    "editor.formatOnSave": true,
    "editor.formatOnPaste": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "[svelte]": {
        "editor.defaultFormatter": "svelte.svelte-vscode"
    },
```

In addition you can run `npm run format` to format all typescript files.
