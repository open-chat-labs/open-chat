# Open Chat Frontend

This is the frontend codebase for Open Chat. It is a svelte app written in typescript.

To run locally you will need to do the following:

## Install dependencies

`npm i`

## Start a local IC replica

Make sure that you have a locally running IC replica. The recommended approach is to clone the [internet identity repo](https://github.com/dfinity/internet-identity) then cd into that directory and run `dfx start`.

In a separate terminal in the same directory, run `II_ENV=development dfx deploy --no-wallet --argument '(null)'`

Make a note of the canister ID created for the internet-identity.

## Local environment variables

`cd` back into the frontend directory of this repo and create a .env file.

This should look something like this:

```bash
INTERNET_IDENTITY_URL=http://localhost:8000?canisterId=rwlgt-iiaaa-aaaaa-aaaaa-cai
DFX_NETWORK=local
MOCK_SERVICES=false
DEV_PORT=5001
SHOW_XSTATE_INSPECTOR=false
ROLLBAR_ACCESS_TOKEN=...
CLIENT_CACHING=false
USER_INDEX_CANISTER=naxa5-eyaaa-aaaaa-aacda-cai
GROUP_INDEX_CANISTER=nhwgj-jaaaa-aaaaa-aacdq-cai
NOTIFICATIONS_CANISTER=mkych-giaaa-aaaaa-aacea-cai
BLOB_URL_PATTERN=http://{canisterId}.localhost:8000/blobs/
```

Where the INTERNET_IDENTITY value should be replaced with a value containing the correct internet identity canister ID for your local environment.

## Build and deploy server canisters

The frontend depends on both the generated types of the back end services and also requires instances of the relevant canisters to be deployed to the local IC replica.

## Start the dev server

From the frontend directory, run `npm run dev` to start the rollup dev server. The system should now be available on `http://localhost:5000`.

## Building

To create a production build run `npm run build`.

## Unit Testing

Unit testing is done using the `jest` framework. Tests can be run using either `npm run test` to run the test suite once or `npm run test:watch` to run the tests in watch mode.

Tests are written in typescript and subject to the same tsconfig and linting rules as the rest of the code.

TBD - integration testing? Maybe with Cypress

## Tooling

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

## i18n

Ultimately we would like Open Chat to be language localisable. There is a mechanism in place for this. Avoid hard-coded english strings. All static strings should be placed in the `./src/i18n/en.json` file and accessed using the stores provide by the `svelte-i18n` package.

In due course, we can add other language specific json files to the project and we will be ready to support those languages within the UI.

Also, related to i18n, we wish to make sure that all UI code works correctly in rtl mode as well as ltr, so be sure to test that when making UI changes.

## Styling

Styles are generally written within svelte components using scss. Useful css utilities and variables are provided via a `mixins.scss` file which can be imported as needed. Avoid ad hoc inline values for things like colors, spacing and font sizes. Use the mixins and scss variables defined and we will automatically achieve a certain continuity and consistency in the UI.

### Theming

Themes are provided via css variables. When defining colours within the svelte components, use existing theme level css variables or extend the theme if necessary. Do not hard-code colours.

```css
// Bad
.my-thing {
    background-color: #efefef;
    padding: 10px;
}

// Good
.my-thing {
    backgroung-color: var(--my-thing-bg);
    padding: $sp4;
}
```

## State Handling

There are a number of options within svelte and we should use the most appropriate tool for each case. Simple local state can just be handled with local variables. If state is simple and self-contained but required globally, then it can be provided using svelte stores. If state is complex and governed by important rules then it should be managed using xstate state machines.

## Storybook

A good strategy for developing UI in isolation of any business logic is to try to develop pure UI components and create storybook stories for them during development. This has a number of benefits. It encourages the UI components to be appropriately decoupled from business logic and state handling. It allows UI development to proceed ahead of business logic if necessary. It leaves a useful set of stories that can serve as documentation on how UI components should be used.

To run storybook simply run `npm run storybook` and it should start running on `http://localhost:6006`.

Prefer to write storybook stories as svelte components rather than using js.
