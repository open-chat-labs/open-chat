## OpenChat component library

The idea is that this is a self contained library of pure UI components containing no business logic.

These components should cater for the vast majority of our presentation requirements and the goal is that
the business logic components should contain little or no css.

These components can be consumed directly in the `/frontend/app` project, there is no separate build process.

Components can also be developed in isolation using the `/playground` which is a small vite site that showcases
all of the components and their major variations. To run the playground site just run `npm run dev`.
