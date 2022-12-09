# Community themes

OpenChat will always maintain a high quality light and dark theme but we also reaslise that we cannot please everyone with how
our app looks and feels so we will provide a theming system and allow people to create and share their own themes.

We offer no guarantees that these themes will be comprehensive or to everyone's taste and we will not guarantee to maintain them over time -
but you are free to create your own and try out those created by others.

## How to create a theme

First create a new typescript file in this folder. Take `submarine.ts` as an example. In this file you can see that it defines a function called `getTheme`. This function will
accept an existing theme to base your new theme on and you must simply change the properties that you are interested in changing.

For example we can see that the main background is changed in the submarine theme as follows:

```
    base.bg = "radial-gradient(circle, rgba(101,6,6,1) 10%, rgba(0,0,0,1) 79%)";
```

Note that you _must_ give your theme a unique name and label.

### Do I have to fill out everything?

No. You only need to overwrite the things that you want to change. So pick an existing theme that is as close to what you want to start with as you can and it will be easier.

### What next?

Once you have created your theme you need to plug it into the user profile page.

To do that open `themes.ts`. At the top of this file you will see something like the following:

```
import { getTheme as getWhiteTheme } from "./community/white";
import { getTheme as getSubmarineTheme } from "./community/submarine";

const defaultTheme = lightTheme();
const dark = darkTheme(defaultTheme);

// Community themes need to be added here
export const communityThemes = [
    getWhiteTheme(cloneTheme(defaultTheme)),
    getSubmarineTheme(cloneTheme(dark)),
];

```

You will need to import the theme you just created and then make sure it is added to the `communityThemes` list.

With this done you should be able to select your custom theme from the user profile page.

Once you are happy you will need to make a pull request to the openchat repo to get your custom theme reviewed and merged.

Once it has been merged and deployed your custom theme will appear in the user profile section of every user and anyone will be able to
use it.

### In future

If this is a popular feature, we may consider making it more user friendly and also perhaps allow people to rate community themes so that good
quality themes float to the top and are easily discoverable.
