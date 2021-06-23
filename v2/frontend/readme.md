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
INTERNET_IDENTITY_URL=http://rwlgt-iiaaa-aaaaa-aaaaa-cai.localhost:8000/
DFX_NETWORK=local
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

TODO - add package.json lint command

### Formatting 
Formatting is provided by prettier via the "Svelte for VS Code" plugin. 

## i18n
Ultimately we would like Open Chat to be language localisable. There is a mechanism in place for this. Avoid hard-coded english strings. All static strings should be placed in the `./src/i18n/en.json` file and accessed using the stores provide by the `svelte-i18n` package. 

In due course, we can add other language specific json files to the project and we will be ready to support those languages within the UI. 

Also, related to i18n, we wish to make sure that all UI code works correctly in rtl mode as well as ltr, so be sure to test that when making UI changes. 

## Styling
Styles are generally written within svelte components using scss. Useful css utilities and variables are provided via a `mixins.scss` file which can be imported as needed.

### Theming 
Themes are provided via css variables. When defining colours within the svelte components, use existing theme level css variables or extend the theme if necessary. Do not hard-code colours. 

```css
// Bad 
.my-thing {
    background-color: #efefef;
}

// Good 
.my-thing {
    backgroung-color: var(--my-thing-bg);
}
```

## State Handling 
There are a number of options within svelte and we should use the most appropriate tool for each case. Simple local state can just be handled with local variables. If state is simple and self-contained but required globally, then it can be provided using svelte stores. If state is complex and governed by important rules then it should be managed using xstate state machines. 