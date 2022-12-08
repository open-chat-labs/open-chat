# Community themes

OpenChat will always maintain a high quality light and dark theme but we also reaslise that we cannot please everyone with how
our app looks and feels so we will provide a theming system and allow people to create and share their own themes.

We offer no guarantees that these themes will be comprehensive or to everyone's taste and we will not guarantee to maintain them over time -
but you are free to create your own and try out those created by others.

## How to create a theme

To create a theme of your own you must create a \*.json file with a unique name representing your theme e.g. `disco.json` and place it in the
`community` directory.

Your theme must adhere to the schema defined in the `themes.ts` file.

### Do I have to fill out everything?

No. You can base your theme on any other theme (either built in or another custom theme). Simply specify the theme you wish to extend in the
`extends` property of your json file.

If you are extending another theme, you need only specify the properties that you actually want to change in your theme.

### What next?

Once you've created your theme, you will need to make a pull request to the openchat repo to get your custom theme reviewed and merged.

Once it has been merged and deployed your custom theme will appear in the user profile section of every user and anyone will be able to
use it.

### In future

If this is a popular feature, we may consider making it more user freindly and also perhaps allow people to rate community themes so that good
quality themes float to the top and are easily discoverable.
