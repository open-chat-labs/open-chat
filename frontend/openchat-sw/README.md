# This is the custom service worker project for OpenChat

This repo holds the custom service worker implementation for OpenChat. This is principally required to add a caching layer and custom domain mapping to the default service worker.

### The service worker

This is a copy of the default ic service worker but it has a couple of modifications.

Firstly, we need to add the open chat domains (test.oc.app, oc.app) to the hostname canister id map so that we can use
those "vanity" urls.

Secondly, we handle web push notifications.

And finally, we integrate it with google workbox so that we can add easy control over the caching of assets to improve
the performance of the app.

To build both the js entry point and the service worker run:

```
npm run build:prod
```

or

```
npm run build:prod_test
```

depending on environment

## License

Copyright 2022 Computism LTD

Licensed under the AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html
